/* ==========================================
   RajanPay – server.js
   Main Express Application Entry Point
   ========================================== */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize DB first (creates tables)
require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Request logger (dev) ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  const ts = new Date().toLocaleTimeString('en-IN');
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/user',          require('./routes/user'));
app.use('/api/withdrawals',   require('./routes/withdrawals'));
app.use('/api/transactions',  require('./routes/transactions'));
app.use('/api/kyc',           require('./routes/kyc'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/payroll',       require('./routes/payroll'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'RajanPay API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
  }
  res.status(500).json({ success: false, message: err.message || 'Internal server error.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      RajanPay API Server - Running       ║');
  console.log(`║  http://localhost:${PORT}                   ║`);
  console.log('║  Rajan Finance Pvt. Ltd.                 ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Available endpoints:');
  console.log('  POST /api/auth/register');
  console.log('  POST /api/auth/login');
  console.log('  GET  /api/user/dashboard');
  console.log('  POST /api/withdrawals/request');
  console.log('  GET  /api/transactions');
  console.log('  GET  /api/kyc/status');
  console.log('  GET  /api/notifications');
  console.log('  GET  /api/payroll/status');
  console.log('  GET  /api/health');
  console.log('');
});

module.exports = app;
