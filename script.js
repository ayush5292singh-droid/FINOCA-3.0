
"use strict";

/* FINOVA — browser-based personal finance app
   Data is stored locally in this browser. Pro payments are not connected. */

const APP_KEY = "finova_premium_app_v1";

const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills", "Health", "Education",
  "Rent", "Salary", "Investment", "Travel", "Entertainment", "Other"
];

const NAV = [
  ["transactions", "↔", "Transactions"],
  ["accounts", "▤", "Accounts & Cards"],
  ["budgets", "◷", "Budgets"],
  ["goals", "◎", "Savings Goals"],
  ["loans", "⌁", "Loans & EMI"],
  ["recurring", "⟳", "Recurring Payments"],
  ["scanner", "▧", "Receipt Scanner"],
  ["analytics", "▥", "Analytics & Reports"]
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthKey = (date = today()) => String(date).slice(0, 7);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));

const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

const fmtDate = date => date
  ? new Date(date + "T12:00:00").toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    })
  : "No date";

function freshState() {
  return {
    profile: null,
    currency: "INR",
    theme: "dark",
    balanceHidden: false,
    accounts: [
      { id: "cash-main", name: "Main Wallet", type: "Cash", balance: 0, color: "green" }
    ],
    transactions: [],
    budgets: [],
    goals: [],
    loans: [],
    recurring: [],
    membership: { tier: "free", status: "inactive", expiresAt: null },
    settings: { notifications: false },
    onboardingDone: false
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(APP_KEY));
    if (!saved || typeof saved !== "object") return freshState();

    const base = freshState();
    const merged = { ...base, ...saved };

    for (const key of ["accounts", "transactions", "budgets", "goals", "loans", "recurring"]) {
      if (!Array.isArray(merged[key])) merged[key] = base[key];
    }

    if (!merged.accounts.length) merged.accounts = base.accounts;
    if (!merged.settings) merged.settings = base.settings;
    if (!merged.membership) merged.membership = base.membership;

    return merged;
  } catch {
    return freshState();
  }
}

let state = loadState();
let currentPage = "dashboard";
let menuOpen = false;
let modalType = "";
let modalExtra = {};
let toastTimer;
let scannerImage = "";

function save() {
  try {
    localStorage.setItem(APP_KEY, JSON.stringify(state));
  } catch {
    notify("Storage is full. Export your backup and remove unused data.");
  }
}

function money(value) {
  if (state.balanceHidden) return "••••••";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: state.currency || "INR",
      maximumFractionDigits: 2
    }).format(num(value));
  } catch {
    return "₹" + num(value).toFixed(2);
  }
}

function signedMoney(value, kind) {
  const sign = kind === "income" ? "+" : kind === "expense" ? "−" : "";
  return sign + money(Math.abs(num(value)));
}

function notify(message) {
  const el = document.getElementById("toast");
  if (!el) return;

  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function totalIncome() {
  return state.transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + num(t.amount), 0);
}

function totalExpenses() {
  return state.transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + num(t.amount), 0);
}

function netBalance() {
  return state.accounts.reduce((sum, a) => sum + num(a.balance), 0);
}

function accountName(id) {
  return state.accounts.find(a => a.id === id)?.name || "Unknown account";
}

function categoryOptions(selected = "") {
  return CATEGORIES.map(c =>
    `<option value="${esc(c)}" ${c === selected ? "selected" : ""}>${esc(c)}</option>`
  ).join("");
}

function accountOptions(selected = "") {
  return state.accounts.map(a =>
    `<option value="${esc(a.id)}" ${a.id === selected ? "selected" : ""}>${esc(a.name)}</option>`
  ).join("");
}

function pageTitle(page) {
  return ({
    dashboard: "Your financial overview",
    transactions: "Transactions",
    accounts: "Accounts & Cards",
    budgets: "Budgets",
    goals: "Savings Goals",
    loans: "Loans & EMI",
    recurring: "Recurring Payments",
    scanner: "Receipt Scanner",
    analytics: "Analytics & Reports",
    pro: "FINOVA Pro",
    settings: "Settings"
  })[page] || "FINOVA";
}

function membershipInfo() {
  const m = state.membership || {};
  const active = m.status === "active" &&
    (!m.expiresAt || new Date(m.expiresAt) > new Date());

  if (!active) {
    return {
      tier: "free",
      label: "FINOVA Free",
      badge: "STANDARD",
      cls: "membership-free",
      note: "Your financial journey starts here."
    };
  }

  if (m.tier === "gold-yearly") {
    return {
      tier: m.tier,
      label: "FINOVA Gold",
      badge: "YEARLY PLAN",
      cls: "membership-gold",
      note: "Yearly plan · Active"
    };
  }

  return {
    tier: "platinum-monthly",
    label: "FINOVA Platinum",
    badge: "MONTHLY PLAN",
    cls: "membership-platinum",
    note: "Monthly plan · Active"
  };
}

function membershipCard() {
  const m = membershipInfo();

  return `<div class="membership ${m.cls}">
    <div class="membership-top">
      <div>
        <div class="eyebrow">Your membership</div>
        <h2>${m.label}</h2>
      </div>
      <span class="plan-badge">${m.badge}</span>
    </div>
    <div class="membership-bottom">
      <div>
        <div class="membership-note">${m.note}</div>
        <div style="font-weight:800;letter-spacing:.13em;margin-top:9px;font-size:12px">F I N O V A</div>
      </div>
      <div style="font-size:27px;opacity:.65">✧</div>
    </div>
  </div>`;
}

function transactionRows(items, actions = true) {
  if (!items.length) {
    return `<div class="empty-state">
      <div class="empty-icon">↔</div>
      <p>No transactions yet.</p>
      <small>Add your first income or expense.</small>
    </div>`;
  }

  return `<div class="transaction-list">${items.map(t => `
    <div class="transaction-row">
      <div class="mini-icon">${t.type === "income" ? "↙" : "↗"}</div>
      <div class="transaction-info">
        <strong>${esc(t.title)}</strong>
        <small>${esc(t.category)} · ${esc(accountName(t.accountId))} · ${fmtDate(t.date)}</small>
      </div>
      <div style="text-align:right">
        <div class="transaction-amount ${t.type === "income" ? "positive" : "negative"}">${signedMoney(t.amount, t.type)}</div>
        ${actions ? `<div class="inline" style="justify-content:flex-end;margin-top:7px;gap:5px">
          <button class="ghost-btn" data-action="edit-transaction" data-id="${esc(t.id)}" style="padding:5px 8px;font-size:11px">Edit</button>
          <button class="ghost-btn" data-action="delete-transaction" data-id="${esc(t.id)}" style="padding:5px 8px;font-size:11px">×</button>
        </div>` : ""}
      </div>
    </div>`).join("")}</div>`;
}

function pageHeader(title, subtitle, action = "") {
  return `<div class="page-heading">
    <div><h1>${title}</h1><p>${subtitle}</p></div>
    <div class="inline">${action}</div>
  </div>`;
}

function emptyCard(icon, title, description, button = "") {
  return `<div class="card empty-state">
    <div class="empty-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${description}</p>
    ${button ? `<div style="margin-top:17px">${button}</div>` : ""}
  </div>`;
}

