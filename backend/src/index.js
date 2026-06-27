require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { assessLateFees, assessOverdueRent } = require('./services/latefee.service');
const { processAutopayments, sendAutopayReminders } = require('./services/autopay.service');

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files in local dev
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/leases', require('./routes/leases'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/support', require('./routes/support'));
app.use('/api/expenses', require('./routes/expenses'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`PropFlow backend running on port ${PORT}`);

  // Run overdue + late fee assessment once daily at startup then every 24h
  const runDailyRentChecks = async () => {
    try {
      const overdue = await assessOverdueRent();
      if (overdue.length > 0) console.log(`Overdue rent notifications sent: ${overdue.length}`);
      const lateFees = await assessLateFees();
      if (lateFees.length > 0) console.log(`Late fees assessed: ${lateFees.length} tenants`);
    } catch (err) {
      console.error('Daily rent check error:', err.message);
    }
  };
  runDailyRentChecks();
  setInterval(runDailyRentChecks, 24 * 60 * 60 * 1000);

  // Autopay scheduler — runs every 24h; fires payments + 3-day advance reminders
  const runAutopay = async () => {
    try {
      const { processed, reminded } = await processAutopayments();
      if (processed.length > 0) console.log(`Autopay initiated: ${processed.length} leases`);
      if (reminded.length > 0) console.log(`Autopay manual reminders sent: ${reminded.length}`);
      const reminders = await sendAutopayReminders();
      if (reminders.length > 0) console.log(`3-day autopay reminders sent: ${reminders.length}`);
    } catch (err) {
      console.error('Autopay scheduler error:', err.message);
    }
  };
  runAutopay();
  setInterval(runAutopay, 24 * 60 * 60 * 1000);
});
