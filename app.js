/* ==========================================
   RajanPay – Rajan Finance
   app.js – Main Application Logic
   ========================================== */

// ===== API LAYER =====
const API = (() => {
  const BASE = 'http://localhost:3001/api';
  let _online = null; // null = unknown, true/false after health check

  function getToken() {
    return localStorage.getItem('rajanpay_token');
  }
  function setToken(t) {
    localStorage.setItem('rajanpay_token', t);
  }
  function clearToken() {
    localStorage.removeItem('rajanpay_token');
    localStorage.removeItem('rajanpay_user');
  }
  function getStoredUser() {
    try { return JSON.parse(localStorage.getItem('rajanpay_user')); } catch { return null; }
  }
  function storeUser(u) {
    localStorage.setItem('rajanpay_user', JSON.stringify(u));
  }

  async function request(method, path, body, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    try {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.warn(`[API] ${method} ${path} failed (backend offline?):`, err.message);
      return { ok: false, status: 0, data: { success: false, message: 'Backend offline' } };
    }
  }

  async function checkHealth() {
    try {
      const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
      _online = res.ok;
    } catch {
      _online = false;
    }
    console.log(`[API] Backend ${_online ? '🟢 online' : '🔴 offline (using mock data)'}`);
    return _online;
  }

  return {
    isOnline: () => _online,
    getToken,
    setToken,
    clearToken,
    getStoredUser,
    storeUser,
    checkHealth,

    auth: {
      login:    (phone, password) => request('POST', '/auth/login', { phone, password }, false),
      register: (data)           => request('POST', '/auth/register', data, false),
      me:       ()               => request('GET',  '/auth/me'),
    },
    user: {
      dashboard: () => request('GET', '/user/dashboard'),
      me:        () => request('GET', '/user/me'),
      updateProfile:    (d) => request('PUT', '/user/profile', d),
      updateEmployment: (d) => request('PUT', '/user/employment', d),
    },
    withdrawals: {
      request: (amount) => request('POST', '/withdrawals/request', { amount }),
    },
    transactions: {
      list:    (type) => request('GET', `/transactions${type && type !== 'all' ? '?type=' + type : ''}`),
      summary: ()     => request('GET', '/transactions/summary'),
      export:  ()     => `${BASE}/transactions/export?token=${getToken()}`,
    },
    kyc: {
      status: () => request('GET', '/kyc/status'),
      selfie: () => request('POST', '/kyc/selfie'),
    },
    notifications: {
      list:    ()   => request('GET',  '/notifications'),
      readAll: ()   => request('PUT',  '/notifications/read-all'),
      read:    (id) => request('PUT',  `/notifications/${id}/read`),
    },
    payroll: {
      status: () => request('GET',  '/payroll/status'),
      sync:   () => request('POST', '/payroll/sync'),
    },
  };
})();

// ===== API: AUTO-DETECT BACKEND ON LOAD =====
API.checkHealth();


// ===== GLOBAL STATE =====
const AppState = {
  isLoggedIn: false,
  currentTab: 'dashboard',
  currentSignupStep: 1,
  selectedWithdrawAmt: 10000,
  withdrawnThisMonth: 8500,
  totalEarned: 38500,
  available: 15000,
  daysWorked: 22,
  totalDays: 26,
  todayEarned: 1750,
  user: {
    name: 'Rajan Kumar',
    firstName: 'Rajan',
    phone: '+91 98765 43210',
    email: 'rajan@example.com',
    company: 'Tata Consultancy Services',
    designation: 'Software Engineer',
    grossSalary: 55000,
    netSalary: 45000,
    payDate: 28,
    bank: 'SBI',
    accLast4: '4321'
  },
  chartInstance: null,
  txnChartInstance: null,
  creditGaugeInstance: null,
  currentFilter: 'all',
};

// ===== TRANSACTION DATA =====
const transactions = [
  { id: 'RF202606041234', type: 'withdrawal', title: 'Wage Advance', sub: 'Credited to SBI ••••4321', amount: 5000, date: 'Today, 2:30 PM', dateGroup: 'Today', sign: '+', colorClass: 'credit' },
  { id: 'RF202606041189', type: 'repayment', title: 'Auto Repayment', sub: 'Deducted from May salary', amount: 3000, date: 'Today, 10:00 AM', dateGroup: 'Today', sign: '-', colorClass: 'debit' },
  { id: 'RF202606031010', type: 'withdrawal', title: 'Wage Advance', sub: 'Credited to SBI ••••4321', amount: 8500, date: 'Jun 3, 4:15 PM', dateGroup: 'Jun 3', sign: '+', colorClass: 'credit' },
  { id: 'RF202605282001', type: 'salary', title: 'Salary Credit', sub: 'May 2026 – TCS Payroll', amount: 45000, date: 'May 28, 9:00 AM', dateGroup: 'May 28', sign: '+', colorClass: 'neutral' },
  { id: 'RF202605280044', type: 'repayment', title: 'Auto Repayment', sub: 'Deducted from May salary', amount: 15000, date: 'May 28, 9:01 AM', dateGroup: 'May 28', sign: '-', colorClass: 'debit' },
  { id: 'RF202605201123', type: 'withdrawal', title: 'Wage Advance', sub: 'Credited to SBI ••••4321', amount: 5000, date: 'May 20, 6:30 PM', dateGroup: 'May 20', sign: '+', colorClass: 'credit' },
  { id: 'RF202605100678', type: 'withdrawal', title: 'Wage Advance', sub: 'Credited to SBI ••••4321', amount: 10000, date: 'May 10, 12:00 PM', dateGroup: 'May 10', sign: '+', colorClass: 'credit' },
  { id: 'RF202604282001', type: 'salary', title: 'Salary Credit', sub: 'April 2026 – TCS Payroll', amount: 45000, date: 'Apr 28, 9:00 AM', dateGroup: 'Apr 28', sign: '+', colorClass: 'neutral' },
  { id: 'RF202604280044', type: 'repayment', title: 'Auto Repayment', sub: 'Deducted from April salary', amount: 8000, date: 'Apr 28, 9:01 AM', dateGroup: 'Apr 28', sign: '-', colorClass: 'debit' },
];

