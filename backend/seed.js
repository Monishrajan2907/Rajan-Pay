/* ==========================================
   RajanPay – seed.js
   Seeds the database with a demo user
   and realistic sample transactions
   Run: node seed.js
   ========================================== */

const bcrypt = require('bcryptjs');
const db = require('./db');

console.log('\n🌱 Seeding RajanPay database...\n');

// ─── Wipe existing demo data ──────────────────────────────────────────────────
const existingUser = db.prepare('SELECT id FROM users WHERE phone = ?').get('9876543210');
if (existingUser) {
  console.log('ℹ  Demo user already exists. Removing old data...');
  const uid = existingUser.id;
  db.prepare('DELETE FROM transactions WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM kyc_documents WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM payroll_integrations WHERE user_id = ?').run(uid);
  db.prepare('DELETE FROM users WHERE id = ?').run(uid);
}

// ─── Demo User ────────────────────────────────────────────────────────────────
const passwordHash = bcrypt.hashSync('demo1234', 10);

const today = new Date();
const daysInMonth = 26;
const daysWorked = Math.min(today.getDate(), daysInMonth);
const netSalary = 45000;
const grossSalary = 55000;
const dailyRate = netSalary / daysInMonth;
const totalEarned = Math.round(dailyRate * daysWorked);
const withdrawnAmount = 13500;
const availableBalance = Math.max(0, totalEarned - withdrawnAmount);

const insertUser = db.prepare(`
  INSERT INTO users (
    phone, email, password_hash,
    first_name, last_name, dob, gender, address, city, state, pincode,
    company, employee_id, designation, department, date_joining, emp_type,
    gross_salary, net_salary, pay_date, hr_email,
    bank_name, acc_number, ifsc, acc_type,
    total_earned, available_balance, withdrawn_amount,
    days_worked, total_days, kyc_status, credit_score
  ) VALUES (
    ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?
  )
`);

const result = insertUser.run(
  '9876543210', 'rajan@example.com', passwordHash,
  'Rajan', 'Kumar', '1995-08-15', 'Male',
  'Flat 12B, Andheri West', 'Mumbai', 'Maharashtra', '400058',
  'Tata Consultancy Services', 'TCS-EMP-001234', 'Software Engineer', 'Information Technology',
  '2021-04-01', 'Full-Time (Permanent)',
  grossSalary, netSalary, '28', 'hr@tcs.com',
  'State Bank of India', '123456784321', 'SBIN0001234', 'Salary Account',
  totalEarned, availableBalance, withdrawnAmount,
  daysWorked, daysInMonth, 'verified', 782
);

const userId = result.lastInsertRowid;
console.log(`✅ Demo user created (ID: ${userId})`);
console.log(`   Phone: 9876543210`);
console.log(`   Password: demo1234`);
console.log(`   Earned: ₹${totalEarned.toLocaleString('en-IN')} | Available: ₹${availableBalance.toLocaleString('en-IN')}`);

