/* ==========================================
   RajanPay – routes/user.js
   User profile & dashboard data
   ========================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── GET /api/user/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  const { password_hash, ...safe } = user;
  return res.json({ success: true, user: safe });
});

// ─── GET /api/user/dashboard ──────────────────────────────────────────────────
router.get('/dashboard', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  // Recalculate live earned amount based on today's date
  const today = new Date();
  const daysInMonth = user.total_days || 26;
  const daysWorked = Math.min(today.getDate(), daysInMonth);
  const dailyRate = (user.net_salary || 45000) / daysInMonth;
  const totalEarned = Math.round(dailyRate * daysWorked);
  const todayEarned = Math.round(dailyRate);

  // Pay cycle
  const payDay = parseInt(user.pay_date) || 28;
  let nextPayDate = new Date(today.getFullYear(), today.getMonth(), payDay);
  if (nextPayDate <= today) nextPayDate = new Date(today.getFullYear(), today.getMonth() + 1, payDay);
  const daysToPayday = Math.ceil((nextPayDate - today) / (1000 * 60 * 60 * 24));
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const payDateStr = `${months[nextPayDate.getMonth()]} ${nextPayDate.getDate()}`;

  // Update DB with fresh calculated values
  db.prepare(`
    UPDATE users SET total_earned = ?, days_worked = ?, available_balance = ?
    WHERE id = ?
  `).run(totalEarned, daysWorked, Math.max(0, totalEarned - (user.withdrawn_amount || 0)), user.id);

  return res.json({
    success: true,
    dashboard: {
      totalEarned,
      todayEarned,
      available: Math.max(0, totalEarned - (user.withdrawn_amount || 0)),
      withdrawn: user.withdrawn_amount || 0,
      daysWorked,
      totalDays: daysInMonth,
      daysToPayday,
      payDateStr,
      nextPayDate: nextPayDate.toISOString(),
      grossSalary: user.gross_salary,
      netSalary: user.net_salary,
      company: user.company,
      designation: user.designation,
      creditScore: user.credit_score || 750,
      userName: `${user.first_name} ${user.last_name}`.trim() || 'User',
      firstName: user.first_name || 'User',
      bankLast4: user.acc_number ? user.acc_number.slice(-4) : '0000',
      bankName: user.bank_name || 'SBI',
    }
  });
});

// ─── PUT /api/user/profile ────────────────────────────────────────────────────
router.put('/profile', requireAuth, (req, res) => {
  const { firstName, lastName, email, address, city, state, pincode } = req.body;

  db.prepare(`
    UPDATE users SET
      first_name = COALESCE(?, first_name),
      last_name  = COALESCE(?, last_name),
      email      = COALESCE(?, email),
      address    = COALESCE(?, address),
      city       = COALESCE(?, city),
      state      = COALESCE(?, state),
      pincode    = COALESCE(?, pincode)
    WHERE id = ?
  `).run(firstName, lastName, email, address, city, state, pincode, req.user.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const { password_hash, ...safe } = user;
  return res.json({ success: true, message: 'Profile updated successfully.', user: safe });
});

// ─── PUT /api/user/employment ─────────────────────────────────────────────────
router.put('/employment', requireAuth, (req, res) => {
  const { company, designation, department, grossSalary, netSalary, payDate } = req.body;

  db.prepare(`
    UPDATE users SET
      company      = COALESCE(?, company),
      designation  = COALESCE(?, designation),
      department   = COALESCE(?, department),
      gross_salary = COALESCE(?, gross_salary),
      net_salary   = COALESCE(?, net_salary),
      pay_date     = COALESCE(?, pay_date)
    WHERE id = ?
  `).run(company, designation, department, grossSalary, netSalary, payDate, req.user.id);

  return res.json({ success: true, message: 'Employment details updated.' });
});

// ─── PUT /api/user/bank ───────────────────────────────────────────────────────
router.put('/bank', requireAuth, (req, res) => {
  const { bankName, accNumber, ifsc, accType, upiId } = req.body;

  db.prepare(`
    UPDATE users SET
      bank_name  = COALESCE(?, bank_name),
      acc_number = COALESCE(?, acc_number),
      ifsc       = COALESCE(?, ifsc),
      acc_type   = COALESCE(?, acc_type),
      upi_id     = COALESCE(?, upi_id)
    WHERE id = ?
  `).run(bankName, accNumber, ifsc, accType, upiId, req.user.id);

  return res.json({ success: true, message: 'Bank account updated.' });
});

module.exports = router;
