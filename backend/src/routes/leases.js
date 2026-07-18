const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const aiService = require('../services/ai.service');
const docusignService = require('../services/docusign.service');
const notificationService = require('../services/notifications.service');
const storageService = require('../services/storage.service');
const { getLeaseMarketComparison } = require('../services/marketrent.service');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/leases  — manager sees all leases for their properties
router.get('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const leases = await prisma.lease.findMany({
    where: { unit: { property: { managerId: req.user.id } } },
    include: {
      unit: { include: { property: { select: { name: true, address: true } } } },
      tenant: { select: { firstName: true, lastName: true, email: true, phone: true } },
      payments: { orderBy: { dueDate: 'desc' }, take: 3 },
    },
    orderBy: { endDate: 'asc' },
  });
  res.json(leases);
});

// GET /api/leases/my  — tenant sees their own lease
router.get('/my', authenticate, requireRole('TENANT'), async (req, res) => {
  const lease = await prisma.lease.findUnique({
    where: { tenantId: req.user.id },
    include: {
      unit: { include: { property: { select: { name: true, address: true, city: true, state: true } } } },
      payments: { orderBy: { dueDate: 'desc' }, take: 12 },
    },
  });
  if (!lease) return res.status(404).json({ error: 'No lease found' });
  res.json(lease);
});

// POST /api/leases  — manager creates lease, assigns tenant to unit
router.post('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const {
    unitId, tenantId, startDate, endDate, rentAmount, depositAmount,
    lateFee, lateFeeGraceDays, rentDueDay, petPolicy, utilitiesIncluded, templateId, autoRenew,
  } = req.body;

  // Verify unit belongs to this manager
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, property: { managerId: req.user.id } },
  });
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  const lease = await prisma.lease.create({
    data: {
      unitId,
      tenantId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      rentAmount,
      depositAmount: depositAmount || 0,
      lateFee: lateFee || null,
      lateFeeGraceDays: lateFeeGraceDays ?? 5,
      rentDueDay: rentDueDay ?? 1,
      petPolicy: petPolicy || null,
      utilitiesIncluded: utilitiesIncluded || null,
      templateId: templateId || null,
      autoRenew: autoRenew || false,
    },
    include: {
      tenant: { select: { firstName: true, lastName: true, email: true } },
      unit: { include: { property: { select: { name: true } } } },
    },
  });

  // Mark unit as occupied
  await prisma.unit.update({ where: { id: unitId }, data: { status: 'OCCUPIED' } });

  // Notify tenant
  await notificationService.createNotification(prisma, {
    userId: tenantId,
    title: 'Lease Created',
    message: `Your lease for Unit ${lease.unit.unitNumber} starts ${new Date(startDate).toLocaleDateString()}.`,
    type: 'lease',
  });

  res.status(201).json(lease);
});

