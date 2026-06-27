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
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER) {
    console.log(`[Email stub] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error('Email send error:', err.message);
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

module.exports = { sendEmail, sendSMS, createNotification };
