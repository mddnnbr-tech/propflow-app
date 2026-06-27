const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { documentUpload } = require('../middleware/upload');
const { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } = require('date-fns');
const aiService = require('../services/ai.service');
const storageService = require('../services/storage.service');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/expenses  — all expenses for manager
router.get('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { propertyId, year, month } = req.query;
  const now = new Date();
  const y = year ? parseInt(year) : now.getFullYear();
  const m = month ? parseInt(month) - 1 : null; // 0-indexed

  const dateFilter = m !== null
    ? { gte: new Date(y, m, 1), lt: new Date(y, m + 1, 1) }
    : { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) };

  const expenses = await prisma.expense.findMany({
    where: {
      managerId: req.user.id,
      ...(propertyId ? { propertyId } : {}),
      date: dateFilter,
    },
    include: { property: { select: { name: true } } },
    orderBy: { date: 'desc' },
  });
  res.json(expenses);
});

// POST /api/expenses
router.post('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { propertyId, category, amount, date, description, isRecurring, notes } = req.body;
  if (!category || !amount || !date) return res.status(400).json({ error: 'category, amount, date required' });

  // Verify property belongs to this manager if provided
  if (propertyId) {
    const prop = await prisma.property.findFirst({ where: { id: propertyId, managerId: req.user.id } });
    if (!prop) return res.status(404).json({ error: 'Property not found' });
  }

  const expense = await prisma.expense.create({
    data: {
      managerId: req.user.id,
      propertyId: propertyId || null,
      category,
      amount: parseFloat(amount),
      date: new Date(date),
      description: description || null,
      isRecurring: isRecurring || false,
      notes: notes || null,
    },
    include: { property: { select: { name: true } } },
  });
  res.status(201).json(expense);
});

// POST /api/expenses/:id/receipt — upload receipt photo
router.post(
  '/:id/receipt',
  authenticate,
  requireRole('MANAGER'),
  (req, res, next) => { req.uploadFolder = 'receipts'; next(); },
  documentUpload.single('receipt'),
  async (req, res) => {
    const expense = await prisma.expense.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const fileUrl = storageService.getFileUrl(req.file);
    const updated = await prisma.expense.update({ where: { id: req.params.id }, data: { receiptUrl: fileUrl } });
    res.json(updated);
  }
);

// PUT /api/expenses/:id
router.put('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const expense = await prisma.expense.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  const { category, amount, date, description, isRecurring, notes, propertyId } = req.body;
  const updated = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      category: category || undefined,
      amount: amount !== undefined ? parseFloat(amount) : undefined,
      date: date ? new Date(date) : undefined,
      description,
      isRecurring,
      notes,
      propertyId: propertyId !== undefined ? propertyId : undefined,
    },
    include: { property: { select: { name: true } } },
  });
  res.json(updated);
});