// ===== BOOT =====
document.addEventListener('DOMContentLoaded', () => {
  // Splash → Landing
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      document.getElementById('auth-page').classList.remove('hidden');
    }, 600);
  }, 2200);

  updateGreeting();
  renderDashboardTxns();
  renderFullTxns(transactions);
  updatePayCycleDate();
  setInterval(tickLiveEarnings, 60000);
});

// ===== GREETING =====
function updateGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting-text');
  if (!el) return;
  if (h < 12) el.textContent = 'Good Morning ☀️';
  else if (h < 17) el.textContent = 'Good Afternoon 🌤️';
  else if (h < 20) el.textContent = 'Good Evening 🌇';
  else el.textContent = 'Good Night 🌙';
}

function updatePayCycleDate() {
  const today = new Date();
  const payDay = AppState.user.payDate;
  let payDate = new Date(today.getFullYear(), today.getMonth(), payDay);
  if (payDate <= today) payDate = new Date(today.getFullYear(), today.getMonth() + 1, payDay);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const el = document.getElementById('pay-cycle-date');
  if (el) el.textContent = `${months[payDate.getMonth()]} ${payDate.getDate()}`;

  // Modal repay date
  const mrd = document.getElementById('modal-repay-date');
  if (mrd) mrd.textContent = `${months[payDate.getMonth()]} ${payDate.getDate()}, ${payDate.getFullYear()}`;

  // Days remaining
  const diff = Math.ceil((payDate - today) / (1000 * 60 * 60 * 24));
  const dr = document.getElementById('days-remaining');
  if (dr) dr.textContent = `${diff} day${diff !== 1 ? 's' : ''}`;
}

function tickLiveEarnings() {
  // Increment today's earnings by daily rate every minute (demo)
  const dailyRate = AppState.user.netSalary / (AppState.totalDays * 8 * 60);
  AppState.todayEarned = Math.min(AppState.todayEarned + dailyRate, AppState.user.netSalary / AppState.totalDays);
  const te = document.getElementById('today-earned');
  if (te) te.textContent = `₹${Math.round(AppState.todayEarned).toLocaleString('en-IN')}`;
}

// ===== PAGE / VIEW NAVIGATION =====
function showView(viewId) {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
}

function startSignup() {
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('signup-page').classList.remove('hidden');
  goToSignupStep(1);
}

function goToDashboard() {
  document.getElementById('signup-page').classList.add('hidden');
  document.getElementById('app-page').classList.remove('hidden');
  AppState.isLoggedIn = true;
  initDashboard();
  showTab('dashboard');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login-submit');
  const phone = (document.getElementById('login-phone').value || '').trim();
  const password = (document.getElementById('login-password').value || '').trim();

  btn.textContent = 'Signing in...';
  btn.disabled = true;

  // Try real API first
  if (API.isOnline() !== false) {
    const { ok, data } = await API.auth.login(phone, password);
    if (ok && data.success) {
      API.setToken(data.token);
      API.storeUser(data.user);
      // Populate AppState from real user
      _applyUserToState(data.user);
      _enterDashboard();
      btn.textContent = 'Sign In';
      btn.disabled = false;
      return;
    } else if (data.message && data.message !== 'Backend offline') {
      showToast('⚠️ ' + data.message);
      btn.textContent = 'Sign In';
      btn.disabled = false;
      return;
    }
  }

  // Fallback: demo mode (any credentials)
  setTimeout(() => {
    _enterDashboard();
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }, 1400);
}

function _enterDashboard() {
  document.getElementById('auth-page').classList.add('hidden');
  document.getElementById('app-page').classList.remove('hidden');
  AppState.isLoggedIn = true;
  initDashboard();
  showTab('dashboard');
}

