/* ==========================================
   RajanPay – routes/payroll.js
   Payroll integration status & sync
   ========================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── GET /api/payroll/status ──────────────────────────────────────────────────
router.get('/status', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const payroll = db.prepare('SELECT * FROM payroll_integrations WHERE user_id = ?').get(req.user.id);

  return res.json({
    success: true,
    payroll: {
      isConnected: !!payroll && payroll.status === 'active',
      companyName: user.company || payroll?.company_name || 'Not Set',
      designation: user.designation || '',
      department: user.department || '',
      grossSalary: user.gross_salary || 0,
      netSalary: user.net_salary || 0,
      payDate: user.pay_date || '28',
      lastSynced: payroll?.last_synced || new Date().toISOString(),
      status: payroll?.status || 'inactive',
    }
  });
});

// ─── POST /api/payroll/sync ───────────────────────────────────────────────────
router.post('/sync', requireAuth, (req, res) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

  // Simulate re-calculation of earned amount
  const today = new Date();
  const daysInMonth = user.total_days || 26;
  const daysWorked = Math.min(today.getDate(), daysInMonth);
  const totalEarned = Math.round((user.net_salary / daysInMonth) * daysWorked);

  db.prepare(`
    UPDATE users SET total_earned = ?, days_worked = ?, available_balance = ?
    WHERE id = ?
  `).run(totalEarned, daysWorked, Math.max(0, totalEarned - user.withdrawn_amount), userId);

  // Update last synced timestamp
  const existing = db.prepare('SELECT id FROM payroll_integrations WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare(`
      UPDATE payroll_integrations SET last_synced = datetime('now') WHERE user_id = ?
    `).run(userId);
  } else {
    db.prepare(`
      INSERT INTO payroll_integrations (user_id, company_name, status)
      VALUES (?, ?, 'active')
    `).run(userId, user.company || '');
  }

  // Add notification for sync
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, icon_type)
    VALUES (?, ?, ?, ?)
  `).run(userId, 'Payroll Synced 🔗', `Salary data updated. ₹${totalEarned.toLocaleString('en-IN')} earned this month.`, 'info');

  return res.json({
    success: true,
    message: 'Payroll synced successfully!',
    totalEarned,
    daysWorked,
    lastSynced: new Date().toISOString(),
  });
});

module.exports = router;
