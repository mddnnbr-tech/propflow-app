const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const notificationService = require('../services/notifications.service');

const router = express.Router();
const prisma = new PrismaClient();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
    body('role').isIn(['MANAGER', 'TENANT']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, firstName, lastName, role, phone } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, firstName, lastName, role, phone },
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    });
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    });
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true },
  });
  res.json(user);
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { firstName, lastName, phone },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, phone: true },
  });
  res.json(user);
});

// POST /api/auth/invite-tenant  (manager invites a tenant to a unit)
router.post('/invite-tenant', authenticate, async (req, res) => {
  const { email, firstName, lastName, phone, unitId } = req.body;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { property: true },
  });
  if (!unit || unit.property.managerId !== req.user.id) {
    return res.status(403).json({ error: 'Unit not found or not yours' });
  }

  let tenant = await prisma.user.findUnique({ where: { email } });
  if (!tenant) {
    const tempPassword = Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(tempPassword, 12);
    tenant = await prisma.user.create({
      data: { email, firstName, lastName, phone, role: 'TENANT', password: hashed },
    });
    await notificationService.sendEmail({
      to: email,
      subject: 'Welcome to PropAI — Your Tenant Portal',
      text: `Hi ${firstName},\n\nYour landlord has invited you to PropAI.\n\nLogin: ${email}\nTemporary password: ${tempPassword}\n\nPlease change your password after first login.`,
    });
  }

  res.json({ tenant: { id: tenant.id, email: tenant.email, firstName: tenant.firstName, lastName: tenant.lastName } });
});

// POST /api/auth/managed-services-interest — tenant or manager expresses interest in managed services
router.post('/managed-services-interest', authenticate, async (req, res) => {
  const { properties, phone, bestTime, notes } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { firstName: true, lastName: true, email: true },
  });

  const tier = req.body.tier === 'coordinator' ? 'Maintenance Coordinator ($29/property/mo)' : 'Full Management (8% of rent)';
  const callLink = phone ? `tel:${phone.replace(/\D/g, '')}` : null;

  // Notify the PropFlow team (internal ops email)
  await notificationService.sendEmail({
    to: process.env.OPS_EMAIL || process.env.SMTP_USER,
    subject: `🏠 New Lead — ${user.firstName} ${user.lastName} | ${properties || '?'} properties | ${tier}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#1e40af;color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
          <h2 style="margin:0;font-size:18px;">New Managed Services Lead</h2>
          <p style="margin:6px 0 0;opacity:0.8;font-size:13px;">PropFlow · ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#64748b;width:140px;">Name</td><td style="padding:8px 0;font-weight:600;">${user.firstName} ${user.lastName}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;"><a href="mailto:${user.email}" style="color:#2563eb;">${user.email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Phone</td><td style="padding:8px 0;">${phone ? `<a href="${callLink}" style="color:#2563eb;font-weight:600;">${phone}</a>` : '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Tier Interest</td><td style="padding:8px 0;"><span style="background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;">${tier}</span></td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Properties</td><td style="padding:8px 0;font-weight:600;">${properties || 'Not specified'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Best Time</td><td style="padding:8px 0;">${bestTime || 'Any time'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Notes</td><td style="padding:8px 0;">${notes || '—'}</td></tr>
          </table>
          ${phone ? `<a href="${callLink}" style="display:inline-block;margin-top:16px;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">📞 Call ${user.firstName} Now</a>` : ''}
          <p style="margin-top:20px;font-size:12px;color:#94a3b8;">Reply directly to this email to respond to ${user.firstName}.</p>
        </div>
      </div>`,
    text: `New lead: ${user.firstName} ${user.lastName} | ${user.email} | ${phone || 'no phone'} | ${tier} | ${properties || '?'} properties | Best time: ${bestTime || 'any'} | Notes: ${notes || 'none'}`,
  });

  // Confirm to the user
  await notificationService.sendEmail({
    to: user.email,
    subject: "We received your Managed Services inquiry!",
    text: `Hi ${user.firstName},\n\nThanks for your interest in PropFlow Managed Services! Our team will reach out within 1 business day to discuss how we can help manage your properties.\n\nWarm regards,\nThe PropFlow Team`,
  });

  await notificationService.createNotification(prisma, {
    userId: req.user.id,
    title: 'Managed Services Inquiry Received',
    message: 'Our team will contact you within 1 business day to discuss your managed services options.',
    type: 'info',
  });

  res.json({ message: 'Inquiry received' });
});

module.exports = router;