// POST /api/leases/:id/upload-document  — upload signed lease PDF
router.post(
  '/:id/upload-document',
  authenticate,
  requireRole('MANAGER'),
  (req, res, next) => {
    req.uploadFolder = 'leases';
    next();
  },
  documentUpload.single('document'),
  async (req, res) => {
    const lease = await prisma.lease.findFirst({
      where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
    });
    if (!lease) return res.status(404).json({ error: 'Lease not found' });

    const fileUrl = storageService.getFileUrl(req.file);

    // Use AI to parse lease document and extract key terms
    let terms = null;
    try {
      terms = await aiService.parseLease(req.file.path);
    } catch (err) {
      console.error('Lease AI parse error:', err.message);
    }

    const updated = await prisma.lease.update({
      where: { id: req.params.id },
      data: { documentUrl: fileUrl, terms },
    });

    // Auto-populate all AI-extracted fields into the lease record
    const fieldUpdates = {};
    if (terms?.rentAmount) fieldUpdates.rentAmount = parseFloat(terms.rentAmount);
    if (terms?.depositAmount) fieldUpdates.depositAmount = parseFloat(terms.depositAmount);
    if (terms?.startDate) { try { fieldUpdates.startDate = new Date(terms.startDate); } catch {} }
    if (terms?.endDate) { try { fieldUpdates.endDate = new Date(terms.endDate); } catch {} }
    if (terms?.lateFee) fieldUpdates.lateFee = parseFloat(terms.lateFee);
    if (terms?.lateFeeGraceDays) fieldUpdates.lateFeeGraceDays = parseInt(terms.lateFeeGraceDays);
    if (terms?.rentDueDay) fieldUpdates.rentDueDay = parseInt(terms.rentDueDay);
    if (terms?.petPolicy && !lease.petPolicy) fieldUpdates.petPolicy = terms.petPolicy;
    if (terms?.utilitiesIncluded && !lease.utilitiesIncluded) fieldUpdates.utilitiesIncluded = Array.isArray(terms.utilitiesIncluded) ? terms.utilitiesIncluded.join(', ') : terms.utilitiesIncluded;

    if (Object.keys(fieldUpdates).length > 0) {
      await prisma.lease.update({ where: { id: req.params.id }, data: fieldUpdates });
      // Also sync rent amount back to the unit
      if (fieldUpdates.rentAmount) {
        await prisma.unit.update({ where: { id: lease.unitId }, data: { rentAmount: fieldUpdates.rentAmount } });
      }
    }

    res.json({ lease: { ...updated, ...fieldUpdates }, aiExtracted: terms });
  }
);

// POST /api/leases/:id/send-renewal  — manager sends DocuSign renewal
router.post('/:id/send-renewal', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { newEndDate, newRentAmount } = req.body;

  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
    include: {
      tenant: true,
      unit: { include: { property: true } },
    },
  });
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  let envelopeId = null;
  try {
    envelopeId = await docusignService.sendRenewal({
      tenant: lease.tenant,
      lease,
      newEndDate,
      newRentAmount,
    });
  } catch (err) {
    console.error('DocuSign error:', err.message);
    return res.status(502).json({
      error: 'The renewal could not be sent — e-signature service is unavailable or not configured. Nothing was sent to the tenant.',
    });
  }

  await prisma.lease.update({
    where: { id: req.params.id },
    data: { renewalSentAt: new Date() },
  });

  await notificationService.createNotification(prisma, {
    userId: lease.tenantId,
    title: 'Lease Renewal',
    message: `Your landlord has sent a lease renewal. Please check your email to sign.`,
    type: 'lease',
  });

  res.json({ message: 'Renewal sent', envelopeId });
});