function _applyUserToState(user) {
  if (!user) return;
  AppState.user.name       = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User';
  AppState.user.firstName  = user.first_name || 'User';
  AppState.user.phone      = user.phone || '';
  AppState.user.email      = user.email || '';
  AppState.user.company    = user.company || AppState.user.company;
  AppState.user.designation= user.designation || AppState.user.designation;
  AppState.user.grossSalary= user.gross_salary || AppState.user.grossSalary;
  AppState.user.netSalary  = user.net_salary   || AppState.user.netSalary;
  AppState.user.payDate    = parseInt(user.pay_date) || AppState.user.payDate;
  AppState.user.bank       = user.bank_name    || AppState.user.bank;
  AppState.user.accLast4   = user.acc_number   ? user.acc_number.slice(-4) : AppState.user.accLast4;
}

function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  API.clearToken();
  document.getElementById('app-page').classList.add('hidden');
  document.getElementById('auth-page').classList.remove('hidden');
  showView('landing-view');
  AppState.isLoggedIn = false;
}

// ===== SIGNUP STEPS =====
function goToSignupStep(step) {
  // Hide all steps
  document.querySelectorAll('.signup-step').forEach(s => s.classList.remove('active-step'));
  // Show target
  const target = document.getElementById(`step-${step}`);
  if (target) target.classList.add('active-step');

  // Update progress bar
  const pct = (step / 5) * 100;
  document.getElementById('signup-progress-fill').style.width = `${pct}%`;

  // Update step dots
  for (let i = 1; i <= 5; i++) {
    const ps = document.getElementById(`ps-${i}`);
    if (!ps) continue;
    ps.classList.remove('active', 'done');
    if (i < step) ps.classList.add('done');
    else if (i === step) ps.classList.add('active');
  }

  document.getElementById('step-indicator').textContent = `Step ${step} of 5`;
  AppState.currentSignupStep = step;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Trigger confetti on step 5
  if (step === 5) launchConfetti();
}

function nextStep(e, stepNum) {
  e.preventDefault();
  goToSignupStep(stepNum);
}

function signupBack() {
  if (AppState.currentSignupStep > 1) {
    goToSignupStep(AppState.currentSignupStep - 1);
  } else {
    document.getElementById('signup-page').classList.add('hidden');
    document.getElementById('auth-page').classList.remove('hidden');
    showView('landing-view');
  }
}

// ===== IDENTITY HELPERS =====
function aadhaarTab(el, nextId) {
  if (el.value.length >= 4) {
    const next = document.getElementById(nextId);
    if (next) next.focus();
  }
}

function handleFileUpload(inputId, boxId, label) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  const textEl = document.getElementById(`${inputId.replace('-file', '')}-upload-text`) ||
                  document.getElementById(`${boxId.replace('-box', '')}-upload-text`);

  if (input.files && input.files[0]) {
    box.classList.add('uploaded');
    const name = input.files[0].name;
    const shortName = name.length > 25 ? name.substring(0, 22) + '…' : name;
    // Find the span inside this box
    const spans = box.querySelectorAll('.upload-label span');
    if (spans[0]) spans[0].textContent = `✓ ${label} Uploaded: ${shortName}`;
    showToast(`${label} uploaded successfully!`);
  }
}

function mockSelfie() {
  const area = document.getElementById('selfie-area');
  area.innerHTML = `
    <div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#6C63FF,#3ECFCF);display:flex;align-items:center;justify-content:center;font-size:2rem;">🤳</div>
    <p style="color:var(--success);font-weight:600">Selfie Captured!</p>
    <small style="color:var(--text-3)">Tap to retake</small>
  `;
  area.style.cursor = 'pointer';
  area.onclick = mockSelfie;
  document.getElementById('selfie-done').value = 'done';
  showToast('Selfie captured! Looking good 😄');
}

