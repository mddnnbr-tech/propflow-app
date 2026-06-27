const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { imageUpload } = require('../middleware/upload');
const aiService = require('../services/ai.service');
const notificationService = require('../services/notifications.service');
const storageService = require('../services/storage.service');
const { onVendorDispatched, onJobCompleted } = require('../services/vendorautomation.service');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/maintenance  — manager sees all requests across their portfolio
router.get('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { status } = req.query;
  const requests = await prisma.maintenanceRequest.findMany({
    where: {
      unit: { property: { managerId: req.user.id } },
      ...(status ? { status } : {}),
    },
    include: {
      tenant: { select: { firstName: true, lastName: true, email: true, phone: true } },
      unit: { include: { property: { select: { name: true, address: true } } } },
      vendor: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(requests);
});

// GET /api/maintenance/my  — tenant sees their own requests
router.get('/my', authenticate, requireRole('TENANT'), async (req, res) => {
  const requests = await prisma.maintenanceRequest.findMany({
    where: { tenantId: req.user.id },
    include: { vendor: true, unit: { include: { property: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
});

// GET /api/maintenance/:id
router.get('/:id', authenticate, async (req, res) => {
  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: req.params.id },
    include: {
      tenant: { select: { firstName: true, lastName: true, email: true, phone: true } },
      unit: { include: { property: { select: { name: true, address: true } } } },
      vendor: true,
    },
  });
  if (!request) return res.status(404).json({ error: 'Request not found' });

  // Tenants can only see their own
  if (req.user.role === 'TENANT' && request.tenantId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(request);
});

// POST /api/maintenance  — tenant submits a request with optional photos
router.post(
  '/',
  authenticate,
  requireRole('TENANT'),
  (req, res, next) => { req.uploadFolder = 'maintenance'; next(); },
  imageUpload.array('photos', 5),
  async (req, res) => {
    const { description, priority } = req.body;

    const lease = await prisma.lease.findUnique({
      where: { tenantId: req.user.id },
      include: { unit: { include: { property: { include: { manager: true } } } } },
    });
    if (!lease) return res.status(404).json({ error: 'No active lease found' });

    const photoUrls = (req.files || []).map((f) => storageService.getFileUrl(f));
    const photoPaths = (req.files || []).map((f) => f.path);

    // AI classifies photos
    let aiResult = null;
    if (photoPaths.length > 0) {
      try {
        aiResult = await aiService.classifyMaintenancePhoto(photoPaths[0], description);
      } catch (err) {
        console.error('Maintenance AI error:', err.message);
      }
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        tenantId: req.user.id,
        unitId: lease.unitId,
        description,
        priority: priority || aiResult?.priority || 'NORMAL',
        photoUrls,
        aiCategory: aiResult?.category,
        aiTrade: aiResult?.trade,
        aiSummary: aiResult?.summary,
        aiConfidence: aiResult?.confidence,
      },
      include: { unit: { include: { property: { select: { name: true } } } } },
    });

    // Auto-dispatch if manager has a preferred vendor for this trade and autoDispatch is on
    let dispatchedVendor = null;
    if (aiResult?.trade) {
      const autoVendor = await prisma.vendor.findFirst({
        where: {
          managerId: lease.unit.property.managerId,
          trade: { contains: aiResult.trade, mode: 'insensitive' },
          isPreferred: true,
          autoDispatch: true,
        },
      });

      if (autoVendor) {
        await prisma.maintenanceRequest.update({
          where: { id: request.id },
          data: { status: 'DISPATCHED', vendorId: autoVendor.id, dispatchedAt: new Date() },
        });
        dispatchedVendor = autoVendor;

        // Notify vendor by email/SMS
        if (autoVendor.email) {
          await notificationService.sendEmail({
            to: autoVendor.email,
            subject: `[PropFlow] New Dispatch: ${aiResult.trade}`,
            text: `You have been auto-dispatched to a maintenance request.\n\nIssue: ${description}\nUnit: ${lease.unit.unitNumber} — ${lease.unit.property.address}\n\nSummary: ${aiResult.summary}`,
          });
        }
        if (autoVendor.phone) {
          await notificationService.sendSMS({
            to: autoVendor.phone,
            body: `PropFlow Dispatch: ${aiResult.trade} job at ${lease.unit.property.address} Unit ${lease.unit.unitNumber}. Check email for details.`,
          });
        }
      }
    }

    // Notify manager
    const manager = lease.unit.property.manager;
    await notificationService.createNotification(prisma, {
      userId: manager.id,
      title: `New Maintenance Request — ${aiResult?.trade || 'General'}`,
      message: `Unit ${lease.unit.unitNumber}: ${description}${dispatchedVendor ? ` — Auto-dispatched to ${dispatchedVendor.name}` : ''}`,
      type: 'maintenance',
      linkTo: `/manager/maintenance/${request.id}`,
    });

    res.status(201).json({ request, aiResult, dispatchedVendor });
  }
);

// POST /api/maintenance/:id/dispatch  — manager manually assigns a vendor
router.post('/:id/dispatch', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { vendorId } = req.body;

  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
    include: { tenant: true, unit: { include: { property: true } } },
  });
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, managerId: req.user.id },
  });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const updated = await prisma.maintenanceRequest.update({
    where: { id: req.params.id },
    data: { vendorId, status: 'DISPATCHED', dispatchedAt: new Date() },
    include: { vendor: true },
  });

  // Tier-based vendor automation (Growth/Pro send rich email + SMS + follow-ups)
  const tier = process.env.ACCOUNT_TIER || 'GROWTH';
  await onVendorDispatched(prisma, {
    request: { ...request, unit: request.unit },
    vendor,
    manager: req.user,
    tier,
  });

  // Notify tenant
  await notificationService.createNotification(prisma, {
    userId: request.tenantId,
    title: 'Vendor Dispatched',
    message: `${vendor.name} has been dispatched for your maintenance request. They will contact you soon.`,
    type: 'maintenance',
  });

  res.json(updated);
});

