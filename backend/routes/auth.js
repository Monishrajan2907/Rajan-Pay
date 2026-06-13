/* ==========================================
   RajanPay – routes/auth.js
   Authentication routes: register, login, OTP
   ========================================== */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Full registration – accepts all 5-step signup data in one payload
router.post('/register', async (req, res) => {
  try {
    const {
      // Step 1: Personal
      firstName, lastName, dob, gender, phone, email, address, city, state, pincode,
      // Step 2: Identity (no sensitive data stored)
      aadhaarLast4, panNumber,
      // Step 3: Employment
      company, employeeId, designation, department, dateJoining, empType,
      grossSalary, netSalary, payDate, hrEmail,
      // Step 4: Bank
      bankName, accNumber, ifsc, accType, upiId,
      // Auth
      password,
    } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }

    // Check duplicate phone
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this phone number already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Compute initial balance values
    const net = parseFloat(netSalary) || 45000;
    const today = new Date();
    const daysInMonth = 26;
    const daysWorked = Math.min(today.getDate(), daysInMonth);
    const totalEarned = Math.round((net / daysInMonth) * daysWorked);
    const available = Math.round(totalEarned * 0.5); // 50% of earned is available

    const stmt = db.prepare(`
      INSERT INTO users (
        phone, email, password_hash,
        first_name, last_name, dob, gender, address, city, state, pincode,
        company, employee_id, designation, department, date_joining, emp_type,
        gross_salary, net_salary, pay_date, hr_email,
        bank_name, acc_number, ifsc, acc_type, upi_id,
        total_earned, available_balance, withdrawn_amount,
        days_worked, total_days, kyc_status, credit_score
      ) VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?
      )
    `);

    const result = stmt.run(
      phone, email || '', passwordHash,
      firstName || '', lastName || '', dob || '', gender || '', address || '', city || '', state || '', pincode || '',
      company || '', employeeId || '', designation || '', department || '', dateJoining || '', empType || '',
      parseFloat(grossSalary) || 0, net, payDate || '28', hrEmail || '',
      bankName || '', accNumber || '', ifsc || '', accType || '', upiId || '',
      totalEarned, available, 0,
      daysWorked, daysInMonth, 'pending', 750
    );

    const userId = result.lastInsertRowid;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    // Seed initial KYC records
    const kycStmt = db.prepare('INSERT INTO kyc_documents (user_id, doc_type, status) VALUES (?, ?, ?)');
    ['aadhaar', 'pan', 'selfie', 'salary_slip'].forEach(docType => {
      kycStmt.run(userId, docType, 'pending');
    });

    // Seed welcome notification
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, icon_type)
      VALUES (?, ?, ?, ?)
    `).run(userId, 'Welcome to RajanPay! 🎉', `Hi ${firstName || 'there'}! Your account is being verified. This usually takes 2–4 hours.`, 'success');

    // Seed payroll integration
    if (company) {
      db.prepare(`
        INSERT INTO payroll_integrations (user_id, company_name, status)
        VALUES (?, ?, ?)
      `).run(userId, company, 'active');
    }

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone.replace(/\D/g, '').slice(-10));
    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with this phone number.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/otp/send ──────────────────────────────────────────────────
// Mock OTP – just returns success (no real SMS)
router.post('/otp/send', (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone required.' });
  console.log(`[OTP] Mock OTP sent to ${phone}: 123456`);
  return res.json({ success: true, message: 'OTP sent successfully!', otp: '123456' /* demo only */ });
});

// ─── POST /api/auth/otp/verify ────────────────────────────────────────────────
router.post('/otp/verify', (req, res) => {
  const { phone, otp } = req.body;
  if (otp === '123456') {
    return res.json({ success: true, message: 'OTP verified!' });
  }
  return res.status(400).json({ success: false, message: 'Invalid OTP.' });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  return res.json({ success: true, user: sanitizeUser(user) });
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = router;
