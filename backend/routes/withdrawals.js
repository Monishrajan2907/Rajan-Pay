/* ==========================================
   RajanPay – routes/withdrawals.js
   Withdrawal request & tracking
   ========================================== */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── POST /api/withdrawals/request ───────────────────────────────────────────
router.post('/request', requireAuth, (req, res) => {
  const { amount } = req.body;
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Please provide a valid amount.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const available = Math.max(0, user.total_earned - user.withdrawn_amount);
  if (amount > available) {
    return res.status(400).json({
      success: false,
      message: `Amount exceeds available limit of ₹${available.toLocaleString('en-IN')}.`
    });
  }

  // Generate transaction ID
  const txnId = `RF${Date.now()}`.substring(0, 14);
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = `${months[now.getMonth()]} ${now.getDate()}, ${timeStr}`;
  const dateGroup = `${months[now.getMonth()]} ${now.getDate()}`;

  const bankLast4 = user.acc_number ? user.acc_number.slice(-4) : '0000';
  const bankDisplay = `${user.bank_name || 'SBI'} ••••${bankLast4}`;

  // Insert transaction
  db.prepare(`
    INSERT INTO transactions (id, user_id, type, title, subtitle, amount, sign, color_class, date_label, date_group)
    VALUES (?, ?, 'withdrawal', 'Wage Advance', ?, ?, '+', 'credit', ?, ?)
  `).run(txnId, userId, `Credited to ${bankDisplay}`, amount, dateStr, dateGroup);

  // Update user's withdrawn amount
  db.prepare('UPDATE users SET withdrawn_amount = withdrawn_amount + ? WHERE id = ?').run(amount, userId);

  // Recalculate available
  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const newAvailable = Math.max(0, updatedUser.total_earned - updatedUser.withdrawn_amount);
  db.prepare('UPDATE users SET available_balance = ? WHERE id = ?').run(newAvailable, userId);

  // Add notification
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, icon_type)
    VALUES (?, ?, ?, ?)
  `).run(userId,
    'Withdrawal Successful 💸',
    `₹${parseInt(amount).toLocaleString('en-IN')} credited to your ${bankDisplay}`,
    'success'
  );

  return res.json({
    success: true,
    message: `₹${parseInt(amount).toLocaleString('en-IN')} has been credited to your account!`,
    txnId,
    newAvailable,
    transaction: {
      id: txnId,
      type: 'withdrawal',
      title: 'Wage Advance',
      sub: `Credited to ${bankDisplay}`,
      amount,
      date: dateStr,
      dateGroup,
      sign: '+',
      colorClass: 'credit',
    }
  });
});

// ─── GET /api/withdrawals ─────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = ? AND type = 'withdrawal'
    ORDER BY created_at DESC
  `).all(req.user.id);

  return res.json({ success: true, withdrawals: rows });
});

// ─── GET /api/withdrawals/status/:txnId ──────────────────────────────────────
router.get('/status/:txnId', requireAuth, (req, res) => {
  const txn = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
    .get(req.params.txnId, req.user.id);

  if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found.' });
  return res.json({ success: true, status: 'completed', transaction: txn });
});

module.exports = router;