function chartMarkup() {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const label = d.toLocaleDateString("en-IN", { month: "short" });

    const income = state.transactions
      .filter(t => t.type === "income" && monthKey(t.date) === key)
      .reduce((s, t) => s + num(t.amount), 0);

    const expense = state.transactions
      .filter(t => t.type === "expense" && monthKey(t.date) === key)
      .reduce((s, t) => s + num(t.amount), 0);

    months.push({ key, label, income, expense });
  }

  const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));

  return `<div class="bar-chart">${months.map(m => `
    <div class="bar-column">
      <div class="bar-value">${m.income + m.expense ? esc(shortAmount(Math.max(m.income, m.expense))) : "—"}</div>
      <div class="bar-track">
        <div class="bar-fill" title="Income ${money(m.income)}; expenses ${money(m.expense)}" style="height:${Math.max(3, m.income / max * 100)}%"></div>
      </div>
      <div class="bar-label">${m.label}</div>
    </div>`).join("")}</div>
    <div class="inline" style="margin-top:12px;gap:17px;font-size:12px">
      <span class="positive">● Income</span>
      <span class="negative">● Expenses shown in reports</span>
    </div>`;
}

function shortAmount(value) {
  const n = num(value);
  if (n >= 10000000) return (n / 10000000).toFixed(1) + "Cr";
  if (n >= 100000) return (n / 100000).toFixed(1) + "L";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return Math.round(n).toString();
}

