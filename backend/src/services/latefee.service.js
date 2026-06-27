const { PrismaClient } = require('@prisma/client');
const notificationService = require('./notifications.service');

const prisma = new PrismaClient();

// Fetch all active leases with payment data for this month
async function getActiveLeasesWithPayments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return prisma.lease.findMany({
    where: { status: 'ACTIVE' },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
      unit: { include: { property: { select: { name: true, managerId: true } } } },
      payments: {
        where: { dueDate: { lte: today } },
        orderBy: { dueDate: 'desc' },
      },
    },
  });
}

function hasCompletedPaymentThisMonth(payments, year, month) {
  return payments.some((p) => {
    const d = new Date(p.dueDate);
    return d.getFullYear() === year && d.getMonth() === month && p.status === 'COMPLETED';
  });
}

function hasLateFeeThisMonth(payments, year, month) {
  return payments.some((p) => {
    const d = new Date(p.createdAt);
    return d.getFullYear() === year && d.getMonth() === month && p.notes === 'Late fee';
  });
}

function hasOverdueNotificationThisMonth(payments, year, month) {
  return payments.some((p) => {
    const d = new Date(p.createdAt);
    return d.getFullYear() === year && d.getMonth() === month && p.notes === 'Overdue notice';
  });
}

// Step 1: Fire "Rent Overdue" notifications on or after the due date (before late fee grace)
async function assessOverdueRent() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();

  const leases = await getActiveLeasesWithPayments();
  const notified = [];

  for (const lease of leases) {
    const dueDay = lease.rentDueDay || 1;
    const currentMonthDue = new Date(year, month, dueDay);

    // Not yet due this month
    if (today < currentMonthDue) continue;

    const paid = hasCompletedPaymentThisMonth(lease.payments, year, month);
    if (paid) continue;

    const alreadyNotified = hasOverdueNotificationThisMonth(lease.payments, year, month);
    if (alreadyNotified) continue;

    // Create a placeholder record so we don't double-notify
    await prisma.payment.create({
      data: {
        tenantId: lease.tenantId,
        leaseId: lease.id,
        amount: 0,
        method: 'ACH',
        status: 'PENDING',
        dueDate: currentMonthDue,
        notes: 'Overdue notice',
      },
    });

    const monthName = currentMonthDue.toLocaleString('default', { month: 'long' });

    await notificationService.createNotification(prisma, {
      userId: lease.tenantId,
      title: 'Rent Overdue',
      message: `Your ${monthName} rent of $${lease.rentAmount.toFixed(2)} was due on the ${dueDay}${ordinal(dueDay)}. Please pay now to avoid a late fee.`,
      type: 'payment',
      linkTo: '/tenant/pay',
    });

    await notificationService.createNotification(prisma, {
      userId: lease.unit.property.managerId,
      title: 'Rent Overdue',
      message: `${lease.tenant.firstName} ${lease.tenant.lastName} (${lease.unit.property.name}) has not paid ${monthName} rent of $${lease.rentAmount.toFixed(2)}.`,
      type: 'payment',
      linkTo: '/manager/finances',
    });

    notified.push({ leaseId: lease.id, tenantId: lease.tenantId });
  }

  return notified;
}

// Step 2: Assess late fees after grace period
async function assessLateFees() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();

  const leases = await getActiveLeasesWithPayments();
  const assessed = [];

  for (const lease of leases) {
    const lateFee = lease.lateFee;
    const graceDays = lease.lateFeeGraceDays ?? 5;
    const dueDay = lease.rentDueDay || 1;

    if (!lateFee || lateFee <= 0) continue;

    const currentMonthDeadline = new Date(year, month, dueDay + graceDays);
    if (today < currentMonthDeadline) continue;

    const paid = hasCompletedPaymentThisMonth(lease.payments, year, month);
    if (paid) continue;

    const alreadyCharged = hasLateFeeThisMonth(lease.payments, year, month);
    if (alreadyCharged) continue;

    const currentMonthDue = new Date(year, month, dueDay);

    await prisma.payment.create({
      data: {
        tenantId: lease.tenantId,
        leaseId: lease.id,
        amount: lateFee,
        method: 'ACH',
        status: 'PENDING',
        dueDate: currentMonthDue,
        notes: 'Late fee',
      },
    });

    const monthName = currentMonthDue.toLocaleString('default', { month: 'long' });

    await notificationService.createNotification(prisma, {
      userId: lease.tenantId,
      title: 'Late Fee Applied',
      message: `A late fee of $${lateFee.toFixed(2)} has been applied to your account for ${monthName} rent.`,
      type: 'payment',
      linkTo: '/tenant/pay',
    });

    await notificationService.createNotification(prisma, {
      userId: lease.unit.property.managerId,
      title: 'Late Fee Assessed',
      message: `A $${lateFee.toFixed(2)} late fee was applied to ${lease.tenant.firstName} ${lease.tenant.lastName} (${lease.unit.property.name}).`,
      type: 'payment',
      linkTo: '/manager/finances',
    });

    assessed.push({ leaseId: lease.id, tenantId: lease.tenantId, amount: lateFee });
  }

  return assessed;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

module.exports = { assessLateFees, assessOverdueRent };