// ===== BANK LINKING =====
function switchBankTab(tab) {
  document.querySelectorAll('.bank-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById('bank-manual').classList.toggle('hidden', tab !== 'manual');
  document.getElementById('bank-upi').classList.toggle('hidden', tab !== 'upi');

  // Remove required from hidden fields
  const manualFields = document.querySelectorAll('#bank-manual [required]');
  const upiFields = document.querySelectorAll('#bank-upi [required]');
  if (tab === 'manual') {
    manualFields.forEach(f => f.required = true);
    upiFields.forEach(f => f.required = false);
  } else {
    manualFields.forEach(f => f.required = false);
  }
}

function selectBank(name) {
  document.querySelectorAll('.bank-logo-btn').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  showToast(`${name} selected. You'll be redirected to NetBanking.`);
}

// ===== DASHBOARD INIT =====
async function initDashboard() {
  updateGreeting();

  // Collect signup form data (for new registrations)
  const fname = document.getElementById('s1-fname');
  if (fname && fname.value) {
    AppState.user.name = `${fname.value} ${document.getElementById('s1-lname').value || ''}`.trim();
    AppState.user.firstName = fname.value;
  }
  const company = document.getElementById('s3-company');
  if (company && company.value) AppState.user.company = company.value;
  const netSal = document.getElementById('s3-net-salary');
  if (netSal && netSal.value) {
    AppState.user.netSalary = parseInt(netSal.value);
  }

  // Try loading live dashboard data from API
  if (API.isOnline() !== false && API.getToken()) {
    const { ok, data } = await API.user.dashboard();
    if (ok && data.success) {
      const d = data.dashboard;
      AppState.totalEarned       = d.totalEarned;
      AppState.todayEarned       = d.todayEarned;
      AppState.available         = d.available;
      AppState.withdrawnThisMonth= d.withdrawn;
      AppState.daysWorked        = d.daysWorked;
      AppState.totalDays         = d.totalDays;
      AppState.user.name         = d.userName;
      AppState.user.firstName    = d.firstName;
      AppState.user.netSalary    = d.netSalary;
      AppState.user.grossSalary  = d.grossSalary;
      AppState.user.company      = d.company;
      AppState.user.designation  = d.designation;
      AppState.user.bank         = d.bankName;
      AppState.user.accLast4     = d.bankLast4;
      setEl('days-remaining', `${d.daysToPayday} day${d.daysToPayday !== 1 ? 's' : ''}`);
      const pcEl = document.getElementById('pay-cycle-date');
      if (pcEl) pcEl.textContent = d.payDateStr;
      const mrd = document.getElementById('modal-repay-date');
      if (mrd) mrd.textContent = d.payDateStr + ', 2026';
    }
  } else {
    // Fallback: compute from AppState
    const netSalary = AppState.user.netSalary || 45000;
    AppState.totalEarned = AppState.totalEarned || Math.round(netSalary * 0.8556);
    AppState.available   = AppState.available   || Math.round(netSalary * 0.333);
    AppState.todayEarned = AppState.todayEarned || Math.round(netSalary / 26);
    updatePayCycleDate();
  }

  // Update DOM
  const gname = document.getElementById('greeting-name');
  if (gname) gname.textContent = `${AppState.user.firstName} 👋`;
  const pname = document.getElementById('profile-name');
  if (pname) pname.textContent = AppState.user.name;
  const pdlname = document.getElementById('pdl-fullname');
  if (pdlname) pdlname.textContent = AppState.user.name;
  const headerAvatar = document.getElementById('header-avatar');
  if (headerAvatar) headerAvatar.textContent = (AppState.user.firstName || 'U').charAt(0).toUpperCase();
  const profileAvatarCircle = document.getElementById('profile-avatar-circle');
  if (profileAvatarCircle) profileAvatarCircle.textContent = (AppState.user.firstName || 'U').charAt(0).toUpperCase();

  // Numbers
  setEl('total-earned', AppState.totalEarned.toLocaleString('en-IN'));
  setEl('today-earned', `₹${AppState.todayEarned.toLocaleString('en-IN')}`);
  setEl('available-amount', `₹${AppState.available.toLocaleString('en-IN')}`);
  setEl('withdrawn-amount', `₹${AppState.withdrawnThisMonth.toLocaleString('en-IN')}`);
  setEl('days-worked', `${AppState.daysWorked} / ${AppState.totalDays}`);

  // Sync limit badge
  const limitBadge = document.querySelector('.limit-badge');
  if (limitBadge) limitBadge.textContent = `Max ₹${AppState.available.toLocaleString('en-IN')}`;

  updateWithdrawBtn(AppState.selectedWithdrawAmt);
  initCharts();
  renderDashboardTxns();
  await loadNotificationsBadge();
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== TAB NAVIGATION =====
function showTab(tab) {
  AppState.currentTab = tab;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.add('active-tab');
  const navEl = document.getElementById(`nav-${tab}`);
  if (navEl) navEl.classList.add('active');

  // Scroll to top
  const main = document.getElementById('app-main');
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' });

  // Close notif panel
  closeNotifications();

  // Lazy init charts for transactions tab
  if (tab === 'transactions' && !AppState.txnChartInstance) {
    setTimeout(initTxnChart, 100);
  }
  if (tab === 'profile' && !AppState.creditGaugeInstance) {
    setTimeout(initCreditGauge, 100);
  }
}

// ===== WITHDRAWAL FLOW =====
function selectAmt(amt) {
  AppState.selectedWithdrawAmt = amt;
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`amt-${amt}`);
  if (btn) btn.classList.add('active');
  document.getElementById('custom-amt-wrap').classList.add('hidden');
  updateWithdrawBtn(amt);
}

function showCustomAmt() {
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('amt-custom').classList.add('active');
  document.getElementById('custom-amt-wrap').classList.remove('hidden');
  const inp = document.getElementById('custom-amt-input');
  inp.focus();
  inp.addEventListener('input', () => {
    const v = parseInt(inp.value) || 0;
    AppState.selectedWithdrawAmt = v;
    updateWithdrawBtn(v);
  });
}

function updateWithdrawBtn(amt) {
  const btn = document.getElementById('btn-withdraw-main');
  if (btn) {
    if (amt > 0 && amt <= AppState.available) {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M12 5v14M5 12l7 7 7-7"/></svg> Withdraw ₹${amt.toLocaleString('en-IN')} Now`;
      btn.disabled = false;
    } else if (amt > AppState.available) {
      btn.textContent = `⚠️ Exceeds available limit (₹${AppState.available.toLocaleString('en-IN')})`;
      btn.disabled = true;
    } else {
      btn.textContent = 'Enter a valid amount';
      btn.disabled = true;
    }
  }
  // Update modal
  const ma = document.getElementById('modal-amount');
  if (ma) ma.textContent = `₹${amt.toLocaleString('en-IN')}`;
  const sm = document.getElementById('success-modal-body');
  if (sm) sm.textContent = `₹${amt.toLocaleString('en-IN')} has been credited to your SBI account ending in ••••${AppState.user.accLast4}`;
}

function triggerWithdrawal() {
  if (!AppState.selectedWithdrawAmt || AppState.selectedWithdrawAmt <= 0) {
    showToast('Please select an amount first');
    return;
  }
  if (AppState.selectedWithdrawAmt > AppState.available) {
    showToast('Amount exceeds available limit');
    return;
  }
  document.getElementById('modal-amount').textContent = `₹${AppState.selectedWithdrawAmt.toLocaleString('en-IN')}`;
  document.getElementById('withdrawal-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('withdrawal-modal').classList.add('hidden');
}

async function confirmWithdrawal() {
  const btn = document.getElementById('btn-confirm-withdraw');
  btn.textContent = 'Processing...';
  btn.disabled = true;
  const amount = AppState.selectedWithdrawAmt;

  // Try real API
  if (API.isOnline() !== false && API.getToken()) {
    const { ok, data } = await API.withdrawals.request(amount);
    if (ok && data.success) {
      closeModal();
      AppState.available          = data.newAvailable;
      AppState.withdrawnThisMonth+= amount;

      setEl('available-amount', `₹${AppState.available.toLocaleString('en-IN')}`);
      setEl('withdrawn-amount', `₹${AppState.withdrawnThisMonth.toLocaleString('en-IN')}`);
      const limitBadge = document.querySelector('.limit-badge');
      if (limitBadge) limitBadge.textContent = `Max ₹${AppState.available.toLocaleString('en-IN')}`;

      const txnId = data.txnId;
      document.getElementById('success-txn-id').textContent = txnId;
      document.getElementById('success-modal-body').textContent =
        `₹${amount.toLocaleString('en-IN')} has been credited to your ${AppState.user.bank} account ending in ••••${AppState.user.accLast4}`;

      if (data.transaction) {
        transactions.unshift(data.transaction);
        renderDashboardTxns();
        renderFullTxns(transactions);
      }
      if (AppState.chartInstance) {
        const ds = AppState.chartInstance.data.datasets[1].data;
        ds[ds.length - 1] += amount / 1000;
        AppState.chartInstance.update();
      }
      document.getElementById('success-modal').classList.remove('hidden');
      btn.textContent = 'Confirm →';
      btn.disabled = false;
      return;
    } else if (data.message && data.message !== 'Backend offline') {
      showToast('⚠️ ' + data.message);
      closeModal();
      btn.textContent = 'Confirm →';
      btn.disabled = false;
      return;
    }
  }

  // Fallback: local mock
  setTimeout(() => {
    closeModal();
    AppState.available          -= amount;
    AppState.withdrawnThisMonth += amount;
    setEl('available-amount', `₹${AppState.available.toLocaleString('en-IN')}`);
    setEl('withdrawn-amount', `₹${AppState.withdrawnThisMonth.toLocaleString('en-IN')}`);
    const limitBadge = document.querySelector('.limit-badge');
    if (limitBadge) limitBadge.textContent = `Max ₹${AppState.available.toLocaleString('en-IN')}`;
    const txnId = `RF${Date.now()}`.substring(0, 14);
    document.getElementById('success-txn-id').textContent = txnId;
    document.getElementById('success-modal-body').textContent =
      `₹${amount.toLocaleString('en-IN')} has been credited to your ${AppState.user.bank} account ending in ••••${AppState.user.accLast4}`;
    const newTxn = { id: txnId, type: 'withdrawal', title: 'Wage Advance',
      sub: `Credited to ${AppState.user.bank} ••••${AppState.user.accLast4}`,
      amount, date: 'Just now', dateGroup: 'Today', sign: '+', colorClass: 'credit' };
    transactions.unshift(newTxn);
    renderDashboardTxns();
    renderFullTxns(transactions);
    if (AppState.chartInstance) {
      const ds = AppState.chartInstance.data.datasets[1].data;
      ds[ds.length - 1] += amount / 1000;
      AppState.chartInstance.update();
    }
    document.getElementById('success-modal').classList.remove('hidden');
    btn.textContent = 'Confirm →';
    btn.disabled = false;
  }, 2000);
}

function closeSuccessModal() {
  document.getElementById('success-modal').classList.add('hidden');
  showToast('₹' + AppState.selectedWithdrawAmt.toLocaleString('en-IN') + ' credited successfully!');
  // Reset withdraw amount
  AppState.selectedWithdrawAmt = 10000;
  document.querySelectorAll('.amt-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('amt-10000').classList.add('active');
  updateWithdrawBtn(10000);
}

// ===== CHARTS =====
function initCharts() {
  initEarningsChart();
}

function initEarningsChart() {
  const ctx = document.getElementById('earningsChart');
  if (!ctx) return;
  if (AppState.chartInstance) AppState.chartInstance.destroy();

  const labels = Array.from({ length: 22 }, (_, i) => `${i + 1}`);
  const dailyEarned = labels.map(d => {
    const base = (AppState.user.netSalary / AppState.totalDays);
    return parseFloat((base + (Math.random() * 200 - 100)).toFixed(0)) / 1000;
  });
  const dailyWithdrawn = labels.map((_, i) => {
    if (i === 2) return 5.0;
    if (i === 9) return 8.5;
    if (i === 19) return 5.0;
    return 0;
  });

  AppState.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Earned (₹K)',
          data: dailyEarned,
          backgroundColor: 'rgba(108,99,255,0.65)',
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Withdrawn (₹K)',
          data: dailyWithdrawn,
          backgroundColor: 'rgba(62,207,207,0.7)',
          borderRadius: 4,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => `₹${(ctx.raw * 1000).toLocaleString('en-IN')}`
        }
      }},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#8A8AAD', maxTicksLimit: 11 } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 9 }, color: '#8A8AAD', callback: v => `₹${v}K` }, beginAtZero: true }
      }
    }
  });
}

