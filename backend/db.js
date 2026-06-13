/* ==========================================
   RajanPay – db.js
   SQLite database setup & schema
   ========================================== */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'rajanpay.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    phone             TEXT    UNIQUE NOT NULL,
    email             TEXT,
    password_hash     TEXT    NOT NULL,
    first_name        TEXT    DEFAULT '',
    last_name         TEXT    DEFAULT '',
    dob               TEXT    DEFAULT '',
    gender            TEXT    DEFAULT '',
    address           TEXT    DEFAULT '',
    city              TEXT    DEFAULT '',
    state             TEXT    DEFAULT '',
    pincode           TEXT    DEFAULT '',
    -- Employment
    company           TEXT    DEFAULT '',
    employee_id       TEXT    DEFAULT '',
    designation       TEXT    DEFAULT '',
    department        TEXT    DEFAULT '',
    date_joining      TEXT    DEFAULT '',
    emp_type          TEXT    DEFAULT '',
    gross_salary      REAL    DEFAULT 0,
    net_salary        REAL    DEFAULT 0,
    pay_date          TEXT    DEFAULT '28',
    hr_email          TEXT    DEFAULT '',
    -- Bank
    bank_name         TEXT    DEFAULT '',
    acc_number        TEXT    DEFAULT '',
    ifsc              TEXT    DEFAULT '',
    acc_type          TEXT    DEFAULT '',
    upi_id            TEXT    DEFAULT '',
    -- Computed / cached fields
    total_earned      REAL    DEFAULT 0,
    available_balance REAL    DEFAULT 0,
    withdrawn_amount  REAL    DEFAULT 0,
    days_worked       INTEGER DEFAULT 0,
    total_days        INTEGER DEFAULT 26,
    kyc_status        TEXT    DEFAULT 'pending',
    credit_score      INTEGER DEFAULT 750,
    is_active         INTEGER DEFAULT 1,
    created_at        TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    type        TEXT    NOT NULL CHECK(type IN ('withdrawal','repayment','salary')),
    title       TEXT    NOT NULL,
    subtitle    TEXT    DEFAULT '',
    amount      REAL    NOT NULL,
    sign        TEXT    DEFAULT '+',
    color_class TEXT    DEFAULT 'neutral',
    date_label  TEXT    DEFAULT '',
    date_group  TEXT    DEFAULT '',
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS kyc_documents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    doc_type    TEXT    NOT NULL CHECK(doc_type IN ('aadhaar','pan','selfie','salary_slip')),
    status      TEXT    DEFAULT 'pending' CHECK(status IN ('pending','uploaded','verified','rejected')),
    file_name   TEXT    DEFAULT '',
    file_path   TEXT    DEFAULT '',
    uploaded_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    title       TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    icon_type   TEXT    DEFAULT 'info',
    is_read     INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payroll_integrations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    company_name  TEXT    DEFAULT '',
    status        TEXT    DEFAULT 'active',
    last_synced   TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

console.log('[DB] SQLite database initialized at data/rajanpay.db');

module.exports = db;
