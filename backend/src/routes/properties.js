const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/properties  — manager sees all their properties
router.get('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const properties = await prisma.property.findMany({
    where: { managerId: req.user.id },
    include: {
      units: {
        include: { lease: { include: { tenant: { select: { firstName: true, lastName: true, email: true } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(properties);
});

// GET /api/properties/:id
router.get('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, managerId: req.user.id },
    include: {
      units: {
        include: {
          lease: { include: { tenant: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
          maintenanceRequests: { where: { status: { not: 'COMPLETED' } }, take: 5 },
        },
      },
    },
  });
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(property);
});

// POST /api/properties
router.post('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { name, address, city, state, zip, units } = req.body;

  const property = await prisma.property.create({
    data: {
      managerId: req.user.id,
      name,
      address,
      city,
      state,
      zip,
      units: units
        ? {
            create: units.map((u) => ({
              unitNumber: u.unitNumber,
              bedrooms: u.bedrooms || 1,
              bathrooms: u.bathrooms || 1,
              sqft: u.sqft,
              rentAmount: u.rentAmount,
            })),
          }
        : undefined,
    },
    include: { units: true },
  });

  res.status(201).json(property);
});

// PUT /api/properties/:id
router.put('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { name, address, city, state, zip } = req.body;

  const property = await prisma.property.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const updated = await prisma.property.update({
    where: { id: req.params.id },
    data: { name, address, city, state, zip },
    include: { units: true },
  });
  res.json(updated);
});

// DELETE /api/properties/:id
router.delete('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  await prisma.property.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

// POST /api/properties/:propertyId/units
router.post('/:propertyId/units', authenticate, requireRole('MANAGER'), async (req, res) => {
  const property = await prisma.property.findFirst({ where: { id: req.params.propertyId, managerId: req.user.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const { unitNumber, bedrooms, bathrooms, sqft, rentAmount } = req.body;
  const unit = await prisma.unit.create({
    data: { propertyId: req.params.propertyId, unitNumber, bedrooms, bathrooms, sqft, rentAmount },
  });
  res.status(201).json(unit);
});

// PUT /api/properties/units/:unitId
router.put('/units/:unitId', authenticate, requireRole('MANAGER'), async (req, res) => {
  const unit = await prisma.unit.findFirst({
    where: { id: req.params.unitId },
    include: { property: true },
  });
  if (!unit || unit.property.managerId !== req.user.id) {
    return res.status(404).json({ error: 'Unit not found' });
  }

  const { unitNumber, bedrooms, bathrooms, sqft, rentAmount, status } = req.body;
  const updated = await prisma.unit.update({
    where: { id: req.params.unitId },
    data: { unitNumber, bedrooms, bathrooms, sqft, rentAmount, status },
  });
  res.json(updated);
});

// DELETE /api/properties/units/:unitId
router.delete('/units/:unitId', authenticate, requireRole('MANAGER'), async (req, res) => {
  const unit = await prisma.unit.findFirst({
    where: { id: req.params.unitId },
    include: { property: true },
  });
  if (!unit || unit.property.managerId !== req.user.id) {
    return res.status(404).json({ error: 'Unit not found' });
  }
  await prisma.unit.delete({ where: { id: req.params.unitId } });
  res.json({ message: 'Deleted' });
});

module.exports = router;
