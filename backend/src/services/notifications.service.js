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

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER) {
    console.log(`[Email stub] To: ${to} | Subject: ${subject}`);
    return { ok: false, error: 'SMTP not configured (SMTP_USER missing)' };
  }
  try {
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

// Verify SMTP connectivity without sending anything (for diagnostics)
async function verifyEmail() {
  if (!process.env.SMTP_USER) return { ok: false, error: 'SMTP_USER is not set' };
  try {
    await getTransporter().verify();
    return { ok: true, user: process.env.SMTP_USER.replace(/(.{2}).*(@.*)/, '$1***$2') };
  } catch (err) {
    return { ok: false, error: err.message };
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