function dashboardPage() {
  const recent = [...state.transactions]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 5);

  const activeBudgets = state.budgets.filter(b => !b.period || b.period === monthKey());

  return `${pageHeader(
    "Good " + greeting() + ", " + esc(state.profile?.name || "there"),
    "Here is your money at a glance."
  )}
    <div class="grid grid-2">
      ${membershipCard()}
      <div class="card balance-card">
        <div class="balance-top">
          <div class="eyebrow">Total account balance</div>
          <button class="icon-btn" data-action="toggle-balance" aria-label="Toggle balance visibility">${state.balanceHidden ? "◉" : "◎"}</button>
        </div>
        <div class="big-number balance-amount">${money(netBalance())}</div>
        <div class="balance-footer">
          <div><span>Total income</span><strong class="positive">${money(totalIncome())}</strong></div>
          <div><span>Total expenses</span><strong class="negative">${money(totalExpenses())}</strong></div>
        </div>
      </div>
    </div>

    <div style="margin-top:18px">
      <button class="shortcut" data-action="add-transaction">
        <span>
          <span style="display:block;font-size:17px">+ Add transaction</span>
          <span style="display:block;font-size:12px;font-weight:500;opacity:.72;margin-top:4px">Record income or an expense</span>
        </span>
        <span class="shortcut-symbol">↗</span>
      </button>
    </div>

    <div class="section-heading">
      <h2>Monthly overview</h2>
      <button class="ghost-btn" data-page="analytics">View reports ↗</button>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="eyebrow">Cash flow</div>
        <h2 style="margin-top:9px">${money(totalIncome() - totalExpenses())}</h2>
        <p class="muted">Income minus expenses · all recorded time</p>
        ${chartMarkup()}
      </div>
      <div class="card">
        <div class="section-heading" style="margin-top:0">
          <h3>Recent transactions</h3>
          <button class="ghost-btn" data-page="transactions">View all</button>
        </div>
        ${transactionRows(recent, false)}
      </div>
    </div>

    <div class="section-heading">
      <h2>Your accounts</h2>
      <button class="ghost-btn" data-page="accounts">Manage accounts</button>
    </div>

    <div class="grid grid-3">${state.accounts.slice(0, 3).map(a => `
      <div class="card stat-card">
        <div>
          <div class="eyebrow">${esc(a.type)}</div>
          <div style="font-weight:700;margin:8px 0">${esc(a.name)}</div>
          <div class="small-number">${money(a.balance)}</div>
        </div>
        <div class="mini-icon">▤</div>
      </div>`).join("")}
    </div>

    ${activeBudgets.length ? `
      <div class="section-heading">
        <h2>Budget snapshot</h2>
        <button class="ghost-btn" data-page="budgets">Open budgets</button>
      </div>
      <div class="grid grid-2">${activeBudgets.slice(0, 2).map(b => {
        const used = state.transactions
          .filter(t => t.type === "expense" && t.category === b.category && monthKey(t.date) === monthKey())
          .reduce((s, t) => s + num(t.amount), 0);

        const pct = num(b.limit) ? used / num(b.limit) * 100 : 0;

        return `<div class="card">
          <div class="row-between">
            <strong>${esc(b.category)}</strong>
            <span class="pill ${pct >= 100 ? "red" : "green"}">${Math.round(pct)}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${pct >= 100 ? "over" : ""}" style="width:${Math.min(100, pct)}%"></div>
          </div>
          <small>${money(used)} spent of ${money(b.limit)}</small>
        </div>`;
      }).join("")}</div>` : ""}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function transactionsPage() {
  return `${pageHeader(
    "Transactions",
    "Your income and expenses, all in one place.",
    `<button class="primary-btn" data-action="add-transaction">+ Add transaction</button>`
  )}
    <div class="card">
      <div class="grid grid-3">
        <div class="field">
          <label for="transaction-search">Search</label>
          <input id="transaction-search" class="search-input" placeholder="Search title or category">
        </div>
        <div class="field">
          <label for="transaction-type-filter">Type</label>
          <select id="transaction-type-filter">
            <option value="all">All transactions</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
        </div>
        <div class="field">
          <label for="transaction-month-filter">Month</label>
          <input id="transaction-month-filter" type="month" value="${monthKey()}">
        </div>
      </div>
      <div id="transaction-results" style="margin-top:18px">
        ${transactionRows([...state.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || "")))}
      </div>
    </div>`;
}

function accountsPage() {
  return `${pageHeader(
    "Accounts & Cards",
    "Keep wallets, accounts and your visual debit cards organized.",
    `<button class="primary-btn" data-action="add-account">+ Add account</button>`
  )}
    <div class="grid grid-3">${state.accounts.map(a => `
      <div class="account-card ${esc(a.color || "green")}">
        <div class="row-between">
          <div class="eyebrow" style="color:inherit">${esc(a.type)}</div>
          <div class="card-chip"></div>
        </div>
        <div>
          <div class="account-balance">${money(a.balance)}</div>
          <div style="margin-top:5px;font-weight:700">${esc(a.name)}</div>
        </div>
        <div class="account-meta">
          <span>FINOVA VIRTUAL</span>
          <span>•••• ${esc(a.id.slice(-4).toUpperCase())}</span>
        </div>
        <div class="inline" style="position:relative;z-index:2;margin-top:12px">
          <button class="secondary-btn" data-action="edit-account" data-id="${esc(a.id)}">Edit</button>
          <button class="secondary-btn" data-action="transfer" data-id="${esc(a.id)}">Transfer</button>
        </div>
      </div>`).join("")}</div>

    <p class="muted" style="font-size:12px;margin-top:17px">
      These are simulated cards for organizing your app data. They are not real bank-issued debit cards and cannot make payments.
    </p>

    <div class="section-heading"><h2>Recent account activity</h2></div>
    <div class="card">
      ${transactionRows([...state.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 10))}
    </div>`;
}

function budgetsPage() {
  const budgets = state.budgets;

  return `${pageHeader(
    "Budgets",
    "Set limits and keep an eye on spending.",
    `<button class="primary-btn" data-action="add-budget">+ Create budget</button>`
  )}
    ${budgets.length ? `<div class="grid grid-2">${budgets.map(b => {
      const used = state.transactions
        .filter(t => t.type === "expense" && t.category === b.category && monthKey(t.date) === (b.period || monthKey()))
        .reduce((s, t) => s + num(t.amount), 0);

      const pct = num(b.limit) ? used / num(b.limit) * 100 : 0;

      return `<div class="card">
        <div class="row-between">
          <div>
            <div class="eyebrow">Monthly budget</div>
            <h2 style="margin-top:8px">${esc(b.category)}</h2>
          </div>
          <button class="ghost-btn" data-action="delete-budget" data-id="${esc(b.id)}">Remove</button>
        </div>
        <div class="big-number" style="font-size:27px">${money(Math.max(0, num(b.limit) - used))}</div>
        <small>Remaining · ${money(used)} of ${money(b.limit)} spent</small>
        <div class="progress-track">
          <div class="progress-fill ${pct >= 100 ? "over" : ""}" style="width:${Math.min(100, pct)}%"></div>
        </div>
        <span class="pill ${pct >= 100 ? "red" : pct >= 80 ? "gold" : "green"}">
          ${pct >= 100 ? "Limit reached" : pct >= 80 ? "Approaching limit" : "On track"} · ${Math.round(pct)}%
        </span>
      </div>`;
    }).join("")}</div>` : emptyCard(
      "◷",
      "Your budget starts here",
      "Create a category limit to track your spending.",
      `<button class="primary-btn" data-action="add-budget">Create your first budget</button>`
    )}

    <p class="muted" style="font-size:12px;margin-top:18px">
      Budget usage is calculated from expenses in the selected month. Alerts are shown in this app; push notifications are not configured.
    </p>`;
}

function goalsPage() {
  return `${pageHeader(
    "Savings Goals",
    "Make progress towards things that matter.",
    `<button class="primary-btn" data-action="add-goal">+ New goal</button>`
  )}
    ${state.goals.length ? `<div class="grid grid-2">${state.goals.map(g => {
      const pct = num(g.target) > 0 ? num(g.saved) / num(g.target) * 100 : 0;

      return `<div class="card">
        <div class="row-between">
          <div>
            <div class="eyebrow">Savings goal</div>
            <h2 style="margin-top:8px">${esc(g.name)}</h2>
            <small>${g.date ? "Target date: " + fmtDate(g.date) : "No target date"}</small>
          </div>
          <div class="goal-circle" style="--progress:${Math.min(100, pct)}%">
            <span>${Math.round(pct)}%</span>
          </div>
        </div>
        <div class="small-number" style="margin-top:20px">${money(g.saved)}</div>
        <small>of ${money(g.target)}</small>
        <div class="progress-track">
          <div class="progress-fill" style="width:${Math.min(100, pct)}%"></div>
        </div>
        <div class="inline">
          <button class="primary-btn" data-action="contribute-goal" data-id="${esc(g.id)}">+ Add savings</button>
          <button class="ghost-btn" data-action="edit-goal" data-id="${esc(g.id)}">Edit</button>
          <button class="ghost-btn" data-action="delete-goal" data-id="${esc(g.id)}">×</button>
        </div>
        ${pct >= 100 ? `<p class="positive" style="margin-top:14px">Goal reached. Well done!</p>` : ""}
      </div>`;
    }).join("")}</div>` : emptyCard(
      "◎",
      "Give your money a goal",
      "Create a goal, choose a target, and track each contribution.",
      `<button class="primary-btn" data-action="add-goal">Create a savings goal</button>`
    )}

    <p class="muted" style="font-size:12px;margin-top:17px">
      Goal contributions are tracked separately and do not move account balances unless you record the related transaction.
    </p>`;
}

function calculateEMI(principal, annualRate, months) {
  const p = Math.max(0, num(principal));
  const n = Math.max(0, Math.floor(num(months)));
  const r = Math.max(0, num(annualRate)) / 1200;

  if (!p || !n) return 0;
  if (!r) return p / n;

  const pow = Math.pow(1 + r, n);
  return p * r * pow / (pow - 1);
}

function loansPage() {
  return `${pageHeader(
    "Loans & EMI",
    "Track balances, repayments and estimated monthly payments.",
    `<button class="primary-btn" data-action="add-loan">+ Add loan</button>`
  )}
    ${state.loans.length ? `<div class="grid grid-2">${state.loans.map(l => {
      const paid = num(l.paid);
      const principal = num(l.principal);
      const remaining = Math.max(0, principal - paid);
      const pct = principal > 0 ? Math.min(100, paid / principal * 100) : 0;
      const emi = calculateEMI(remaining, l.rate, l.months);

      return `<div class="card">
        <div class="row-between">
          <div>
            <div class="eyebrow">Loan account</div>
            <h2 style="margin-top:8px">${esc(l.name)}</h2>
          </div>
          <span class="pill">${num(l.rate)}% p.a.</span>
        </div>
        <div class="eyebrow" style="margin-top:20px">Outstanding (simple tracking)</div>
        <div class="big-number" style="font-size:30px;margin:7px 0">${money(remaining)}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="row-between">
          <small>${money(paid)} tracked as repaid</small>
          <small>${Math.round(pct)}%</small>
        </div>
        <div class="grid grid-2" style="margin-top:18px;gap:10px">
          <div><small>Estimated EMI</small><div style="font-weight:800;margin-top:5px">${money(emi)}</div></div>
          <div><small>Term</small><div style="font-weight:800;margin-top:5px">${esc(l.months)} months</div></div>
        </div>
        <div class="inline" style="margin-top:20px">
          <button class="primary-btn" data-action="repay-loan" data-id="${esc(l.id)}">Record repayment</button>
          <button class="ghost-btn" data-action="delete-loan" data-id="${esc(l.id)}">Remove</button>
        </div>
        <p class="muted" style="font-size:11px;margin-top:14px">Repayments reduce the tracked principal here. This is not a lender statement.</p>
      </div>`;
    }).join("")}</div>` : emptyCard(
      "⌁",
      "Keep your loans organized",
      "Add the principal, interest rate and term to estimate an EMI.",
      `<button class="primary-btn" data-action="add-loan">Add a loan</button>`
    )}

    <div class="card" style="margin-top:20px">
      <h2>EMI calculator</h2>
      <p class="muted">Estimate a standard monthly payment.</p>
      <div class="form-grid">
        <div class="field"><label for="emi-principal">Loan amount</label><input id="emi-principal" type="number" min="0" placeholder="e.g. 100000"></div>
        <div class="field"><label for="emi-rate">Annual interest (%)</label><input id="emi-rate" type="number" min="0" step=".01" placeholder="e.g. 9"></div>
        <div class="field"><label for="emi-months">Term (months)</label><input id="emi-months" type="number" min="1" placeholder="e.g. 24"></div>
      </div>
      <div class="row-between" style="margin-top:18px">
        <span class="muted">Estimated monthly EMI</span>
        <strong id="emi-result" class="small-number">—</strong>
      </div>
    </div>`;
}

function recurringPage() {
  return `${pageHeader(
    "Recurring Payments",
    "Keep an organized list of repeated bills and income.",
    `<button class="primary-btn" data-action="add-recurring">+ Add schedule</button>`
  )}
    ${state.recurring.length ? `<div class="grid grid-2">${state.recurring.map(r => `
      <div class="card">
        <div class="row-between">
          <div class="mini-icon">${r.type === "income" ? "↙" : "↗"}</div>
          <span class="pill ${r.type === "income" ? "green" : "red"}">${esc(r.type)}</span>
        </div>
        <h2 style="margin-top:15px">${esc(r.title)}</h2>
        <div class="big-number" style="font-size:27px">${money(r.amount)}</div>
        <p class="muted">${esc(r.category)} · ${esc(r.frequency)}</p>
        <div class="row-between">
          <small>Next due: ${fmtDate(r.nextDate)}</small>
          <span class="pill">${esc(r.status || "scheduled")}</span>
        </div>
        <div class="inline" style="margin-top:17px">
          <button class="primary-btn" data-action="record-recurring" data-id="${esc(r.id)}">Record now</button>
          <button class="ghost-btn" data-action="toggle-recurring" data-id="${esc(r.id)}">${r.status === "paused" ? "Resume" : "Pause"}</button>
          <button class="ghost-btn" data-action="delete-recurring" data-id="${esc(r.id)}">×</button>
        </div>
      </div>`).join("")}</div>` : emptyCard(
      "⟳",
      "Plan recurring payments",
      "Add rent, subscriptions, regular bills or recurring income.",
      `<button class="primary-btn" data-action="add-recurring">Add a schedule</button>`
    )}

    <p class="muted" style="font-size:12px;margin-top:18px">
      Schedules do not automatically deduct money or send notifications. Use “Record now” when a payment actually happens.
    </p>`;
}

function scannerPage() {
  return `${pageHeader(
    "Receipt Scanner",
    "Upload a receipt image and review the details before saving.",
    `<button class="primary-btn" data-action="choose-receipt">↑ Upload receipt</button>`
  )}
    <div class="grid grid-2">
      <div class="card">
        <div class="mini-icon">▧</div>
        <h2 style="margin-top:17px">Receipt capture</h2>
        <p class="muted">Choose an image from your device. You can then enter or correct the details manually.</p>
        <button class="primary-btn full-btn" data-action="choose-receipt">Choose receipt image</button>
        <div id="receipt-preview" style="margin-top:15px">
          ${scannerImage
            ? `<img class="scanner-preview" src="${scannerImage}" alt="Selected receipt">`
            : `<div class="empty-state"><div class="empty-icon">▤</div><p>No receipt selected.</p></div>`}
        </div>
      </div>

      <div class="card">
        <h2>Review expense</h2>
        <p class="muted">The image is not automatically read in this version. Enter the information below and check it before saving.</p>
        <form id="receipt-form" class="form-grid">
          <div class="field full"><label for="receipt-title">Merchant or description</label><input id="receipt-title" name="title" required placeholder="e.g. Grocery shop"></div>
          <div class="field"><label for="receipt-amount">Total amount</label><input id="receipt-amount" name="amount" type="number" min=".01" step=".01" required></div>
          <div class="field"><label for="receipt-date">Date</label><input id="receipt-date" name="date" type="date" value="${today()}" required></div>
          <div class="field"><label for="receipt-category">Category</label><select id="receipt-category" name="category">${categoryOptions("Food")}</select></div>
          <div class="field"><label for="receipt-account">Account</label><select id="receipt-account" name="accountId">${accountOptions()}</select></div>
          <div class="field full"><button class="primary-btn full-btn" type="submit">Save as expense</button></div>
        </form>
      </div>
    </div>`;
}

function analyticsPage() {
  const income = totalIncome();
  const expenses = totalExpenses();
  const categoryTotals = {};

  state.transactions.filter(t => t.type === "expense").forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + num(t.amount);
  });

  const categories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...categories.map(x => x[1]));

  return `${pageHeader(
    "Analytics & Reports",
    "Understand your spending using your recorded data.",
    `<button class="secondary-btn" data-action="export-csv">Export CSV</button>`
  )}
    <div class="grid grid-3">
      <div class="card"><div class="eyebrow">Recorded income</div><div class="small-number positive" style="margin-top:10px">${money(income)}</div></div>
      <div class="card"><div class="eyebrow">Recorded expenses</div><div class="small-number negative" style="margin-top:10px">${money(expenses)}</div></div>
      <div class="card"><div class="eyebrow">Net cash flow</div><div class="small-number ${income - expenses >= 0 ? "positive" : "negative"}" style="margin-top:10px">${money(income - expenses)}</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:18px">
      <div class="card">
        <h2>Income trend</h2>
        <p class="muted">Last six calendar months</p>
        ${chartMarkup()}
      </div>
      <div class="card">
        <h2>Expenses by category</h2>
        <p class="muted">Across all recorded transactions</p>
        ${categories.length ? categories.map(([cat, amount]) => `
          <div style="margin:17px 0">
            <div class="row-between"><span>${esc(cat)}</span><strong>${money(amount)}</strong></div>
            <div class="progress-track"><div class="progress-fill" style="width:${amount / max * 100}%"></div></div>
          </div>`).join("") : `<div class="empty-state"><div class="empty-icon">▥</div><p>No expense data yet.</p></div>`}
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="row-between">
        <div><h2>Account balances</h2><p class="muted">Current totals by account</p></div>
        <button class="secondary-btn" data-action="export-backup">Backup JSON</button>
      </div>
      ${state.accounts.map(a => `
        <div class="settings-row">
          <div><strong>${esc(a.name)}</strong><p>${esc(a.type)}</p></div>
          <strong>${money(a.balance)}</strong>
        </div>`).join("")}
    </div>

    <p class="muted" style="font-size:12px;margin-top:16px">
      Reports reflect data saved in this browser, not live bank data. PDF export and automatic bank synchronization are not configured.
    </p>`;
}

function proPage() {
  const m = membershipInfo();

  return `${pageHeader("FINOVA Pro", "More insight for your financial journey.")}
    ${membershipCard()}

    <div class="section-heading">
      <h2>Choose your plan</h2>
      <span class="pill">${m.tier === "free" ? "Free plan active" : "Membership active"}</span>
    </div>

    <div class="grid grid-3">
      <div class="card plan-card">
        <span class="pill">CURRENT STARTER</span>
        <h2 style="margin-top:15px">Free</h2>
        <div class="plan-price">₹0</div>
        <p class="muted">Start managing your money.</p>
        <ul class="benefit-list">
          <li>Transactions and accounts</li>
          <li>Budgets and savings goals</li>
          <li>Loan and recurring trackers</li>
          <li>Basic reports and CSV export</li>
          <li>Local device data</li>
        </ul>
        <button class="secondary-btn full-btn" disabled>Included</button>
      </div>

      <div class="card plan-card ${m.tier === "platinum-monthly" ? "selected" : ""}">
        <span class="pill">PLATINUM</span>
        <h2 style="margin-top:15px">Monthly</h2>
        <div class="plan-price">₹99 <small>/ month</small></div>
        <p class="muted">Premium tools, billed monthly when payments are integrated.</p>
        <ul class="benefit-list">
          <li>Platinum membership card theme</li>
          <li>Advanced report experience</li>
          <li>Detailed category insights</li>
          <li>Premium visual themes</li>
          <li>Enhanced money summaries</li>
        </ul>
        <button class="primary-btn full-btn" data-action="subscribe" data-tier="platinum-monthly">Choose monthly</button>
      </div>

      <div class="card plan-card ${m.tier === "gold-yearly" ? "selected" : ""}">
        <span class="pill gold">GOLD · YEARLY</span>
        <h2 style="margin-top:15px">Annual</h2>
        <div class="plan-price">₹1,169 <small>/ year</small></div>
        <p class="muted">A yearly plan, billed annually when payments are integrated.</p>
        <ul class="benefit-list">
          <li>Gold membership card theme</li>
          <li>All planned Platinum benefits</li>
          <li>Premium visual themes</li>
          <li>Detailed annual money summaries</li>
          <li>One yearly plan</li>
        </ul>
        <button class="primary-btn full-btn" data-action="subscribe" data-tier="gold-yearly">Choose yearly</button>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h2>About membership</h2>
      <p class="muted">Selecting a plan currently shows a setup message; it does not charge money or unlock paid services. To sell subscriptions, connect verified purchases through Google Play Billing for Android and a supported payment provider for the website. Never mark a customer as paid based only on a button click.</p>
    </div>`;
}

function settingsPage() {
  return `${pageHeader("Settings", "Your profile, preferences and data controls.")}
    <div class="grid grid-2">
      <div class="card">
        <h2>Profile</h2>
        <p class="muted">Manage your personal app preferences.</p>
        <form id="profile-form" class="form-grid">
          <div class="field full">
            <label for="settings-name">Name</label>
            <input id="settings-name" name="name" required value="${esc(state.profile?.name || "")}">
          </div>
          <div class="field">
            <label for="settings-age">Age</label>
            <input id="settings-age" name="age" type="number" min="1" max="120" value="${esc(state.profile?.age || "")}">
          </div>
          <div class="field">
            <label for="settings-currency">Currency</label>
            <select id="settings-currency" name="currency">
              ${[["INR", "INR — Indian Rupee"], ["USD", "USD — US Dollar"], ["GBP", "GBP — British Pound"], ["EUR", "EUR — Euro"], ["AED", "AED — UAE Dirham"], ["CAD", "CAD — Canadian Dollar"]]
                .map(([v, l]) => `<option value="${v}" ${state.currency === v ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </div>
          <div class="field full"><button class="primary-btn full-btn" type="submit">Save profile</button></div>
        </form>
      </div>

      <div class="card">
        <h2>Appearance</h2>
        <div class="settings-row">
          <div><strong>Light theme</strong><p>Switch between light and midnight themes.</p></div>
          <input id="theme-toggle" class="switch" type="checkbox" ${state.theme === "light" ? "checked" : ""} aria-label="Enable light theme">
        </div>
        <div class="settings-row">
          <div><strong>Hide balances</strong><p>Hide displayed amounts on this device.</p></div>
          <input id="balance-toggle" class="switch" type="checkbox" ${state.balanceHidden ? "checked" : ""} aria-label="Hide balances">
        </div>
      </div>

      <div class="card">
        <h2>Backup & restore</h2>
        <p class="muted">Export a backup file and keep it somewhere safe. It may contain sensitive financial information.</p>
        <div class="grid grid-2">
          <button class="secondary-btn" data-action="export-backup">Export backup</button>
          <button class="secondary-btn" data-action="import-backup">Restore backup</button>
        </div>
        <input type="file" id="backup-file" accept=".json,application/json" hidden>
      </div>

      <div class="card">
        <h2>Membership</h2>
        <p class="muted">Review your plan and subscription information.</p>
        <div class="row-between">
          <strong>${esc(membershipInfo().label)}</strong>
          <button class="secondary-btn" data-page="pro">View Pro</button>
        </div>
        <p class="muted" style="font-size:12px;margin-top:15px">Manage real subscriptions through the store or payment provider used for purchase. This prototype cannot verify or cancel a real subscription.</p>
      </div>

      <div class="card">
        <h2>Privacy & data</h2>
        <p class="muted">Your current prototype saves information in this browser. Clearing browser storage can erase it. Export a backup before deleting data.</p>
        <button class="danger-btn" data-action="clear-data">Delete all local app data</button>
      </div>

      <div class="card">
        <h2>About FINOVA</h2>
        <p class="muted">A personal money management prototype. Not a bank, financial adviser, or payment processor.</p>
        <div class="row-between"><span>Version</span><strong>1.0.0</strong></div>
        <div class="row-between" style="margin-top:13px"><span>Storage</span><span class="pill">This browser</span></div>
      </div>
    </div>`;
}

function onboardingPage() {
  return `<div class="onboarding">
    <div class="onboarding-logo">
      <div class="brand-mark">F</div>
      <div class="brand">FINOVA</div>
    </div>

    <div class="onboarding-content">
      <div class="eyebrow">A calmer way to manage money</div>
      <h1 style="font-size:clamp(36px,7vw,58px);margin-top:17px">Your money.<br><span class="positive">Your future.</span></h1>
      <p class="muted" style="max-width:470px">One clear space for your spending, savings, accounts and goals. Start with your profile and make it yours.</p>
      <div class="onboarding-points">
        <span>✓ Simple overview</span>
        <span>✓ Eight focused tools</span>
        <span>✓ Private local storage</span>
      </div>
    </div>

    <div class="card onboarding-form-card">
      <h2>Let's set up your space</h2>
      <p class="muted">You can change these details later in Settings.</p>
      <form id="onboarding-form" class="form-grid">
        <div class="field full">
          <label for="onboard-name">What should we call you?</label>
          <input id="onboard-name" name="name" required maxlength="60" placeholder="Your name">
        </div>
        <div class="field">
          <label for="onboard-age">Age (optional)</label>
          <input id="onboard-age" name="age" type="number" min="1" max="120" placeholder="Your age">
        </div>
        <div class="field">
          <label for="onboard-currency">Preferred currency</label>
          <select id="onboard-currency" name="currency">
            <option value="INR">INR — Indian Rupee</option>
            <option value="USD">USD — US Dollar</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="EUR">EUR — Euro</option>
            <option value="AED">AED — UAE Dirham</option>
            <option value="CAD">CAD — Canadian Dollar</option>
          </select>
        </div>
        <div class="field full">
          <button class="primary-btn full-btn" type="submit">Continue to FINOVA →</button>
        </div>
      </form>
      <small>Your details are stored in this browser. Do not enter passwords or bank login credentials.</small>
    </div>
  </div>`;
}

function renderSidebar() {
  return `<div class="menu-backdrop" data-action="close-menu" ${menuOpen ? "" : "hidden"}></div>
    <aside class="sidebar ${menuOpen ? "open" : ""}" aria-label="Main navigation">
      <div class="sidebar-head">
        <div class="brand"><div class="brand-mark">F</div> FINOVA</div>
        <button class="icon-btn" data-action="close-menu" aria-label="Close menu">×</button>
      </div>
      <div class="sidebar-label">Workspace</div>
      <nav class="nav-list">
        <button class="nav-item ${currentPage === "dashboard" ? "active" : ""}" data-page="dashboard"><span class="nav-emoji">⌂</span>Dashboard</button>
        ${NAV.map(([id, icon, label]) => `<button class="nav-item ${currentPage === id ? "active" : ""}" data-page="${id}"><span class="nav-emoji">${icon}</span>${label}</button>`).join("")}
      </nav>
      <div class="sidebar-label">Membership</div>
      <nav class="nav-list">
        <button class="nav-item ${currentPage === "pro" ? "active" : ""}" data-page="pro">
          <span class="nav-emoji">✧</span>FINOVA Pro
          <span class="pill gold" style="margin-left:auto">PRO</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <button class="nav-item ${currentPage === "settings" ? "active" : ""}" data-page="settings"><span class="nav-emoji">⚙</span>Settings</button>
        <div style="padding:13px 10px;color:var(--muted);font-size:11px">Made for clearer money decisions.</div>
      </div>
    </aside>`;
}

function renderApp() {
  const app = document.getElementById("app");
  if (!app) return;

  document.body.classList.toggle("light", state.theme === "light");

  if (!state.onboardingDone || !state.profile) {
    app.innerHTML = onboardingPage();
    return;
  }

  const pageMap = {
    dashboard: dashboardPage,
    transactions: transactionsPage,
    accounts: accountsPage,
    budgets: budgetsPage,
    goals: goalsPage,
    loans: loansPage,
    recurring: recurringPage,
    scanner: scannerPage,
    analytics: analyticsPage,
    pro: proPage,
    settings: settingsPage
  };

  const page = (pageMap[currentPage] || dashboardPage)();

  app.innerHTML = `${renderSidebar()}
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-btn" data-action="toggle-menu" aria-label="Open navigation menu">☰</button>
          <div class="brand"><div class="brand-mark">F</div><span>FINOVA</span></div>
        </div>
        <div class="topbar-right">
          <div style="text-align:right">
            <div class="topbar-label">Welcome back</div>
            <div class="topbar-name">${esc(state.profile.name || "Member")}</div>
          </div>
          <button class="profile-chip" data-page="settings" aria-label="Open profile settings">${esc((state.profile.name || "F").trim().charAt(0).toUpperCase())}</button>
        </div>
      </header>
      <main class="layout"><section class="page">${page}</section></main>
    </div>`;

  if (scannerImage && currentPage === "scanner") {
    const preview = document.getElementById("receipt-preview");
    if (preview) {
      preview.innerHTML = `<img class="scanner-preview" src="${scannerImage}" alt="Selected receipt">`;
    }
  }
}

function goTo(page) {
  const valid = ["dashboard", ...NAV.map(x => x[0]), "pro", "settings"];
  if (!valid.includes(page)) return;

  currentPage = page;
  menuOpen = false;
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showModal(title, content) {
  modalType = "";
  document.querySelector(".modal-backdrop")?.remove();

  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" data-action="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-action="close-modal" aria-label="Close dialog">×</button>
      </div>
      ${content}
    </div>
  </div>`);
}

function openForm(type, id = "") {
  modalType = type;
  modalExtra = { id };

  const existing = list => list.find(x => x.id === id) || {};
  let title = "";
  let fields = "";

  if (type === "transaction") {
    const t = existing(state.transactions);
    title = id ? "Edit transaction" : "Add transaction";

    fields = `<form id="modal-form" data-form="transaction">
      <div class="form-grid">
        <div class="field full"><label>Transaction title</label><input name="title" required maxlength="100" value="${esc(t.title || "")}" placeholder="e.g. Groceries"></div>
        <div class="field"><label>Type</label><select name="type"><option value="expense" ${t.type !== "income" ? "selected" : ""}>Expense</option><option value="income" ${t.type === "income" ? "selected" : ""}>Income</option></select></div>
        <div class="field"><label>Amount</label><input name="amount" type="number" min=".01" step=".01" required value="${esc(t.amount ?? "")}" placeholder="0.00"></div>
        <div class="field"><label>Category</label><select name="category">${categoryOptions(t.category || "Food")}</select></div>
        <div class="field"><label>Account</label><select name="accountId" required>${accountOptions(t.accountId || state.accounts[0]?.id)}</select></div>
        <div class="field full"><label>Date</label><input name="date" type="date" required value="${esc(t.date || today())}"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
        <button class="primary-btn" type="submit">Save transaction</button>
      </div>
    </form>`;
  } else if (type === "account") {
    const a = existing(state.accounts);
    title = id ? "Edit account" : "Add account";

    fields = `<form id="modal-form" data-form="account"><div class="form-grid">
      <div class="field full"><label>Account name</label><input name="name" required maxlength="60" value="${esc(a.name || "")}" placeholder="e.g. Savings"></div>
      <div class="field"><label>Account type</label><select name="type">${["Cash", "Savings", "Bank Account", "Digital Wallet", "Other"].map(v => `<option ${a.type === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="field"><label>Card design</label><select name="color">${[["green", "Emerald"], ["silver", "Silver"], ["gold", "Gold"], ["purple", "Midnight Purple"]].map(([v, l]) => `<option value="${v}" ${(a.color || "green") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      ${id ? "" : `<div class="field full"><label>Opening balance</label><input name="balance" type="number" step=".01" value="0" required></div>`}
    </div>
    <div class="form-actions">
      <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Save account</button>
    </div></form>`;
  } else if (type === "budget") {
    title = "Create budget";

    fields = `<form id="modal-form" data-form="budget"><div class="form-grid">
      <div class="field"><label>Category</label><select name="category">${categoryOptions("Food")}</select></div>
      <div class="field"><label>Monthly limit</label><input name="limit" type="number" min=".01" step=".01" required placeholder="5000"></div>
    </div>
    <div class="form-actions">
      <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Create budget</button>
    </div></form>`;
  } else if (type === "goal") {
    const g = existing(state.goals);
    title = id ? "Edit savings goal" : "New savings goal";

    fields = `<form id="modal-form" data-form="goal"><div class="form-grid">
      <div class="field full"><label>Goal name</label><input name="name" required maxlength="80" value="${esc(g.name || "")}" placeholder="e.g. New laptop"></div>
      <div class="field"><label>Target amount</label><input name="target" type="number" min=".01" step=".01" required value="${esc(g.target ?? "")}" placeholder="20000"></div>
      <div class="field"><label>${id ? "Saved amount" : "Already saved"}</label><input name="saved" type="number" min="0" step=".01" value="${esc(g.saved || 0)}"></div>
      <div class="field full"><label>Target date (optional)</label><input name="date" type="date" value="${esc(g.date || "")}"></div>
    </div>
    <div class="form-actions">
      <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Save goal</button>
    </div></form>`;
  } else if (type === "contribution") {
    title = "Add to savings";

    fields = `<form id="modal-form" data-form="contribution">
      <div class="field"><label>Contribution amount</label><input name="amount" type="number" min=".01" step=".01" required placeholder="1000"></div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
        <button class="primary-btn">Add contribution</button>
      </div>
    </form>`;
  } else if (type === "loan") {
    title = "Add loan";

    fields = `<form id="modal-form" data-form="loan"><div class="form-grid">
      <div class="field full"><label>Loan name</label><input name="name" required maxlength="80" placeholder="e.g. Education loan"></div>
      <div class="field"><label>Original principal</label><input name="principal" type="number" min=".01" step=".01" required placeholder="100000"></div>
      <div class="field"><label>Annual interest (%)</label><input name="rate" type="number" min="0" step=".01" required value="0"></div>
      <div class="field"><label>Term (months)</label><input name="months" type="number" min="1" max="600" required value="12"></div>
      <div class="field"><label>Already repaid</label><input name="paid" type="number" min="0" step=".01" value="0"></div>
    </div>
    <div class="form-actions">
      <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Save loan</button>
    </div></form>`;
  } else if (type === "repayment") {
    title = "Record repayment";

    fields = `<form id="modal-form" data-form="repayment">
      <div class="field"><label>Amount repaid</label><input name="amount" type="number" min=".01" step=".01" required placeholder="5000"></div>
      <p class="muted" style="font-size:12px;margin-top:12px">This updates the app's tracked repayment total. It does not make a payment to a lender.</p>
      <div class="form-actions">
        <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
        <button class="primary-btn">Record repayment</button>
      </div>
    </form>`;
  } else if (type === "recurring") {
    title = "Add recurring schedule";

    fields = `<form id="modal-form" data-form="recurring"><div class="form-grid">
      <div class="field full"><label>Description</label><input name="title" required maxlength="100" placeholder="e.g. Internet bill"></div>
      <div class="field"><label>Type</label><select name="type"><option value="expense">Expense</option><option value="income">Income</option></select></div>
      <div class="field"><label>Amount</label><input name="amount" type="number" min=".01" step=".01" required></div>
      <div class="field"><label>Category</label><select name="category">${categoryOptions("Bills")}</select></div>
      <div class="field"><label>Account</label><select name="accountId">${accountOptions()}</select></div>
      <div class="field"><label>Frequency</label><select name="frequency"><option>Weekly</option><option selected>Monthly</option><option>Yearly</option></select></div>
      <div class="field"><label>Next due date</label><input name="nextDate" type="date" value="${today()}" required></div>
    </div>
    <div class="form-actions">
      <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
      <button class="primary-btn">Save schedule</button>
    </div></form>`;
  } else if (type === "transfer") {
    const a = existing(state.accounts);
    title = "Transfer between accounts";

    fields = `<form id="modal-form" data-form="transfer">
      <div class="field"><label>From</label><select name="from" required>${accountOptions(a.id)}</select></div>
      <div class="field" style="margin-top:14px"><label>To</label><select name="to" required>${accountOptions(state.accounts.find(x => x.id !== a.id)?.id || "")}</select></div>
      <div class="field" style="margin-top:14px"><label>Amount</label><input name="amount" type="number" min=".01" step=".01" required></div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" data-action="close-modal">Cancel</button>
        <button class="primary-btn">Transfer</button>
      </div>
    </form>`;
  }

  showModal(title, fields);
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
  modalType = "";
}

function updateAccountBalance(accountId, delta) {
  const a = state.accounts.find(x => x.id === accountId);
  if (a) a.balance = Math.round((num(a.balance) + num(delta) + Number.EPSILON) * 100) / 100;
}

function reverseTransaction(t) {
  if (!t) return;
  updateAccountBalance(t.accountId, t.type === "income" ? -num(t.amount) : num(t.amount));
}

function applyTransaction(t) {
  updateAccountBalance(t.accountId, t.type === "income" ? num(t.amount) : -num(t.amount));
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function submitModal(form, type) {
  const d = formObject(form);
  const id = modalExtra.id;

  if (type === "transaction") {
    const amount = num(d.amount);
    if (amount <= 0) return notify("Enter an amount greater than zero.");

    const existing = state.transactions.find(t => t.id === id);
    if (existing) reverseTransaction(existing);

    const t = {
      id: existing?.id || uid(),
      title: d.title.trim(),
      type: d.type,
      amount,
      category: d.category,
      accountId: d.accountId,
      date: d.date
    };

    if (!state.accounts.some(a => a.id === t.accountId)) {
      if (existing) applyTransaction(existing);
      return notify("Choose a valid account.");
    }

    if (existing) Object.assign(existing, t);
    else state.transactions.push(t);

    applyTransaction(t);
  }

  if (type === "account") {
    const existing = state.accounts.find(a => a.id === id);

    if (existing) {
      existing.name = d.name.trim();
      existing.type = d.type;
      existing.color = d.color;
    } else {
      state.accounts.push({
        id: uid(),
        name: d.name.trim(),
        type: d.type,
        color: d.color,
        balance: num(d.balance)
      });
    }
  }

  if (type === "budget") {
    const limit = num(d.limit);
    if (limit <= 0) return notify("Enter a budget limit greater than zero.");

    const duplicate = state.budgets.some(
      b => b.category === d.category && (b.period || monthKey()) === monthKey()
    );

    if (duplicate) return notify("A budget for this category already exists this month.");

    state.budgets.push({
      id: uid(),
      category: d.category,
      limit,
      period: monthKey()
    });
  }

  if (type === "goal") {
    const target = num(d.target);
    const saved = num(d.saved);

    if (target <= 0 || saved < 0) return notify("Enter valid goal amounts.");
    if (saved > target) return notify("Saved amount cannot exceed the target in this version.");

    const existing = state.goals.find(g => g.id === id);
    const g = {
      id: existing?.id || uid(),
      name: d.name.trim(),
      target,
      saved,
      date: d.date
    };

    if (existing) Object.assign(existing, g);
    else state.goals.push(g);
  }

  if (type === "contribution") {
    const g = state.goals.find(x => x.id === id);
    if (!g || num(d.amount) <= 0) return notify("Enter a valid contribution.");

    g.saved = Math.min(num(g.target), num(g.saved) + num(d.amount));
  }

  if (type === "loan") {
    if (num(d.principal) <= 0 || num(d.months) <= 0 || num(d.paid) < 0) {
      return notify("Enter valid loan details.");
    }

    if (num(d.paid) > num(d.principal)) {
      return notify("Repayments cannot exceed the principal.");
    }

    state.loans.push({
      id: uid(),
      name: d.name.trim(),
      principal: num(d.principal),
      rate: num(d.rate),
      months: Math.floor(num(d.months)),
      paid: num(d.paid)
    });
  }

  if (type === "repayment") {
    const loan = state.loans.find(l => l.id === id);
    if (!loan || num(d.amount) <= 0) return notify("Enter a valid repayment.");

    loan.paid = Math.min(num(loan.principal), num(loan.paid) + num(d.amount));
  }

  if (type === "recurring") {
    if (num(d.amount) <= 0) return notify("Enter an amount greater than zero.");

    state.recurring.push({
      id: uid(),
      title: d.title.trim(),
      type: d.type,
      amount: num(d.amount),
      category: d.category,
      accountId: d.accountId,
      frequency: d.frequency,
      nextDate: d.nextDate,
      status: "scheduled"
    });
  }

  if (type === "transfer") {
    const from = state.accounts.find(a => a.id === d.from);
    const to = state.accounts.find(a => a.id === d.to);
    const amount = num(d.amount);

    if (!from || !to || from.id === to.id || amount <= 0) {
      return notify("Choose two different accounts and a valid amount.");
    }

    if (num(from.balance) < amount) {
      return notify("The source account does not have enough recorded balance.");
    }

    from.balance = Math.round((num(from.balance) - amount) * 100) / 100;
    to.balance = Math.round((num(to.balance) + amount) * 100) / 100;
  }

  save();
  closeModal();
  renderApp();
  notify("Saved successfully.");
}

function deleteById(listName, id, message) {
  const list = state[listName];
  if (!Array.isArray(list)) return;
  if (!confirm(message || "Delete this item?")) return;

  if (listName === "transactions") {
    const t = list.find(x => x.id === id);
    reverseTransaction(t);
  }

  state[listName] = list.filter(x => x.id !== id);
  save();
  renderApp();
  notify("Item removed.");
}

function downloadBlob(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCSV() {
  const headers = ["Date", "Title", "Type", "Category", "Account", "Amount"];
  const rows = state.transactions.map(t => [
    t.date, t.title, t.type, t.category, accountName(t.accountId), t.amount
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");

  downloadBlob("finova-transactions.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
  notify("CSV export created.");
}

function exportBackup() {
  downloadBlob("finova-backup.json", JSON.stringify(state, null, 2), "application/json");
  notify("Backup created. Keep it private.");
}

function doImportBackup() {
  let input = document.getElementById("backup-file");

  if (!input) {
    input = document.createElement("input");
    input.type = "file";
    input.id = "backup-file";
    input.accept = ".json,application/json";
    input.hidden = true;
    document.body.appendChild(input);
  }

  input.click();
}

function handleImportFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const required = ["accounts", "transactions", "budgets", "goals", "loans", "recurring"];

      if (!parsed || typeof parsed !== "object" || !required.every(k => Array.isArray(parsed[k]))) {
        throw new Error("Invalid backup format");
      }

      if (!confirm("Restore this backup? It will replace the data currently stored in this browser.")) return;

      state = { ...freshState(), ...parsed };

      if (!state.accounts.length) state.accounts = freshState().accounts;
      if (!state.membership) state.membership = freshState().membership;
      if (!state.settings) state.settings = freshState().settings;

      save();
      currentPage = "dashboard";
      renderApp();
      notify("Backup restored.");
    } catch {
      notify("That file is not a valid FINOVA backup.");
    }
  };

  reader.readAsText(file);
}

/* FIXED: receive the click event explicitly and use data-tier for plans. */
function handleAction(actionEl, event) {
  const action = actionEl.dataset.action;
  const id = actionEl.dataset.id;

  if (!action) return;

  switch (action) {
    case "toggle-menu":
      menuOpen = true;
      renderApp();
      break;

    case "close-menu":
      menuOpen = false;
      renderApp();
      break;

    case "close-modal":
      closeModal();
      break;

    case "modal-backdrop":
      if (event && event.target === actionEl) closeModal();
      break;

    case "add-transaction":
      openForm("transaction");
      break;

    case "edit-transaction":
      openForm("transaction", id);
      break;

    case "delete-transaction":
      deleteById("transactions", id, "Delete this transaction? Its account balance will be adjusted.");
      break;

    case "add-account":
      openForm("account");
      break;

    case "edit-account":
      openForm("account", id);
      break;

    case "transfer":
      openForm("transfer", id);
      break;

    case "add-budget":
      openForm("budget");
      break;

    case "delete-budget":
      deleteById("budgets", id, "Remove this budget?");
      break;

    case "add-goal":
      openForm("goal");
      break;

    case "edit-goal":
      openForm("goal", id);
      break;

    case "contribute-goal":
      openForm("contribution", id);
      break;

    case "delete-goal":
      deleteById("goals", id, "Delete this savings goal?");
      break;

    case "add-loan":
      openForm("loan");
      break;

    case "repay-loan":
      openForm("repayment", id);
      break;

    case "delete-loan":
      deleteById("loans", id, "Delete this loan tracker?");
      break;

    case "add-recurring":
      openForm("recurring");
      break;

    case "delete-recurring":
      deleteById("recurring", id, "Delete this recurring schedule?");
      break;

    case "toggle-recurring": {
      const r = state.recurring.find(x => x.id === id);
      if (r) r.status = r.status === "paused" ? "scheduled" : "paused";
      save();
      renderApp();
      break;
    }

    case "record-recurring":
      recordRecurring(id);
      break;

    case "toggle-balance":
      state.balanceHidden = !state.balanceHidden;
      save();
      renderApp();
      break;

    /* FIXED: create the receipt input if it does not exist yet. */
    case "choose-receipt": {
      let input = document.getElementById("receipt-file");

      if (!input) {
        input = document.createElement("input");
        input.type = "file";
        input.id = "receipt-file";
        input.accept = "image/*";
        input.hidden = true;
        document.body.appendChild(input);
      }

      input.click();
      break;
    }

    case "export-csv":
      exportCSV();
      break;

    case "export-backup":
      exportBackup();
      break;

    case "import-backup":
      doImportBackup();
      break;

    case "clear-data":
      if (confirm("Delete all FINOVA data saved in this browser? Export a backup first if you may need it.")) {
        localStorage.removeItem(APP_KEY);
        state = freshState();
        currentPage = "dashboard";
        scannerImage = "";
        renderApp();
        notify("Local app data deleted.");
      }
      break;

    case "subscribe": {
      /* FIXED: the selected tier is stored in data-tier, not data-id. */
      const tier = actionEl.dataset.tier;
      const selectedPlan = tier === "gold-yearly"
        ? "FINOVA Gold — ₹1,169/year"
        : "FINOVA Platinum — ₹99/month";

      showModal(
        "Connect subscription billing",
        `<p class="muted">Selected plan: <strong>${selectedPlan}</strong>.</p>
        <p>This website preview does not collect payment details or activate paid access. Before launch, connect a payment provider, verify the transaction securely, and handle renewals, cancellations and expiry.</p>
        <div class="form-actions">
          <button class="primary-btn" data-action="close-modal">Understood</button>
        </div>`
      );
      break;
    }
  }
}

function recordRecurring(id) {
  const r = state.recurring.find(x => x.id === id);

  if (!r || r.status === "paused") {
    return notify("Resume this schedule before recording it.");
  }

  const t = {
    id: uid(),
    title: r.title,
    type: r.type,
    amount: num(r.amount),
    category: r.category,
    accountId: r.accountId,
    date: today()
  };

  if (!state.accounts.some(a => a.id === t.accountId)) {
    return notify("Choose a valid account for this schedule.");
  }

  state.transactions.push(t);
  applyTransaction(t);

  const date = new Date((r.nextDate || today()) + "T12:00:00");

  if (r.frequency === "Weekly") date.setDate(date.getDate() + 7);
  else if (r.frequency === "Yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);

  r.nextDate = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");

  save();
  renderApp();
  notify("Payment recorded and next due date updated.");
}

function handleSearchFilters() {
  const search = (document.getElementById("transaction-search")?.value || "").toLowerCase();
  const type = document.getElementById("transaction-type-filter")?.value || "all";
  const month = document.getElementById("transaction-month-filter")?.value || "";

  const filtered = [...state.transactions]
    .filter(t => (!search || `${t.title} ${t.category} ${accountName(t.accountId)}`.toLowerCase().includes(search)))
    .filter(t => type === "all" || t.type === type)
    .filter(t => !month || monthKey(t.date) === month)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const results = document.getElementById("transaction-results");
  if (results) results.innerHTML = transactionRows(filtered);
}

function handleFormSubmit(form) {
  const id = form.id;
  const d = formObject(form);

  if (id === "onboarding-form") {
    const name = String(d.name || "").trim();
    if (!name) return notify("Enter your name to continue.");

    state.profile = {
      name,
      age: d.age ? num(d.age) : "",
      createdAt: new Date().toISOString()
    };

    state.currency = d.currency || "INR";
    state.onboardingDone = true;

    save();
    currentPage = "dashboard";
    renderApp();
    notify("Welcome to FINOVA.");
    return;
  }

  if (id === "profile-form") {
    if (!String(d.name || "").trim()) return notify("Name cannot be empty.");

    state.profile = {
      ...(state.profile || {}),
      name: String(d.name).trim(),
      age: d.age ? num(d.age) : ""
    };

    state.currency = d.currency || "INR";
    save();
    renderApp();
    notify("Profile updated.");
    return;
  }

  if (id === "modal-form") {
    submitModal(form, form.dataset.form);
    return;
  }

  if (id === "receipt-form") {
    const amount = num(d.amount);
    if (amount <= 0) return notify("Enter a valid receipt total.");

    const t = {
      id: uid(),
      title: String(d.title).trim(),
      type: "expense",
      amount,
      category: d.category,
      accountId: d.accountId,
      date: d.date
    };

    if (!state.accounts.some(a => a.id === t.accountId)) {
      return notify("Choose a valid account.");
    }

    state.transactions.push(t);
    applyTransaction(t);
    save();
    scannerImage = "";
    renderApp();
    notify("Receipt expense saved.");
  }
}

/* Click delegation: pass the event to fix modal backdrop handling. */
document.addEventListener("click", e => {
  const pageButton = e.target.closest("[data-page]");

  if (pageButton) {
    goTo(pageButton.dataset.page);
    return;
  }

  const actionEl = e.target.closest("[data-action]");
  if (actionEl) handleAction(actionEl, e);
});

document.addEventListener("submit", e => {
  const form = e.target.closest("form");
  if (!form) return;

  e.preventDefault();
  handleFormSubmit(form);
});

document.addEventListener("input", e => {
  if (["transaction-search", "transaction-month-filter"].includes(e.target.id)) {
    handleSearchFilters();
  }

  if (e.target.id.startsWith("emi-")) updateEMI();
});

document.addEventListener("change", e => {
  if (e.target.id === "transaction-type-filter") {
    handleSearchFilters();
  }

  if (e.target.id === "theme-toggle") {
    state.theme = e.target.checked ? "light" : "dark";
    save();
    renderApp();
  }

  if (e.target.id === "balance-toggle") {
    state.balanceHidden = e.target.checked;
    save();
    renderApp();
  }

  if (e.target.id === "receipt-file" && e.target.files?.[0]) {
    const file = e.target.files[0];

    if (!file.type.startsWith("image/")) {
      return notify("Please choose an image file.");
    }

    if (file.size > 8 * 1024 * 1024) {
      return notify("Choose an image smaller than 8 MB.");
    }

    const reader = new FileReader();

    reader.onload = () => {
      scannerImage = reader.result;

      if (currentPage !== "scanner") goTo("scanner");
      else renderApp();

      notify("Receipt image loaded. Enter the details to save.");
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  }

  if (e.target.id === "backup-file" && e.target.files?.[0]) {
    handleImportFile(e.target.files[0]);
    e.target.value = "";
  }
});

function updateEMI() {
  const principal = document.getElementById("emi-principal");
  const rate = document.getElementById("emi-rate");
  const months = document.getElementById("emi-months");
  const result = document.getElementById("emi-result");

  if (!principal || !rate || !months || !result) return;

  result.textContent = num(principal.value) > 0 && num(months.value) > 0
    ? money(calculateEMI(principal.value, rate.value, months.value))
    : "—";
}

window.addEventListener("storage", e => {
  if (e.key === APP_KEY) {
    state = loadState();
    renderApp();
  }
});

renderApp();