// DELETE /api/expenses/:id
router.delete('/:id', authenticate, requireRole('MANAGER'), async (req, res) => {
  const expense = await prisma.expense.findFirst({ where: { id: req.params.id, managerId: req.user.id } });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

// GET /api/expenses/profitability  — P&L summary with slicers
router.get('/profitability', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { propertyId, view } = req.query; // view: 'monthly' | 'annual'
  const now = new Date();
  const isAnnual = view === 'annual';

  // Build 12 months of data
  const periods = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(now, i);
    periods.push({
      key: format(d, 'yyyy-MM'),
      label: format(d, isAnnual ? 'yyyy' : 'MMM yy'),
      start: startOfMonth(d),
      end: endOfMonth(d),
      year: d.getFullYear(),
    });
  }

  // If annual, collapse to unique years
  const yearPeriods = isAnnual
    ? [...new Map(periods.map((p) => [p.year, { key: String(p.year), label: String(p.year), start: startOfYear(new Date(p.year, 0, 1)), end: endOfYear(new Date(p.year, 0, 1)), year: p.year }])).values()]
    : periods;

  const propertyFilter = propertyId
    ? { propertyId }
    : { property: { managerId: req.user.id } };

  const managerFilter = propertyId ? {} : { managerId: req.user.id };

  // Fetch all income (completed rent payments)
  const allPayments = await prisma.payment.findMany({
    where: {
      lease: { unit: { property: { managerId: req.user.id, ...(propertyId ? { id: propertyId } : {}) } } },
      status: 'COMPLETED',
      paidAt: { gte: yearPeriods[0].start, lte: yearPeriods[yearPeriods.length - 1].end },
    },
    select: { amount: true, paidAt: true, notes: true },
  });

  // Fetch all expenses
  const allExpenses = await prisma.expense.findMany({
    where: {
      managerId: req.user.id,
      ...(propertyId ? { propertyId } : {}),
      date: { gte: yearPeriods[0].start, lte: yearPeriods[yearPeriods.length - 1].end },
    },
    select: { amount: true, date: true, category: true },
  });

  // Fetch maintenance costs (completed with a cost)
  const maintenanceCosts = await prisma.maintenanceRequest.findMany({
    where: {
      unit: { property: { managerId: req.user.id, ...(propertyId ? { id: propertyId } : {}) } },
      cost: { not: null },
      completedAt: { gte: yearPeriods[0].start, lte: yearPeriods[yearPeriods.length - 1].end },
    },
    select: { cost: true, completedAt: true },
  });

  // Build period rows
  const chartData = yearPeriods.map((period) => {
    const periodIncome = allPayments
      .filter((p) => {
        const d = new Date(p.paidAt);
        return d >= period.start && d <= period.end && p.notes !== 'Late fee';
      })
      .reduce((s, p) => s + p.amount, 0);

    const lateFees = allPayments
      .filter((p) => {
        const d = new Date(p.paidAt);
        return d >= period.start && d <= period.end && p.notes === 'Late fee';
      })
      .reduce((s, p) => s + p.amount, 0);

    const periodExpenses = allExpenses
      .filter((e) => { const d = new Date(e.date); return d >= period.start && d <= period.end; })
      .reduce((s, e) => s + e.amount, 0);

    const periodMaintenance = maintenanceCosts
      .filter((m) => { const d = new Date(m.completedAt); return d >= period.start && d <= period.end; })
      .reduce((s, m) => s + (m.cost || 0), 0);

    const totalExpenses = periodExpenses + periodMaintenance;
    return {
      period: period.label,
      income: periodIncome,
      lateFees,
      expenses: totalExpenses,
      profit: periodIncome + lateFees - totalExpenses,
    };
  });

  // Expense breakdown by category (all time in range)
  const categoryTotals = {};
  for (const e of allExpenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  }
  const totalMaintCost = maintenanceCosts.reduce((s, m) => s + (m.cost || 0), 0);
  if (totalMaintCost > 0) categoryTotals['REPAIR'] = (categoryTotals['REPAIR'] || 0) + totalMaintCost;

  // Per-property breakdown (only if not already filtered)
  let byProperty = [];
  if (!propertyId) {
    const properties = await prisma.property.findMany({
      where: { managerId: req.user.id },
      include: {
        units: { include: { lease: true } },
        expenses: { where: { date: { gte: yearPeriods[0].start, lte: yearPeriods[yearPeriods.length - 1].end } } },
      },
    });

    for (const p of properties) {
      const propIncome = allPayments
        .filter((pay) => {
          // We'd need to join through lease → unit → property which is tricky here
          // Using a simpler approach: sum from the expenses model
          return true; // We'll handle this differently
        }).reduce((s) => s, 0);

      const propExpenses = p.expenses.reduce((s, e) => s + e.amount, 0);
      const monthlyRent = p.units
        .filter((u) => u.status === 'OCCUPIED')
        .reduce((s, u) => s + (u.rentAmount || 0), 0);

      byProperty.push({
        id: p.id,
        name: p.name,
        monthlyRentPotential: monthlyRent,
        totalExpenses: propExpenses,
        acquisitionCost: p.acquisitionCost,
        acquisitionDate: p.acquisitionDate,
        currentValue: p.currentValue,
        currentValueSource: p.currentValueSource,
        currentValueUpdatedAt: p.currentValueUpdatedAt,
        currentValueNotes: p.currentValueNotes,
      });
    }
  }

  // Totals
  const totalIncome = chartData.reduce((s, d) => s + d.income + d.lateFees, 0);
  const totalExpensesAll = chartData.reduce((s, d) => s + d.expenses, 0);
  const totalProfit = totalIncome - totalExpensesAll;

  res.json({
    chartData,
    categoryTotals,
    byProperty,
    totals: { income: totalIncome, expenses: totalExpensesAll, profit: totalProfit },
    view: isAnnual ? 'annual' : 'monthly',
  });
});

// POST /api/expenses/research-value/:propertyId  — AI researches current market value
router.post('/research-value/:propertyId', authenticate, requireRole('MANAGER'), async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.propertyId, managerId: req.user.id },
  });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  try {
    const result = await aiService.researchPropertyValue(
      property.address,
      property.city,
      property.state,
      property.zip,
    );

    // Save to property
    await prisma.property.update({
      where: { id: property.id },
      data: {
        currentValue: result.estimatedValue,
        currentValueUpdatedAt: new Date(),
        currentValueSource: 'AI_RESEARCH',
        currentValueNotes: result.summary,
      },
    });

    res.json(result);
  } catch (err) {
    console.error('Property research error:', err.message);
    res.status(500).json({ error: 'Research failed: ' + err.message });
  }
});

// PUT /api/expenses/property-equity/:propertyId  — manager sets acquisition info or manual current value
router.put('/property-equity/:propertyId', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { acquisitionCost, acquisitionDate, currentValue } = req.body;
  const property = await prisma.property.findFirst({
    where: { id: req.params.propertyId, managerId: req.user.id },
  });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const updated = await prisma.property.update({
    where: { id: req.params.propertyId },
    data: {
      acquisitionCost: acquisitionCost !== undefined ? parseFloat(acquisitionCost) : undefined,
      acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : undefined,
      ...(currentValue !== undefined ? {
        currentValue: parseFloat(currentValue),
        currentValueUpdatedAt: new Date(),
        currentValueSource: 'MANUAL',
      } : {}),
    },
  });
  res.json(updated);
});

module.exports = router;
