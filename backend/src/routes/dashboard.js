const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { addDays, isAfter, isBefore, startOfMonth, endOfMonth } = require('date-fns');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/dashboard/manager
router.get('/manager', authenticate, requireRole('MANAGER'), async (req, res) => {
  const managerId = req.user.id;
  const now = new Date();
  const sixtyDaysOut = addDays(now, 60);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // All units in portfolio
  const properties = await prisma.property.findMany({
    where: { managerId },
    include: {
      units: {
        include: {
          lease: {
            include: {
              tenant: { select: { firstName: true, lastName: true, email: true } },
              payments: { orderBy: { dueDate: 'desc' }, take: 1 },
            },
          },
        },
      },
    },
  });

  const allUnits = properties.flatMap((p) => p.units);
  const occupiedUnits = allUnits.filter((u) => u.status === 'OCCUPIED');
  const vacantUnits = allUnits.filter((u) => u.status === 'VACANT');
  const occupancyRate = allUnits.length > 0 ? Math.round((occupiedUnits.length / allUnits.length) * 100) : 0;

  // Leases expiring within 60 days
  const expiringLeases = await prisma.lease.findMany({
    where: {
      unit: { property: { managerId } },
      endDate: { gte: now, lte: sixtyDaysOut },
      status: 'ACTIVE',
    },
    include: {
      tenant: { select: { firstName: true, lastName: true, email: true } },
      unit: { include: { property: { select: { name: true } } } },
    },
    orderBy: { endDate: 'asc' },
  });

  // Past due rent — payments that are due and not completed
  const pastDuePayments = await prisma.payment.findMany({
    where: {
      lease: { unit: { property: { managerId } } },
      dueDate: { lt: now },
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    include: {
      tenant: { select: { firstName: true, lastName: true, email: true } },
      lease: { include: { unit: { include: { property: { select: { name: true } } } } } },
    },
  });
  const pastDueTotal = pastDuePayments.reduce((sum, p) => sum + p.amount, 0);

  // This month's collected rent
  const collectedPayments = await prisma.payment.findMany({
    where: {
      lease: { unit: { property: { managerId } } },
      status: 'COMPLETED',
      paidAt: { gte: monthStart, lte: monthEnd },
    },
  });
  const collectedThisMonth = collectedPayments.reduce((sum, p) => sum + p.amount, 0);

  // Open maintenance requests
  const openMaintenance = await prisma.maintenanceRequest.count({
    where: {
      unit: { property: { managerId } },
      status: { in: ['OPEN', 'DISPATCHED', 'IN_PROGRESS'] },
    },
  });

  // Recent notifications
  const notifications = await prisma.notification.findMany({
    where: { userId: managerId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // 12-month cashflow: collected rent by month
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const allPayments = await prisma.payment.findMany({
    where: {
      lease: { unit: { property: { managerId } } },
      createdAt: { gte: twelveMonthsAgo },
    },
    select: { amount: true, status: true, dueDate: true, paidAt: true, createdAt: true, notes: true },
  });

  const monthlyMap = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    monthlyMap[key] = { month: label, collected: 0, due: 0, lateFees: 0 };
  }

  for (const p of allPayments) {
    const ref = p.paidAt || p.dueDate;
    const key = `${new Date(ref).getFullYear()}-${String(new Date(ref).getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[key]) continue;
    if (p.notes === 'Late fee') {
      if (p.status === 'COMPLETED') monthlyMap[key].lateFees += p.amount;
    } else {
      monthlyMap[key].due += p.amount;
      if (p.status === 'COMPLETED') monthlyMap[key].collected += p.amount;
    }
  }

  const cashflowByMonth = Object.values(monthlyMap);

  // Annual totals
  const annualCollected = cashflowByMonth.reduce((s, m) => s + m.collected, 0);
  const annualDue = cashflowByMonth.reduce((s, m) => s + m.due, 0);
  const annualLateFees = cashflowByMonth.reduce((s, m) => s + m.lateFees, 0);

  // Payment status breakdown for pie chart
  const paymentStatusCounts = { COMPLETED: 0, PENDING: 0, PROCESSING: 0, FAILED: 0 };
  for (const p of allPayments) {
    if (p.notes !== 'Late fee') paymentStatusCounts[p.status] = (paymentStatusCounts[p.status] || 0) + 1;
  }

  res.json({
    stats: {
      totalUnits: allUnits.length,
      occupiedUnits: occupiedUnits.length,
      vacantUnits: vacantUnits.length,
      occupancyRate,
      pastDueTotal,
      pastDueCount: pastDuePayments.length,
      collectedThisMonth,
      openMaintenance,
      expiringLeasesCount: expiringLeases.length,
      annualCollected,
      annualDue,
      annualLateFees,
      totalProperties: properties.length,
    },
    cashflowByMonth,
    paymentStatusCounts,
    expiringLeases,
    pastDuePayments,
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      state: p.state,
      totalUnits: p.units.length,
      occupiedUnits: p.units.filter((u) => u.status === 'OCCUPIED').length,
      occupancyRate:
        p.units.length > 0
          ? Math.round((p.units.filter((u) => u.status === 'OCCUPIED').length / p.units.length) * 100)
          : 0,
      monthlyRentPotential: p.units.filter((u) => u.status === 'OCCUPIED').reduce((s, u) => s + (u.rentAmount || 0), 0),
    })),
    notifications,
  });
});

// GET /api/dashboard/tenant
router.get('/tenant', authenticate, requireRole('TENANT'), async (req, res) => {
  const lease = await prisma.lease.findUnique({
    where: { tenantId: req.user.id },
    include: {
      unit: { include: { property: { select: { name: true, address: true, city: true, state: true } } } },
      payments: { orderBy: { dueDate: 'desc' }, take: 6 },
    },
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const openMaintenance = await prisma.maintenanceRequest.count({
    where: { tenantId: req.user.id, status: { in: ['OPEN', 'DISPATCHED', 'IN_PROGRESS'] } },
  });

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { tenantId: req.user.id },
    select: { id: true, accountName: true, accountMask: true, institutionName: true, isDefault: true },
  });

  res.json({ lease, notifications, openMaintenance, bankAccounts });
});

// GET /api/dashboard/rent-roll  — this month's payment status for every unit
router.get('/rent-roll', authenticate, requireRole('MANAGER'), async (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const properties = await prisma.property.findMany({
    where: { managerId: req.user.id },
    include: {
      units: {
        include: {
          lease: {
            include: {
              tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
              payments: {
                where: { dueDate: { gte: monthStart, lte: monthEnd } },
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
        orderBy: { unitNumber: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const rows = [];

  for (const prop of properties) {
    for (const unit of prop.units) {
      if (!unit.lease) {
        rows.push({
          propertyName: prop.name,
          unitNumber: unit.unitNumber,
          unitId: unit.id,
          status: 'VACANT',
          tenant: null,
          rentAmount: unit.rentAmount,
          dueDate: null,
          daysLate: 0,
          payment: null,
        });
        continue;
      }

      const lease = unit.lease;
      const dueDay = lease.rentDueDay || 1;
      const dueDate = new Date(year, month, dueDay);

      const completedPayment = lease.payments.find((p) => p.status === 'COMPLETED' && p.notes !== 'Late fee' && p.notes !== 'Overdue notice');
      const pendingPayment = lease.payments.find((p) => (p.status === 'PENDING' || p.status === 'PROCESSING') && p.notes !== 'Late fee' && p.notes !== 'Overdue notice');

      let payStatus;
      let daysLate = 0;
      if (completedPayment) {
        payStatus = 'PAID';
      } else if (pendingPayment) {
        payStatus = 'PENDING';
      } else if (now > dueDate) {
        payStatus = 'OVERDUE';
        daysLate = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
      } else {
        payStatus = 'UPCOMING';
      }

      rows.push({
        propertyName: prop.name,
        unitNumber: unit.unitNumber,
        unitId: unit.id,
        leaseId: lease.id,
        status: payStatus,
        tenant: lease.tenant,
        rentAmount: lease.rentAmount,
        dueDay,
        dueDate: dueDate.toISOString(),
        daysLate,
        lateFee: lease.lateFee,
        graceDays: lease.lateFeeGraceDays,
        payment: completedPayment || pendingPayment || null,
      });
    }
  }

  const summary = {
    total: rows.length,
    paid: rows.filter((r) => r.status === 'PAID').length,
    pending: rows.filter((r) => r.status === 'PENDING').length,
    overdue: rows.filter((r) => r.status === 'OVERDUE').length,
    upcoming: rows.filter((r) => r.status === 'UPCOMING').length,
    vacant: rows.filter((r) => r.status === 'VACANT').length,
    totalCollected: rows.filter((r) => r.status === 'PAID').reduce((s, r) => s + (r.payment?.amount || r.rentAmount), 0),
    totalExpected: rows.filter((r) => r.status !== 'VACANT').reduce((s, r) => s + r.rentAmount, 0),
  };

  res.json({ rows, summary, month: now.toLocaleString('default', { month: 'long', year: 'numeric' }) });
});

module.exports = router;