// PUT /api/maintenance/:id  — update status / add manager notes / set cost
router.put('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { status, managerNotes, completedAt, cost } = req.body;

  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
    include: { unit: { include: { property: true } } },
  });
  if (!request) return res.status(404).json({ error: 'Request not found' });

  // Cost threshold check when completing: notify manager if over threshold
  if (status === 'COMPLETED' && cost) {
    const manager = await prisma.user.findUnique({ where: { id: req.user.id }, select: { vendorCostThreshold: true } });
    const threshold = request.vendorId
      ? (await prisma.vendor.findUnique({ where: { id: request.vendorId }, select: { costThreshold: true } }))?.costThreshold
      : null;
    const effectiveThreshold = threshold ?? manager?.vendorCostThreshold ?? 500;
    if (parseFloat(cost) > effectiveThreshold) {
      // Flag in notes that this exceeded threshold
      await notificationService.createNotification(prisma, {
        userId: req.user.id,
        title: `⚠️ Repair Cost Exceeds Threshold`,
        message: `Job at ${request.unit.property.name} Unit ${request.unit.unitNumber} cost $${cost} — above your $${effectiveThreshold} approval threshold. Please review before paying vendor.`,
        type: 'maintenance',
        linkTo: `/manager/maintenance`,
      });
    }
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id: req.params.id },
    data: {
      status,
      managerNotes,
      cost: cost !== undefined ? parseFloat(cost) : undefined,
      completedAt: status === 'COMPLETED' ? new Date() : completedAt,
    },
  });

  if (status === 'COMPLETED') {
    const fullRequest = await prisma.maintenanceRequest.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: true,
        vendor: true,
        unit: { include: { property: { include: { manager: true } } } },
      },
    });
    if (fullRequest) {
      await onJobCompleted(prisma, {
        request: fullRequest,
        vendor: fullRequest.vendor,
        manager: fullRequest.unit.property.manager,
        tenant: fullRequest.tenant,
      });
    }
  }

  res.json(updated);
});

// POST /api/maintenance/:id/pay-vendor  — manager marks vendor as paid
router.post('/:id/pay-vendor', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { amount, paymentMethod, notes } = req.body;
  const request = await prisma.maintenanceRequest.findFirst({
    where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
    include: { vendor: true, unit: { include: { property: true } }, tenant: true },
  });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (!request.vendor) return res.status(400).json({ error: 'No vendor assigned' });

  const updated = await prisma.maintenanceRequest.update({
    where: { id: req.params.id },
    data: {
      vendorPaid: true,
      vendorPaidAt: new Date(),
      vendorPaidAmount: parseFloat(amount) || request.cost,
      vendorPaymentMethod: paymentMethod || 'MANUAL',
      vendorPaidNotes: notes,
    },
  });

  // Notify vendor by email if they have one
  if (request.vendor.email) {
    await notificationService.sendEmail({
      to: request.vendor.email,
      subject: `Payment Sent — ${request.unit.property.name} Unit ${request.unit.unitNumber}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#16a34a;">✓ Payment Processed</h2>
          <p>Hi ${request.vendor.name},</p>
          <p>Payment for the completed job has been sent.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Property</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.unit.property.name} · Unit ${request.unit.unitNumber}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Job</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${request.aiTrade || 'Maintenance'}</td></tr>
            <tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Amount</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">$${updated.vendorPaidAmount?.toLocaleString()}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Method</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${paymentMethod || 'Manual'}</td></tr>
            ${notes ? `<tr style="background:#f8fafc;"><td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">Notes</td><td style="padding:10px 14px;border:1px solid #e2e8f0;">${notes}</td></tr>` : ''}
          </table>
          <p style="color:#64748b;font-size:13px;">Thank you for your service. — PropFlow Property Management</p>
        </div>
      `,
    });
  }

  res.json(updated);
});

module.exports = router;