function setChartView(view, btn) {
  document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (!AppState.chartInstance) return;
  const chart = AppState.chartInstance;

  if (view === 'daily') {
    chart.data.labels = Array.from({ length: 22 }, (_, i) => `${i + 1}`);
    chart.data.datasets[0].data = chart.data.labels.map(() => parseFloat(((AppState.user.netSalary / AppState.totalDays) / 1000 + Math.random() * 0.2 - 0.1).toFixed(2)));
  } else {
    chart.data.labels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];
    chart.data.datasets[0].data = [10.2, 11.5, 9.8, 7.0];
    chart.data.datasets[1].data = [5.0, 8.5, 0, 5.0];
  }
  chart.update();
}

function initTxnChart() {
  const ctx = document.getElementById('txnChart');
  if (!ctx || AppState.txnChartInstance) return;

  AppState.txnChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Withdrawn',
          data: [10000, 15000, 5000, 8000, 15000, 8500],
          borderColor: 'rgba(108,99,255,1)',
          backgroundColor: 'rgba(108,99,255,0.08)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: 'rgba(108,99,255,1)',
          pointRadius: 4,
        },
        {
          label: 'Repaid',
          data: [10000, 15000, 5000, 8000, 15000, 3000],
          borderColor: 'rgba(62,207,207,1)',
          backgroundColor: 'rgba(62,207,207,0.06)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: 'rgba(62,207,207,1)',
          pointRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8 } },
        tooltip: { callbacks: { label: ctx => `₹${ctx.raw.toLocaleString('en-IN')}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#8A8AAD' } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, color: '#8A8AAD', callback: v => `₹${(v/1000).toFixed(0)}K` }, beginAtZero: true }
      }
    }
  });
}

function initCreditGauge() {
  const ctx = document.getElementById('creditGauge');
  if (!ctx || AppState.creditGaugeInstance) return;

  const score = 782;
  const maxScore = 900;
  const pct = score / maxScore;

  AppState.creditGaugeInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, 1 - pct],
        backgroundColor: [
          createGradient(ctx, ['#6C63FF', '#3ECFCF']),
          '#f0f0f5'
        ],
        borderWidth: 0,
        borderRadius: 8,
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: '75%',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function createGradient(ctx, colors) {
  try {
    const canvas = ctx.canvas;
    const gradient = canvas.getContext('2d').createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    return gradient;
  } catch { return colors[0]; }
}

// ===== TRANSACTIONS =====
function renderDashboardTxns() {
  const container = document.getElementById('dashboard-txn-list');
  if (!container) return;
  const recent = transactions.slice(0, 4);
  container.innerHTML = recent.map(t => txnItemHTML(t)).join('');
}

async function loadTransactionsFromAPI(type) {
  if (API.isOnline() !== false && API.getToken()) {
    const { ok, data } = await API.transactions.list(type);
    if (ok && data.success && data.transactions.length > 0) {
      return data.transactions;
    }
  }
  return null; // fallback to local
}

function renderFullTxns(txns) {
  const container = document.getElementById('full-txn-list');
  if (!container) return;

  // Group by date
  const groups = {};
  txns.forEach(t => {
    const group = t.dateGroup || 'Recent';
    if (!groups[group]) groups[group] = [];
    groups[group].push(t);
  });

  container.innerHTML = Object.entries(groups).map(([group, items]) => `
    <div class="txn-group-header">${group}</div>
    ${items.map(t => txnItemHTML(t, true)).join('')}
  `).join('');
}

function txnItemHTML(t, full = false) {
  const icons = {
    withdrawal: { icon: '📤', class: 'withdrawal' },
    repayment: { icon: '🔄', class: 'repayment' },
    salary: { icon: '💰', class: 'salary' }
  };
  const ico = icons[t.type] || icons.withdrawal;
  const prefix = t.colorClass === 'credit' ? '+' : t.colorClass === 'debit' ? '-' : '';

  return `
    <div class="txn-item">
      <div class="txn-icon ${ico.class}">${ico.icon}</div>
      <div class="txn-info">
        <div class="txn-title">${t.title}</div>
        <div class="txn-sub">${t.sub}</div>
        ${full ? `<div class="txn-sub" style="font-size:0.7rem;margin-top:2px;opacity:0.6">ID: ${t.id}</div>` : ''}
      </div>
      <div class="txn-amount">
        <span class="txn-val ${t.colorClass}">${prefix}₹${t.amount.toLocaleString('en-IN')}</span>
        <span class="txn-date">${t.date}</span>
      </div>
    </div>
  `;
}

async function filterTxn(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  AppState.currentFilter = type;

  // Try API first
  const apiTxns = await loadTransactionsFromAPI(type);
  if (apiTxns) {
    renderFullTxns(apiTxns);
    return;
  }

  // Fallback: filter local
  const filtered = type === 'all' ? transactions : transactions.filter(t => t.type === type);
  renderFullTxns(filtered);
}

function downloadTransactions() {
  if (API.isOnline() !== false && API.getToken()) {
    const url = API.transactions.export();
    const a = document.createElement('a');
    a.href = `http://localhost:3001/api/transactions/export`;
    a.setAttribute('download', 'rajanpay_statement.csv');
    // Add auth header via fetch blob
    fetch('http://localhost:3001/api/transactions/export', {
      headers: { 'Authorization': `Bearer ${API.getToken()}` }
    }).then(r => r.blob()).then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = blobUrl;
      a2.download = 'rajanpay_statement.csv';
      a2.click();
      URL.revokeObjectURL(blobUrl);
      showToast('✅ Statement downloaded!');
    }).catch(() => showToast('Statement downloaded! (mock)'));
    return;
  }
  showToast('Downloading statement...');
  setTimeout(() => showToast('Statement downloaded!'), 1500);
}

