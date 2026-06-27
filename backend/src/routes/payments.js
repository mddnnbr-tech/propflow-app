const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { imageUpload } = require('../middleware/upload');
const { startOfMonth, endOfMonth } = require('date-fns');
const plaidService = require('../services/plaid.service');
const stripeService = require('../services/stripe.service');
const aiService = require('../services/ai.service');
const notificationService = require('../services/notifications.service');
const storageService = require('../services/storage.service');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/payments  — manager sees all payments across portfolio
router.get('/', authenticate, requireRole('MANAGER'), async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { lease: { unit: { property: { managerId: req.user.id } } } },
    include: {
      tenant: { select: { firstName: true, lastName: true, email: true } },
      lease: { include: { unit: { include: { property: { select: { name: true } } } } } },
    },
    orderBy: { dueDate: 'desc' },
  });
  res.json(payments);
});

// GET /api/payments/my  — tenant sees their own payment history
router.get('/my', authenticate, requireRole('TENANT'), async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { tenantId: req.user.id },
    orderBy: { dueDate: 'desc' },
  });
  res.json(payments);
});

// ────────────────────────────────────────────────────────────
// PLAID — Bank Account Linking
// ────────────────────────────────────────────────────────────

router.post('/plaid/link-token', authenticate, requireRole('TENANT'), async (req, res) => {
  const token = await plaidService.createLinkToken(req.user.id, req.user.email);
  res.json({ linkToken: token });
});

router.post('/plaid/exchange', authenticate, requireRole('TENANT'), async (req, res) => {
  const { publicToken, metadata } = req.body;
  const { accessToken, itemId, accounts } = await plaidService.exchangePublicToken(publicToken);

  const account = accounts[0];
  const bankAccount = await prisma.bankAccount.create({
    data: {
      tenantId: req.user.id,
      plaidAccessToken: accessToken,
      plaidItemId: itemId,
      plaidAccountId: account.account_id,
      accountName: account.name,
      accountMask: account.mask || '',
      institutionName: metadata?.institution?.name || 'Bank',
      isDefault: true,
    },
  });

  await prisma.bankAccount.updateMany({
    where: { tenantId: req.user.id, id: { not: bankAccount.id } },
    data: { isDefault: false },
  });

  res.json({ bankAccount: { id: bankAccount.id, accountName: bankAccount.accountName, accountMask: bankAccount.accountMask, institutionName: bankAccount.institutionName } });
});

// ────────────────────────────────────────────────────────────
// Manual ACH — tenant enters routing + account number directly
// ────────────────────────────────────────────────────────────

router.post('/bank-accounts/manual', authenticate, requireRole('TENANT'), async (req, res) => {
  const { routingNumber, accountNumber, accountName, institutionName } = req.body;
  if (!routingNumber || !accountNumber || !accountName) {
    return res.status(400).json({ error: 'routingNumber, accountNumber, accountName required' });
  }
  if (!/^\d{9}$/.test(routingNumber)) {
    return res.status(400).json({ error: 'Routing number must be exactly 9 digits' });
  }
  if (accountNumber.length < 4 || accountNumber.length > 17) {
    return res.status(400).json({ error: 'Account number must be 4-17 digits' });
  }

  const last4 = accountNumber.slice(-4);
  const bankAccount = await prisma.bankAccount.create({
    data: {
      tenantId: req.user.id,
      routingNumber, // stored for ACH initiation
      accountNumberLast4: last4,
      accountName,
      accountMask: last4,
      institutionName: institutionName || 'Bank',
      manualEntry: true,
      isDefault: true,
    },
  });

  await prisma.bankAccount.updateMany({
    where: { tenantId: req.user.id, id: { not: bankAccount.id } },
    data: { isDefault: false },
  });

  res.json({
    bankAccount: {
      id: bankAccount.id,
      accountName: bankAccount.accountName,
      accountMask: last4,
      institutionName: bankAccount.institutionName,
      manualEntry: true,
    },
  });
});

// GET /api/payments/bank-accounts
router.get('/bank-accounts', authenticate, requireRole('TENANT'), async (req, res) => {
  const accounts = await prisma.bankAccount.findMany({
    where: { tenantId: req.user.id },
    select: { id: true, accountName: true, accountMask: true, institutionName: true, isDefault: true, autopay: true, manualEntry: true },
  });
  res.json(accounts);
});

// DELETE /api/payments/bank-accounts/:id
router.delete('/bank-accounts/:id', authenticate, requireRole('TENANT'), async (req, res) => {
  await prisma.bankAccount.deleteMany({ where: { id: req.params.id, tenantId: req.user.id } });
  res.json({ message: 'Bank account removed' });
});

