const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const storageService = require('../services/storage.service');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/vendors
router.get('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const vendors = await prisma.vendor.findMany({
    where: { managerId: req.user.id },
    include: { _count: { select: { maintenanceRequests: true } } },
    orderBy: [{ isPreferred: 'desc' }, { name: 'asc' }],
  });
  res.json(vendors);
});

// POST /api/vendors — create single vendor
router.post('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { name, trade, phone, email, address, licenseNumber, notes, isPreferred, autoDispatch, rating, costThreshold, paymentInfo } = req.body;
  const vendor = await prisma.vendor.create({
    data: {
      managerId: req.user.id,
      name, trade, phone, email, address, licenseNumber, notes,
      isPreferred: isPreferred ?? true,
      autoDispatch: autoDispatch ?? false,
      rating,
      costThreshold: costThreshold ? parseFloat(costThreshold) : null,
      paymentInfo: paymentInfo || null,
    },
  });
  res.status(201).json(vendor);
});

// POST /api/vendors/bulk — import multiple vendors from CSV/JSON body
// Accepts: [{ name, trade, phone, email, address, licenseNumber, isPreferred, autoDispatch }]
router.post('/bulk', authenticate, requireRole('MANAGER'), async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Body must be a non-empty array of vendor objects' });
  }
  if (rows.length > 200) {
    return res.status(400).json({ error: 'Maximum 200 vendors per import' });
  }

  const data = rows.map((r) => ({
    managerId: req.user.id,
    name: r.name?.trim(),
    trade: r.trade?.trim(),
    phone: r.phone?.trim() || '',
    email: r.email?.trim() || null,
    address: r.address?.trim() || null,
    licenseNumber: r.licenseNumber?.trim() || null,
    notes: r.notes?.trim() || null,
    isPreferred: r.isPreferred !== false,
    autoDispatch: r.autoDispatch === true,
    rating: r.rating ? parseFloat(r.rating) : null,
  }));

  const invalid = data.filter((r) => !r.name || !r.trade);
  if (invalid.length > 0) {
    return res.status(400).json({ error: `${invalid.length} rows are missing name or trade` });
  }

  const result = await prisma.vendor.createMany({ data, skipDuplicates: false });
  res.status(201).json({ created: result.count });
});

// PUT /api/vendors/:id
router.put('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const vendor = await prisma.vendor.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const { name, trade, phone, email, address, licenseNumber, notes, isPreferred, autoDispatch, rating, costThreshold, paymentInfo } = req.body;
  const updated = await prisma.vendor.update({
    where: { id: req.params.id },
    data: {
      name, trade, phone, email, address, licenseNumber, notes, isPreferred, autoDispatch, rating,
      costThreshold: costThreshold !== undefined ? (costThreshold ? parseFloat(costThreshold) : null) : undefined,
      paymentInfo: paymentInfo !== undefined ? paymentInfo : undefined,
    },
  });
  res.json(updated);
});

// POST /api/vendors/:id/contract — upload a service agreement / contract PDF for this vendor
router.post(
  '/:id/contract',
  authenticate,
  requireRole('MANAGER'),
  (req, res, next) => { req.uploadFolder = 'vendor-contracts'; next(); },
  documentUpload.single('contract'),
  async (req, res) => {
    const vendor = await prisma.vendor.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const contractUrl = storageService.getFileUrl(req.file);
    const updated = await prisma.vendor.update({
      where: { id: req.params.id },
      data: { contractUrl },
    });
    res.json(updated);
  }
);

// DELETE /api/vendors/:id
router.delete('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const vendor = await prisma.vendor.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  await prisma.vendor.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

module.exports = router;