// ===== PROFILE =====
function editProfile(section) {
  showToast(`Edit ${section} details – Coming soon!`);
}

// ===== NOTIFICATIONS =====
async function loadNotificationsBadge() {
  if (API.isOnline() !== false && API.getToken()) {
    const { ok, data } = await API.notifications.list();
    if (ok && data.success) {
      const dot = document.querySelector('.notif-dot');
      if (dot) dot.style.display = data.unreadCount > 0 ? '' : 'none';
    }
  }
}

async function showNotifications() {
  const panel = document.getElementById('notif-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    document.querySelector('.notif-dot').style.display = 'none';
    // Load real notifications if online
    if (API.isOnline() !== false && API.getToken()) {
      const { ok, data } = await API.notifications.list();
      if (ok && data.success && data.notifications.length > 0) {
        const list = document.querySelector('.notif-list');
        if (list) {
          list.innerHTML = data.notifications.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}">
              <div class="notif-icon ${n.icon_type === 'success' ? 'green' : n.icon_type === 'info' ? 'blue' : 'purple'}">₹</div>
              <div class="notif-body">
                <p><strong>${n.title}</strong></p>
                <small>${n.message}</small>
                <span class="notif-time">${new Date(n.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          `).join('');
        }
        API.notifications.readAll();
      }
    }
  }
}

function closeNotifications() {
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.add('hidden');
}

// Close notif on outside click
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('notif-btn');
  if (panel && !panel.classList.contains('hidden')) {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      closeNotifications();
    }
  }
});

// ===== TOAST =====
function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(AppState._toastTimer);
  AppState._toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ===== TOGGLE PASSWORD =====
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ===== CONFETTI =====
function launchConfetti() {
  const wrap = document.getElementById('confetti-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  const colors = ['#6C63FF', '#3ECFCF', '#FF9800', '#4CAF50', '#F44336', '#FF6B6B'];
  for (let i = 0; i < 50; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute;
      width: ${Math.random() * 8 + 4}px;
      height: ${Math.random() * 8 + 4}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      top: 0; left: 50%;
      animation: confetti-fall ${Math.random() * 2 + 1.5}s ease-out ${Math.random() * 0.5}s forwards;
      transform: translateX(${(Math.random() - 0.5) * 120}px);
    `;
    wrap.appendChild(dot);
  }

  // Add keyframe if not exists
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confetti-fall {
        0% { opacity: 1; transform: translateX(var(--tx, 0)) translateY(0) rotate(0deg); }
        100% { opacity: 0; transform: translateX(calc(var(--tx, 0) * 1.5)) translateY(120px) rotate(360deg); }
      }
      #confetti-wrap { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    `;
    document.head.appendChild(style);
  }

  // Add CSS var for each dot
  wrap.querySelectorAll('div').forEach(dot => {
    const tx = (Math.random() - 0.5) * 160;
    dot.style.setProperty('--tx', `${tx}px`);
    dot.style.transform = '';
    dot.style.animation = `confetti-fall ${Math.random() * 2 + 1.5}s ease-out ${Math.random() * 0.5}s forwards`;
  });
}

// ===== PAN INPUT UPPERCASE =====
const panInput = document.getElementById('s2-pan');
if (panInput) {
  panInput.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });
}

// ===== IFSC UPPERCASE =====
const ifscInput = document.getElementById('s4-ifsc');
if (ifscInput) {
  ifscInput.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });
}