// PATCH /api/payments/bank-accounts/:id/autopay  — toggle autopay on an account
router.patch('/bank-accounts/:id/autopay', authenticate, requireRole('TENANT'), async (req, res) => {
  const { enabled } = req.body;
  const account = await prisma.bankAccount.findFirst({ where: { id: req.params.id, tenantId: req.user.id } });
  if (!account) return res.status(404).json({ error: 'Account not found' });

  await prisma.bankAccount.update({ where: { id: req.params.id }, data: { autopay: enabled } });

  // Update lease autopay flag
  const lease = await prisma.lease.findUnique({ where: { tenantId: req.user.id } });
  if (lease) {
    await prisma.lease.update({
      where: { id: lease.id },
      data: { autopay: enabled, autopayBankAccountId: enabled ? account.id : null },
    });
  }

  // Notify manager
  const manager = await prisma.user.findFirst({
    where: { properties: { some: { units: { some: { lease: { tenantId: req.user.id } } } } } },
  });
  if (manager) {
    await notificationService.createNotification(prisma, {
      userId: manager.id,
      title: enabled ? 'Autopay Enabled' : 'Autopay Disabled',
      message: `${req.user.firstName} ${req.user.lastName} has ${enabled ? 'enabled' : 'disabled'} autopay for their rent.`,
      type: 'payment',
    });
  }

  res.json({ autopay: enabled });
});

// ────────────────────────────────────────────────────────────
// Stripe — Apple Pay / Card
// ────────────────────────────────────────────────────────────

router.post('/stripe/create-intent', authenticate, requireRole('TENANT'), async (req, res) => {
  if (!stripeService.isConfigured()) {
    return res.status(503).json({ error: 'Apple Pay / card payments are not yet configured. Please use bank transfer or contact your property manager.' });
  }
  const lease = await prisma.lease.findUnique({ where: { tenantId: req.user.id } });
  if (!lease) return res.status(404).json({ error: 'No active lease found' });

  const amount = req.body.amount || lease.rentAmount;
  const { clientSecret, intentId } = await stripeService.createPaymentIntent({
    amount,
    metadata: { tenantId: req.user.id, leaseId: lease.id, purpose: 'rent' },
  });

  res.json({ clientSecret, publishableKey: process.env.STRIPE_PUBLISHABLE_KEY, amount });
});

router.post('/stripe/confirm', authenticate, requireRole('TENANT'), async (req, res) => {
  const { intentId, amount } = req.body;
  const lease = await prisma.lease.findUnique({ where: { tenantId: req.user.id } });
  if (!lease) return res.status(404).json({ error: 'No active lease found' });

  const intent = await stripeService.retrievePaymentIntent(intentId);
  if (intent.status !== 'succeeded') {
    return res.status(400).json({ error: 'Payment not completed' });
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId: req.user.id,
      leaseId: lease.id,
      amount: amount || lease.rentAmount,
      method: 'APPLE_PAY',
      status: 'COMPLETED',
      dueDate: new Date(),
      paidAt: new Date(),
      notes: `Stripe PaymentIntent: ${intentId}`,
    },
  });

  const manager = await prisma.user.findFirst({
    where: { properties: { some: { units: { some: { lease: { id: lease.id } } } } } },
  });
  if (manager) {
    await notificationService.createNotification(prisma, {
      userId: manager.id,
      title: 'Rent Payment Received',
      message: `Apple Pay / card payment of $${payment.amount} completed by tenant.`,
      type: 'payment',
    });
  }

  res.status(201).json(payment);
});

// ────────────────────────────────────────────────────────────
// Venmo / Zelle — get manager's handle, tenant confirms payment
// ────────────────────────────────────────────────────────────

// GET /api/payments/instant-pay-info  — returns manager's Venmo/Zelle info
router.get('/instant-pay-info', authenticate, requireRole('TENANT'), async (req, res) => {
  const manager = await prisma.user.findFirst({
    where: { properties: { some: { units: { some: { lease: { tenantId: req.user.id } } } } } },
    select: { venmoHandle: true, zelleInfo: true, firstName: true, lastName: true },
  });
  res.json(manager || {});
});

