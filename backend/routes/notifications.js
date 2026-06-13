/* ==========================================
   RajanPay – routes/notifications.js
   Notification management
   ========================================== */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id);

  const unreadCount = rows.filter(n => !n.is_read).length;

  return res.json({
    success: true,
    notifications: rows,
    unreadCount,
  });
});

// ─── PUT /api/notifications/read-all ─────────────────────────────────────────
router.put('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  return res.json({ success: true, message: 'All notifications marked as read.' });
});

// ─── PUT /api/notifications/:id/read ─────────────────────────────────────────
router.put('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  return res.json({ success: true });
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  return res.json({ success: true });
});

module.exports = router;