// ===== LIVE BALANCE ANIMATION =====
function animateNumber(el, target, duration = 800) {
  if (!el) return;
  const start = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
  const diff = target - start;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + diff * eased);
    el.textContent = current.toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Close modals on overlay click
document.getElementById('withdrawal-modal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.getElementById('success-modal').addEventListener('click', function (e) {
  if (e.target === this) closeSuccessModal();
});

// Keyboard shortcuts (Escape to close modals)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeSuccessModal();
    closeNotifications();
  }
});

// ===== DATE DISPLAY HELPER =====
function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

console.log('%c🚀 RajanPay – Rajan Finance', 'color:#6C63FF;font-size:18px;font-weight:800;');
console.log('%cEarned Wage Access Platform | Academic Prototype', 'color:#3ECFCF;font-size:12px;');

// ===== SERVICE WORKER REGISTRATION =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[RajanPay] Service Worker registered:', reg.scope);
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('🔄 App updated! Refresh for latest version.');
            }
          });
        });
      })
      .catch((err) => console.log('[RajanPay] SW registration failed:', err));
  });
}

// ===== iOS INSTALL PROMPT =====
// Detect if running on iOS Safari and NOT already installed as PWA
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isInStandaloneMode() {
  return ('standalone' in window.navigator) && (window.navigator.standalone);
}