// POST /api/leases/:id/send-for-signature — send lease (from template or uploaded doc) to tenant via DocuSign
router.post('/:id/send-for-signature', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { templateId } = req.body;

  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
    include: { tenant: true, unit: { include: { property: { include: { manager: true } } } } },
  });
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  const tplId = templateId || lease.templateId;
  if (!tplId) return res.status(400).json({ error: 'Pick a template first (or upload a signed lease instead).' });

  const template = await prisma.leaseTemplate.findFirst({
    where: { id: tplId, OR: [{ isSystem: true }, { managerId: req.user.id }] },
  });
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const manager = lease.unit.property.manager;
  const fmt = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const fills = {
    LEASE_DATE: fmt(new Date()),
    ORIGINAL_LEASE_DATE: fmt(lease.startDate),
    LANDLORD_NAME: `${manager.firstName} ${manager.lastName}`,
    COMPANY_NAME: `${manager.firstName} ${manager.lastName}`,
    TENANT_NAME: `${lease.tenant.firstName} ${lease.tenant.lastName}`,
    PROPERTY_ADDRESS: `${lease.unit.property.address}, ${lease.unit.property.city}, ${lease.unit.property.state} ${lease.unit.property.zip}`,
    UNIT_NUMBER: lease.unit.unitNumber,
    START_DATE: fmt(lease.startDate),
    END_DATE: fmt(lease.endDate),
    NEW_END_DATE: fmt(lease.endDate),
    RENT_AMOUNT: lease.rentAmount.toFixed(2),
    NEW_RENT_AMOUNT: lease.rentAmount.toFixed(2),
    DEPOSIT_AMOUNT: (lease.depositAmount || 0).toFixed(2),
    LATE_FEE: (lease.lateFee || 0).toFixed(2),
    LATE_FEE_GRACE_DAYS: String(lease.lateFeeGraceDays ?? 5),
    PAYMENT_ADDRESS: 'via the PropFlow tenant portal',
    UTILITIES_INCLUDED: lease.utilitiesIncluded ? `Utilities included: ${lease.utilitiesIncluded}` : 'No utilities are included in rent unless otherwise agreed in writing.',
    PET_POLICY: lease.petPolicy || 'No pets are permitted without prior written consent of the Landlord.',
    AUTO_RENEW_CLAUSE: lease.autoRenew ? 'shall automatically renew on a month-to-month basis unless either party gives 30 days written notice' : 'shall terminate on the end date unless renewed in writing',
    STATE: lease.unit.property.state,
  };

  // Fill every {{PLACEHOLDER}}; leave any unknown ones as blank lines to fill by hand
  const filledContent = template.content.replace(/\{\{(\w+)\}\}/g, (_, key) => fills[key] ?? '____________');

  let envelopeId;
  try {
    const html = docusignService.buildTemplateDocument({ title: template.name, filledContent });
    envelopeId = await docusignService.sendHtmlForSignature({
      tenant: lease.tenant,
      emailSubject: `Action Required: ${template.name} — ${lease.unit.property.name} Unit ${lease.unit.unitNumber}`,
      emailBlurb: `Hi ${lease.tenant.firstName}, your lease documents are ready to review and sign.`,
      html,
      documentName: template.name,
    });
  } catch (err) {
    console.error('DocuSign error:', err.message);
    return res.status(502).json({
      error: 'The document could not be sent — e-signature service is unavailable or not configured. Nothing was sent to the tenant.',
    });
  }

  await prisma.lease.update({
    where: { id: req.params.id },
    data: { templateId: template.id },
  });

  await notificationService.createNotification(prisma, {
    userId: lease.tenantId,
    title: 'Lease Ready to Sign',
    message: `Your ${template.name} has been sent. Check your email to review and sign.`,
    type: 'lease',
  });

  res.json({ message: 'Sent for signature', envelopeId });
});

// GET /api/leases/:id/market-rent — Pro tier: compare current rent to market
router.get('/:id/market-rent', authenticate, requireRole('MANAGER'), async (req, res) => {
  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
    include: {
      unit: { include: { property: true } },
    },
  });
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  const comparison = await getLeaseMarketComparison(lease);
  res.json(comparison);
});

// PUT /api/leases/:id
router.put('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const {
    startDate, endDate, rentAmount, depositAmount,
    lateFee, lateFeeGraceDays, rentDueDay, petPolicy, utilitiesIncluded,
    autoRenew, status,
  } = req.body;

  const lease = await prisma.lease.findFirst({
    where: { id: req.params.id, unit: { property: { managerId: req.user.id } } },
  });
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  const updated = await prisma.lease.update({
    where: { id: req.params.id },
    data: {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      rentAmount: rentAmount !== undefined ? rentAmount : undefined,
      depositAmount: depositAmount !== undefined ? depositAmount : undefined,
      lateFee: lateFee !== undefined ? lateFee : undefined,
      lateFeeGraceDays: lateFeeGraceDays !== undefined ? lateFeeGraceDays : undefined,
      rentDueDay: rentDueDay !== undefined ? rentDueDay : undefined,
      petPolicy: petPolicy !== undefined ? petPolicy : undefined,
      utilitiesIncluded: utilitiesIncluded !== undefined ? utilitiesIncluded : undefined,
      autoRenew,
      status,
    },
  });
  res.json(updated);
});

module.exports = router;
