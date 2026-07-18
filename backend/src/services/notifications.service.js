const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

// Send via Resend's HTTPS API — works on hosts that block outbound SMTP (like Railway)
async function sendViaResend({ to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'PropFlow <onboarding@resend.dev>',
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function sendEmail({ to, subject, text, html }) {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to, subject, text, html });
      return { ok: true };
    }
    if (!process.env.SMTP_USER) {
      console.log(`[Email stub] To: ${to} | Subject: ${subject}`);
      return { ok: false, error: 'No email service configured (set RESEND_API_KEY or SMTP_USER)' };
    }
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { ok: false, error: err.message };
  }
}

// Verify email connectivity without sending anything (for diagnostics)
async function verifyEmail() {
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // invalid body — 422 proves auth works, 401 means bad key
      });
      if (res.status === 401 || res.status === 403) return { ok: false, driver: 'resend', error: 'Resend API key is invalid' };
      return { ok: true, driver: 'resend' };
    } catch (err) {
      return { ok: false, driver: 'resend', error: err.message };
    }
  }
  if (!process.env.SMTP_USER) return { ok: false, error: 'No email service configured (set RESEND_API_KEY or SMTP_USER)' };
  try {
    await getTransporter().verify();
    return { ok: true, driver: 'smtp', user: process.env.SMTP_USER.replace(/(.{2}).*(@.*)/, '$1***$2') };
  } catch (err) {
    return { ok: false, driver: 'smtp', error: err.message };
  }
}

async function sendSMS({ to, body }) {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log(`[SMS stub] To: ${to} | Body: ${body}`);
    return;
  }
  try {
    const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await twilio.messages.create({ from: process.env.TWILIO_FROM_NUMBER, to, body });
  } catch (err) {
    console.error('SMS send error:', err.message);
  }
}

async function createNotification(prisma, { userId, title, message, type, linkTo }) {
  return prisma.notification.create({
    data: { userId, title, message, type, linkTo: linkTo || null },
  });
}

module.exports = { sendEmail, sendSMS, createNotification, verifyEmail };
