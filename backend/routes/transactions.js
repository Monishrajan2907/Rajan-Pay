/* ==========================================
   RajanPay – routes/transactions.js
   Transaction listing, filtering, export
   ========================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── GET /api/transactions ────────────────────────────────────────────────────
// Query param: ?type=withdrawal|repayment|salary
router.get('/', requireAuth, (req, res) => {
  const { type } = req.query;
  const userId = req.user.id;

  let query = 'SELECT * FROM transactions WHERE user_id = ?';
  const params = [userId];

  if (type && ['withdrawal', 'repayment', 'salary'].includes(type)) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params);

  // Normalize field names for frontend compatibility
  const txns = rows.map(r => ({
    id: r.id,
    type: r.type,
    title: r.title,
    sub: r.subtitle,
    amount: r.amount,
    date: r.date_label,
    dateGroup: r.date_group,
    sign: r.sign,
    colorClass: r.color_class,
    createdAt: r.created_at,
  }));

  return res.json({ success: true, transactions: txns, count: txns.length });
});

// ─── GET /api/transactions/summary ───────────────────────────────────────────
router.get('/summary', requireAuth, (req, res) => {
  const userId = req.user.id;

  const totalWithdrawn = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM transactions
    WHERE user_id = ? AND type = 'withdrawal'
  `).get(userId).total;

  const totalRepaid = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM transactions
    WHERE user_id = ? AND type = 'repayment'
  `).get(userId).total;

  const txnCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(userId).count;

  return res.json({
    success: true,
    summary: {
      totalWithdrawn,
      totalRepaid,
      txnCount,
      outstanding: Math.max(0, totalWithdrawn - totalRepaid),
    }
  });
});

// ─── GET /api/transactions/export ────────────────────────────────────────────
// Returns CSV of all transactions
router.get('/export', requireAuth, (req, res) => {
  const userId = req.user.id;
  const user = db.prepare('SELECT first_name, last_name, phone FROM users WHERE id = ?').get(userId);
  const rows = db.prepare(`
    SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId);

  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
  const lines = [
    `RajanPay Transaction Statement`,
    `Account: ${name} | Phone: ${user.phone}`,
    `Generated: ${new Date().toLocaleString('en-IN')}`,
    ``,
    `TXN ID,Type,Title,Amount,Date`,
    ...rows.map(r => `${r.id},${r.type},"${r.title}",${r.amount},"${r.date_label}"`)
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="rajanpay_statement.csv"`);
  return res.send(lines.join('\n'));
});

module.exports = router;
