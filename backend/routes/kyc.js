/* ==========================================
   RajanPay – routes/kyc.js
   KYC document status & file uploads
   ========================================== */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// ─── Multer setup ─────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, String(req.user.id));
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const docType = req.body.docType || 'doc';
    const ext = path.extname(file.originalname);
    cb(null, `${docType}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|pdf/;
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowed.test(ext)) return cb(null, true);
    cb(new Error('Only JPG, PNG, and PDF files are allowed.'));
  }
});

// ─── GET /api/kyc/status ──────────────────────────────────────────────────────
router.get('/status', requireAuth, (req, res) => {
  const docs = db.prepare(`
    SELECT doc_type, status, uploaded_at FROM kyc_documents WHERE user_id = ?
  `).all(req.user.id);

  const kycMap = {};
  docs.forEach(d => { kycMap[d.doc_type] = { status: d.status, uploadedAt: d.uploaded_at }; });

  const allVerified = ['aadhaar', 'pan', 'selfie', 'salary_slip'].every(
    t => kycMap[t]?.status === 'verified'
  );

  return res.json({
    success: true,
    kyc: kycMap,
    overallStatus: allVerified ? 'verified' : 'pending',
  });
});

// ─── POST /api/kyc/upload ─────────────────────────────────────────────────────
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  const { docType } = req.body;
  const validTypes = ['aadhaar', 'pan', 'selfie', 'salary_slip'];

  if (!docType || !validTypes.includes(docType)) {
    return res.status(400).json({ success: false, message: 'Invalid document type.' });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const filePath = req.file.path;
  const fileName = req.file.filename;

  // Upsert KYC record
  const existing = db.prepare('SELECT id FROM kyc_documents WHERE user_id = ? AND doc_type = ?')
    .get(req.user.id, docType);

  if (existing) {
    db.prepare(`
      UPDATE kyc_documents SET status = 'uploaded', file_name = ?, file_path = ?, uploaded_at = datetime('now')
      WHERE user_id = ? AND doc_type = ?
    `).run(fileName, filePath, req.user.id, docType);
  } else {
    db.prepare(`
      INSERT INTO kyc_documents (user_id, doc_type, status, file_name, file_path)
      VALUES (?, ?, 'uploaded', ?, ?)
    `).run(req.user.id, docType, fileName, filePath);
  }

  // Simulate auto-verification after 2 seconds (mock)
  setTimeout(() => {
    db.prepare(`
      UPDATE kyc_documents SET status = 'verified' WHERE user_id = ? AND doc_type = ?
    `).run(req.user.id, docType);

    // Check if all verified and update user kyc_status
    const allDone = db.prepare(`
      SELECT COUNT(*) as cnt FROM kyc_documents
      WHERE user_id = ? AND status = 'verified'
    `).get(req.user.id).cnt;

    if (allDone >= 3) {
      db.prepare('UPDATE users SET kyc_status = ? WHERE id = ?').run('verified', req.user.id);
    }
  }, 2000);

  return res.json({
    success: true,
    message: `${docType.replace('_', ' ')} uploaded successfully!`,
    fileName,
    status: 'uploaded',
  });
});

// ─── POST /api/kyc/selfie ─────────────────────────────────────────────────────
// Selfie captured via browser camera (base64 or simulated)
router.post('/selfie', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE kyc_documents SET status = 'verified', uploaded_at = datetime('now')
    WHERE user_id = ? AND doc_type = 'selfie'
  `).run(req.user.id);

  if (!db.prepare('SELECT id FROM kyc_documents WHERE user_id = ? AND doc_type = ?').get(req.user.id, 'selfie')) {
    db.prepare(`INSERT INTO kyc_documents (user_id, doc_type, status) VALUES (?, 'selfie', 'verified')`).run(req.user.id);
  }

  return res.json({ success: true, message: 'Selfie verified successfully!' });
});

module.exports = router;
