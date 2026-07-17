const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const storageService = require('../services/storage.service');
const aiService = require('../services/ai.service');

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

// POST /api/vendors/import-file — upload a preferred vendor list (PDF, image, CSV)
// Extracts vendors from the document and returns them for review (does NOT save yet)
router.post(
  '/import-file',
  authenticate,
  requireRole('MANAGER'),
  (req, res, next) => { req.uploadFolder = 'vendor-lists'; next(); },
  documentUpload.single('file'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let vendors = [];
    try {
      vendors = await aiService.extractVendorList(req.file.path, req.file.originalname);
    } catch (err) {
      console.error('Vendor list extraction error:', err.message);
      return res.status(422).json({ error: 'Could not read a vendor list from that file. Try a clearer PDF or a CSV.' });
    }

    if (!vendors.length) {
      return res.status(422).json({ error: 'No vendors found in that file. Make sure it lists vendor names and trades.' });
    }

    res.json({ vendors, fileUrl: storageService.getFileUrl(req.file) });
  }
);

// GET /api/vendors/export — download vendor list as CSV (opens in Excel)
router.get('/export', authenticate, requireRole('MANAGER'), async (req, res) => {
  const vendors = await prisma.vendor.findMany({
    where: { managerId: req.user.id },
    orderBy: [{ isPreferred: 'desc' }, { trade: 'asc' }, { name: 'asc' }],
  });

  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = 'Name,Trade,Phone,Email,Address,License #,Preferred,Auto-Dispatch,Rating,Jobs Completed Threshold,Notes';
  const lines = vendors.map((v) =>
    [v.name, v.trade, v.phone, v.email, v.address, v.licenseNumber, v.isPreferred ? 'Yes' : 'No', v.autoDispatch ? 'Yes' : 'No', v.rating, v.costThreshold, v.notes].map(esc).join(',')
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="propflow-vendors-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('﻿' + [header, ...lines].join('\r\n'));
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