// POST /api/payments/venmo-confirm  — tenant confirms they sent payment via Venmo/Zelle
router.post(
  '/venmo-confirm',
  authenticate,
  requireRole('TENANT'),
  (req, res, next) => { req.uploadFolder = 'venmo'; next(); },
  imageUpload.single('screenshot'),
  async (req, res) => {
    const { method, amount, confirmationId } = req.body;
    const lease = await prisma.lease.findUnique({ where: { tenantId: req.user.id } });
    if (!lease) return res.status(404).json({ error: 'No active lease found' });

    const screenshotUrl = req.file ? storageService.getFileUrl(req.file) : null;

    const payment = await prisma.payment.create({
      data: {
        tenantId: req.user.id,
        leaseId: lease.id,
        amount: parseFloat(amount) || lease.rentAmount,
        method: method === 'ZELLE' ? 'ZELLE' : 'VENMO',
        status: 'PROCESSING',
        dueDate: new Date(),
        notes: [
          confirmationId ? `Confirmation: ${confirmationId}` : null,
          screenshotUrl ? `Screenshot: ${screenshotUrl}` : null,
        ].filter(Boolean).join(' | '),
      },
    });

    const manager = await prisma.user.findFirst({
      where: { properties: { some: { units: { some: { lease: { id: lease.id } } } } } },
    });
    if (manager) {
      await notificationService.createNotification(prisma, {
        userId: manager.id,
        title: `${method === 'ZELLE' ? 'Zelle' : 'Venmo'} Payment — Please Verify`,
        message: `Tenant reports sending $${payment.amount} via ${method === 'ZELLE' ? 'Zelle' : 'Venmo'}. ${confirmationId ? `Confirmation ID: ${confirmationId}` : 'No confirmation ID provided.'} Please verify and mark paid.`,
        type: 'payment',
        linkTo: '/manager/finances',
      });
    }

    res.status(201).json(payment);
  }
);

// ────────────────────────────────────────────────────────────
// ACH Payment (Plaid bank transfer)
// ────────────────────────────────────────────────────────────

router.post('/ach', authenticate, requireRole('TENANT'), async (req, res) => {
  const { bankAccountId, amount, notes } = req.body;

  const lease = await prisma.lease.findUnique({ where: { tenantId: req.user.id } });
  if (!lease) return res.status(404).json({ error: 'No active lease found' });

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { id: bankAccountId, tenantId: req.user.id },
  });
  if (!bankAccount) return res.status(404).json({ error: 'Bank account not found' });

  // Manual-entry accounts: record as PENDING (manager processes manually)
  if (bankAccount.manualEntry) {
    const payment = await prisma.payment.create({
      data: {
        tenantId: req.user.id,
        leaseId: lease.id,
        amount: amount || lease.rentAmount,
        method: 'ACH',
        status: 'PROCESSING',
        dueDate: new Date(),
        notes: `Manual ACH — routing on file, acct ••••${bankAccount.accountNumberLast4}`,
      },
    });
    const manager = await prisma.user.findFirst({
      where: { properties: { some: { units: { some: { lease: { id: lease.id } } } } } },
    });
    if (manager) {
      await notificationService.createNotification(prisma, {
        userId: manager.id,
        title: 'ACH Transfer Initiated',
        message: `Manual ACH of $${payment.amount} initiated by tenant (acct ••••${bankAccount.accountNumberLast4}).`,
        type: 'payment',
      });
    }
    return res.status(201).json(payment);
  }

  // Plaid ACH
  let plaidTxId = null;
  try {
    plaidTxId = await plaidService.initiateACH({
      accessToken: bankAccount.plaidAccessToken,
      accountId: bankAccount.plaidAccountId,
      amount: amount || lease.rentAmount,
    });
  } catch (err) {
    console.error('Plaid ACH error:', err.message);
    return res.status(502).json({ error: 'Bank transfer initiation failed: ' + err.message });
  }

  const payment = await prisma.payment.create({
    data: {
      tenantId: req.user.id,
      leaseId: lease.id,
      amount: amount || lease.rentAmount,
      method: 'ACH',
      status: 'PROCESSING',
      dueDate: new Date(),
      plaidTransactionId: plaidTxId,
      notes,
    },
  });

  const manager = await prisma.user.findFirst({
    where: { properties: { some: { units: { some: { lease: { id: lease.id } } } } } },
  });
  if (manager) {
    await notificationService.createNotification(prisma, {
      userId: manager.id,
      title: 'Rent Payment Received',
      message: `ACH payment of $${payment.amount} initiated by tenant.`,
      type: 'payment',
    });
  }

  res.status(201).json(payment);
});

// ────────────────────────────────────────────────────────────
// Check Deposit
// ────────────────────────────────────────────────────────────