function showIOSInstallBanner() {
  // Only show on iOS Safari, not already installed, not already shown recently
  if (!isIOS() || isInStandaloneMode()) return;
  if (sessionStorage.getItem('iosPromptDismissed')) return;

  const banner = document.createElement('div');
  banner.id = 'ios-install-banner';
  banner.innerHTML = `
    <div class="ios-banner-content">
      <img src="apple-touch-icon.png" width="40" height="40" style="border-radius:9px;flex-shrink:0" alt="RajanPay" />
      <div class="ios-banner-text">
        <strong>Add to Home Screen</strong>
        <span>Tap <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="vertical-align:middle;margin:0 2px"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> then "Add to Home Screen"</span>
      </div>
      <button onclick="dismissIOSBanner()" class="ios-banner-close">✕</button>
    </div>
    <div class="ios-banner-arrow">▼</div>
  `;
  document.body.appendChild(banner);

  // Inject banner styles
  const style = document.createElement('style');
  style.textContent = `
    #ios-install-banner {
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      z-index: 500; width: calc(100% - 32px); max-width: 400px;
      animation: bannerSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes bannerSlideUp {
      from { opacity:0; transform: translateX(-50%) translateY(20px); }
      to { opacity:1; transform: translateX(-50%) translateY(0); }
    }
    .ios-banner-content {
      background: rgba(26,26,46,0.96); backdrop-filter: blur(12px);
      border: 1px solid rgba(108,99,255,0.3); border-radius: 18px;
      padding: 14px 16px; display: flex; align-items: center; gap: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .ios-banner-text { flex: 1; }
    .ios-banner-text strong { display: block; color: #fff; font-size: 0.88rem; font-weight: 700; margin-bottom: 2px; font-family: var(--font); }
    .ios-banner-text span { font-size: 0.78rem; color: rgba(255,255,255,0.65); font-family: var(--font); }
    .ios-banner-close { background: rgba(255,255,255,0.15); border: none; color: #fff; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 0.75rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .ios-banner-arrow { text-align: center; color: rgba(108,99,255,0.7); font-size: 1.2rem; margin-top: 2px; animation: bounce 1.5s infinite; }
    @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(4px)} }
  `;
  document.head.appendChild(style);
}

function dismissIOSBanner() {
  const banner = document.getElementById('ios-install-banner');
  if (banner) {
    banner.style.animation = 'none';
    banner.style.opacity = '0';
    banner.style.transform = 'translateX(-50%) translateY(20px)';
    banner.style.transition = 'all 0.3s ease';
    setTimeout(() => banner.remove(), 300);
  }
  sessionStorage.setItem('iosPromptDismissed', 'true');
}

// Show the iOS banner after the app dashboard loads (with a small delay)
const _origGoToDashboard = goToDashboard;
window.goToDashboard = function() {
  _origGoToDashboard();
  setTimeout(showIOSInstallBanner, 3000);
};
const _origHandleLogin = handleLogin;
// Also show after login
setTimeout(() => {
  if (isIOS() && !isInStandaloneMode()) {
    // Small delay after page is stable
    window.addEventListener('rajanpay-loggedin', () => setTimeout(showIOSInstallBanner, 3000), { once: true });
  }
}, 100);

