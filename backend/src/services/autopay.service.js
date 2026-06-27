const { PrismaClient } = require('@prisma/client');
const notificationService = require('./notifications.service');

const prisma = new PrismaClient();

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function hasPaymentThisMonth(payments, year, month) {
  return payments.some((p) => {
    const d = new Date(p.dueDate);
    return d.getFullYear() === year && d.getMonth() === month && ['COMPLETED', 'PROCESSING'].includes(p.status);
  });
}

// Runs daily — fires autopay for leases where today == rentDueDay
async function processAutopayments() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();

  const leases = await prisma.lease.findMany({
    where: { status: 'ACTIVE', autopay: true, autopayBankAccountId: { not: null } },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      unit: { include: { property: { select: { name: true, managerId: true, address: true } } } },
      payments: {
        where: {
          dueDate: {
            gte: new Date(year, month, 1),
            lt: new Date(year, month + 1, 1),
          },
        },
      },
      autopayBankAccount: true,
    },
  });

  const processed = [];
  const reminded = [];

  for (const lease of leases) {
    const dueDay = lease.rentDueDay || 1;

    // Only process on the due date
    if (todayDay !== dueDay) continue;

    // Already paid or processing this month
    if (hasPaymentThisMonth(lease.payments, year, month)) continue;

    const dueDate = new Date(year, month, dueDay);
    const monthName = dueDate.toLocaleString('default', { month: 'long' });
    const bank = lease.autopayBankAccount;

    if (!bank) continue;

    if (bank.manualEntry) {
      // Can't auto-debit manual accounts — send a reminder instead
      await notificationService.createNotification(prisma, {
        userId: lease.tenantId,
        title: 'Autopay Reminder',
        message: `Your autopay account (${bank.bankName || 'manual account'}) is set but can't auto-debit. Please pay your ${monthName} rent of $${lease.rentAmount.toFixed(2)} manually today.`,
        type: 'payment',
        linkTo: '/tenant/pay',
      });

      await notificationService.sendEmail({
        to: lease.tenant.email,
        subject: `Rent Due Today — ${monthName} ${year}`,
        text: `Hi ${lease.tenant.firstName},\n\nYour ${monthName} rent of $${lease.rentAmount.toFixed(2)} is due today.\n\nNote: Your saved bank account (manual entry) cannot be auto-debited. Please log in to pay manually.\n\nLogin at PropFlow to pay now.`,
      });

      reminded.push({ leaseId: lease.id, tenantId: lease.tenantId });
    } else {
      // Plaid-linked account — initiate ACH via Plaid (sandbox: mark as PROCESSING)
      const payment = await prisma.payment.create({
        data: {
          tenantId: lease.tenantId,
          leaseId: lease.id,
          amount: lease.rentAmount,
          method: 'ACH',
          status: 'PROCESSING',
          dueDate,
          notes: `Autopay — ${bank.bankName || 'Linked bank'} ••••${bank.accountMask || bank.accountNumberLast4 || '????'}`,
        },
      });

      // TODO: When Plaid ACH transfer API (Payment Initiation or Dwolla) is wired:
      // await plaid.transferCreate({ access_token: bank.plaidAccessToken, amount: lease.rentAmount, ... });
      // Then update payment.status to COMPLETED on webhook confirmation.

      await notificationService.createNotification(prisma, {
        userId: lease.tenantId,
        title: 'Autopay Initiated',
        message: `Your ${monthName} rent of $${lease.rentAmount.toFixed(2)} is being processed from ${bank.bankName || 'your linked bank'} ••••${bank.accountMask || ''}. It will clear in 1–3 business days.`,
        type: 'payment',
        linkTo: '/tenant/pay',
      });

      await notificationService.createNotification(prisma, {
        userId: lease.unit.property.managerId,
        title: 'Autopay Initiated',
        message: `${lease.tenant.firstName} ${lease.tenant.lastName}'s ${monthName} autopay of $${lease.rentAmount.toFixed(2)} (${lease.unit.property.name}) is processing.`,
        type: 'payment',
        linkTo: '/manager/finances',
      });

      await notificationService.sendEmail({
        to: lease.tenant.email,
        subject: `Autopay Initiated — ${monthName} Rent`,
        text: `Hi ${lease.tenant.firstName},\n\nYour ${monthName} rent of $${lease.rentAmount.toFixed(2)} has been automatically submitted from your linked bank account.\n\nPayment ID: ${payment.id}\nExpected: 1–3 business days\n\nIf you have questions, contact your property manager.`,
      });

      processed.push({ leaseId: lease.id, tenantId: lease.tenantId, amount: lease.rentAmount });
    }
  }

  return { processed, reminded };
}

// Runs daily — send autopay reminder 3 days before due date
async function sendAutopayReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();

  const leases = await prisma.lease.findMany({
    where: { status: 'ACTIVE', autopay: true, autopayBankAccountId: { not: null } },
    include: {
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
      unit: { include: { property: { select: { name: true } } } },
      payments: {
        where: {
          dueDate: {
            gte: new Date(year, month, 1),
            lt: new Date(year, month + 1, 1),
          },
        },
      },
      autopayBankAccount: true,
    },
  });

  const reminders = [];

  for (const lease of leases) {
    const dueDay = lease.rentDueDay || 1;
    const reminderDay = dueDay - 3;

    if (todayDay !== reminderDay || reminderDay < 1) continue;
    if (hasPaymentThisMonth(lease.payments, year, month)) continue;

    const dueDate = new Date(year, month, dueDay);
    const monthName = dueDate.toLocaleString('default', { month: 'long' });
    const bank = lease.autopayBankAccount;

    await notificationService.createNotification(prisma, {
      userId: lease.tenantId,
      title: 'Autopay in 3 Days',
      message: `Your ${monthName} rent of $${lease.rentAmount.toFixed(2)} will autopay on the ${dueDay}${ordinal(dueDay)} from ${bank?.bankName || 'your linked bank'} ••••${bank?.accountMask || ''}. Ensure funds are available.`,
      type: 'payment',
      linkTo: '/tenant/pay',
    });

    reminders.push({ leaseId: lease.id, tenantId: lease.tenantId });
  }

  return reminders;
}

module.exports = { processAutopayments, sendAutopayReminders };