router.post(
  '/check',
  authenticate,
  requireRole('TENANT'),
  (req, res, next) => { req.uploadFolder = 'checks'; next(); },
  imageUpload.fields([{ name: 'front', maxCount: 1 }, { name: 'back', maxCount: 1 }]),
  async (req, res) => {
    if (!req.files?.front || !req.files?.back) {
      return res.status(400).json({ error: 'Both front and back check images are required' });
    }

    const lease = await prisma.lease.findUnique({ where: { tenantId: req.user.id } });
    if (!lease) return res.status(404).json({ error: 'No active lease found' });

    const frontUrl = storageService.getFileUrl(req.files.front[0]);
    const backUrl = storageService.getFileUrl(req.files.back[0]);

    let checkData = null;
    try {
      checkData = await aiService.readCheck(req.files.front[0].path, req.files.back[0].path);
    } catch (err) {
      console.error('Check AI read error:', err.message);
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId: req.user.id,
        leaseId: lease.id,
        amount: checkData?.amount || lease.rentAmount,
        method: 'CHECK',
        status: 'PROCESSING',
        dueDate: new Date(),
        checkFrontUrl: frontUrl,
        checkBackUrl: backUrl,
        checkData: checkData,
        notes: req.body.notes,
      },
    });

    const manager = await prisma.user.findFirst({
      where: { properties: { some: { units: { some: { lease: { id: lease.id } } } } } },
    });
    if (manager) {
      await notificationService.createNotification(prisma, {
        userId: manager.id,
        title: 'Check Payment Submitted',
        message: `Check for $${payment.amount} submitted. ${checkData ? `Check #${checkData.checkNumber || ''}` : 'Pending review.'}`,
        type: 'payment',
        linkTo: '/manager/finances',
      });
    }

    res.status(201).json({ payment, checkData });
  }
);

// ────────────────────────────────────────────────────────────
// Manager: Manual-paid + Reminder + Autopay settings
// ────────────────────────────────────────────────────────────

router.post('/manual-paid', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { leaseId } = req.body;
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, unit: { property: { managerId: req.user.id } } },
  });
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  let payment = await prisma.payment.findFirst({
    where: {
      leaseId,
      dueDate: { gte: monthStart, lte: monthEnd },
      status: { in: ['PENDING', 'PROCESSING'] },
      NOT: { notes: { in: ['Late fee', 'Overdue notice'] } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (payment) {
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED', paidAt: now },
    });
  } else {
    payment = await prisma.payment.create({
      data: {
        tenantId: lease.tenantId,
        leaseId,
        amount: lease.rentAmount,
        method: 'MANUAL',
        status: 'COMPLETED',
        dueDate: now,
        paidAt: now,
        notes: 'Marked paid by manager',
      },
    });
  }

  await notificationService.createNotification(prisma, {
    userId: lease.tenantId,
    title: 'Payment Confirmed',
    message: `Your rent of $${lease.rentAmount} has been marked as received by your property manager.`,
    type: 'payment',
  });

  res.json(payment);
});

router.post('/send-reminder', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { leaseId } = req.body;
  const lease = await prisma.lease.findFirst({
    where: { id: leaseId, unit: { property: { managerId: req.user.id } } },
    include: {
      tenant: { select: { firstName: true } },
      unit: { include: { property: { select: { name: true } } } },
    },
  });
  if (!lease) return res.status(404).json({ error: 'Lease not found' });

  await notificationService.createNotification(prisma, {
    userId: lease.tenantId,
    title: 'Rent Payment Reminder',
    message: `Hi ${lease.tenant.firstName}, your rent of $${lease.rentAmount} for ${lease.unit.property.name} is overdue. Please submit payment at your earliest convenience.`,
    type: 'payment',
  });

  res.json({ message: 'Reminder sent' });
});

// GET /api/payments/manager-settings — manager's Venmo/Zelle/threshold settings
router.get('/manager-settings', authenticate, requireRole('MANAGER'), async (req, res) => {
  const manager = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { venmoHandle: true, zelleInfo: true, vendorCostThreshold: true },
  });
  res.json(manager);
});

// PATCH /api/payments/manager-settings — save Venmo/Zelle info
router.patch('/manager-settings', authenticate, requireRole('MANAGER'), async (req, res) => {
  const { venmoHandle, zelleInfo, vendorCostThreshold } = req.body;
  const updated = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      venmoHandle: venmoHandle !== undefined ? venmoHandle : undefined,
      zelleInfo: zelleInfo !== undefined ? zelleInfo : undefined,
      vendorCostThreshold: vendorCostThreshold !== undefined ? parseFloat(vendorCostThreshold) : undefined,
    },
    select: { venmoHandle: true, zelleInfo: true, vendorCostThreshold: true },
  });
  res.json(updated);
});

// POST /api/payments/:id/mark-paid
router.post('/:id/mark-paid', authenticate, requireRole('MANAGER'), async (req, res) => {
  const payment = await prisma.payment.findFirst({
    where: { id: req.params.id, lease: { unit: { property: { managerId: req.user.id } } } },
  });
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const updated = await prisma.payment.update({
    where: { id: req.params.id },
    data: { status: 'COMPLETED', paidAt: new Date() },
  });

  await notificationService.createNotification(prisma, {
    userId: payment.tenantId,
    title: 'Payment Confirmed',
    message: `Your payment of $${payment.amount} has been confirmed.`,
    type: 'payment',
  });

  res.json(updated);
});

module.exports = router;