// ─── Sample Transactions ──────────────────────────────────────────────────────
const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(d) {
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}
function fmtGroup(d) {
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Today';
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const txnData = [
  // Today
  { type: 'withdrawal', title: 'Wage Advance',   sub: 'Credited to SBI ••••4321', amount: 5000,  daysAgo: 0,  timeH: 14, timeM: 30, sign: '+', color: 'credit' },
  { type: 'repayment',  title: 'Auto Repayment', sub: 'Deducted from May salary',  amount: 3000,  daysAgo: 0,  timeH: 10, timeM: 0,  sign: '-', color: 'debit' },
  // Few days ago
  { type: 'withdrawal', title: 'Wage Advance',   sub: 'Credited to SBI ••••4321', amount: 8500,  daysAgo: 9,  timeH: 16, timeM: 15, sign: '+', color: 'credit' },
  // Last month salary + repayment
  { type: 'salary',     title: 'Salary Credit',  sub: 'May 2026 – TCS Payroll',   amount: 45000, daysAgo: 15, timeH: 9,  timeM: 0,  sign: '+', color: 'neutral' },
  { type: 'repayment',  title: 'Auto Repayment', sub: 'Deducted from May salary',  amount: 15000, daysAgo: 15, timeH: 9,  timeM: 1,  sign: '-', color: 'debit' },
  { type: 'withdrawal', title: 'Wage Advance',   sub: 'Credited to SBI ••••4321', amount: 5000,  daysAgo: 23, timeH: 18, timeM: 30, sign: '+', color: 'credit' },
  { type: 'withdrawal', title: 'Wage Advance',   sub: 'Credited to SBI ••••4321', amount: 10000, daysAgo: 33, timeH: 12, timeM: 0,  sign: '+', color: 'credit' },
  // Two months ago
  { type: 'salary',     title: 'Salary Credit',  sub: 'April 2026 – TCS Payroll', amount: 45000, daysAgo: 45, timeH: 9,  timeM: 0,  sign: '+', color: 'neutral' },
  { type: 'repayment',  title: 'Auto Repayment', sub: 'Deducted from April salary',amount: 8000,  daysAgo: 45, timeH: 9,  timeM: 1,  sign: '-', color: 'debit' },
];

const insertTxn = db.prepare(`
  INSERT INTO transactions (id, user_id, type, title, subtitle, amount, sign, color_class, date_label, date_group, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

txnData.forEach((t, i) => {
  const d = new Date(today);
  d.setDate(d.getDate() - t.daysAgo);
  d.setHours(t.timeH, t.timeM, 0, 0);
  const txnId = `RF${Date.now() - i * 100000}`.substring(0, 14);
  insertTxn.run(
    txnId, userId, t.type, t.title, t.sub, t.amount,
    t.sign, t.color, fmtDate(d), fmtGroup(d), d.toISOString()
  );
});
console.log(`✅ ${txnData.length} sample transactions created`);

// ─── KYC Documents ────────────────────────────────────────────────────────────
const kycStmt = db.prepare(`
  INSERT INTO kyc_documents (user_id, doc_type, status) VALUES (?, ?, ?)
`);
['aadhaar', 'pan', 'selfie', 'salary_slip'].forEach(doc => {
  kycStmt.run(userId, doc, 'verified');
});
console.log('✅ KYC documents seeded (all verified)');

// ─── Payroll Integration ──────────────────────────────────────────────────────
db.prepare(`
  INSERT INTO payroll_integrations (user_id, company_name, status, last_synced)
  VALUES (?, ?, ?, datetime('now'))
`).run(userId, 'Tata Consultancy Services', 'active');
console.log('✅ Payroll integration seeded');

// ─── Notifications ────────────────────────────────────────────────────────────
const notifData = [
  { title: 'Withdrawal Successful 💸', msg: '₹5,000 credited to your SBI account ••••4321', icon: 'success', read: 0 },
  { title: 'Payroll Connected 🔗',     msg: 'TCS payroll integration successful',           icon: 'info',    read: 0 },
  { title: 'Salary Updated 📊',        msg: "This month's earned wages have been updated",   icon: 'info',    read: 1 },
  { title: 'KYC Verified ✅',          msg: 'Your Aadhaar and PAN have been verified',       icon: 'success', read: 1 },
  { title: 'Welcome to RajanPay! 🎉',  msg: 'Your account is active. Access your earned wages anytime.', icon: 'success', read: 1 },
];

const notifStmt = db.prepare(`
  INSERT INTO notifications (user_id, title, message, icon_type, is_read) VALUES (?, ?, ?, ?, ?)
`);
notifData.forEach(n => notifStmt.run(userId, n.title, n.msg, n.icon, n.read));
console.log(`✅ ${notifData.length} notifications seeded`);

console.log('\n🚀 Seeding complete! Start the server with: node server.js\n');
console.log('─'.repeat(45));
console.log('  Demo login credentials:');
console.log('  Phone   : 9876543210');
console.log('  Password: demo1234');
console.log('─'.repeat(45));
console.log('');

process.exit(0);
