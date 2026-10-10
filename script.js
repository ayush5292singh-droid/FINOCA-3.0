
"use strict";

/* ==========================================================
   FINOVA — SMART MONEY OS
   Browser-based personal finance tracker
   ========================================================== */

const $ = (id) => document.getElementById(id);
const STORE = "finova_smart_money_os_v1";

const money = (n) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2
}).format(Number(n) || 0);

const number = (n) => Math.max(0, Number(n) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[c]));

const defaults = () => ({
  profile: null,
  policyAccepted: false,
  pro: false,
  transactions: [],
  wallets: [{ id: "main", name: "Main Wallet", type: "Cash", opening: 0, frozen: false, theme: "card-dark" }],
  budgets: [],
  goals: [],
  loans: [],
  recurring: [],
  receipts: [],
  settings: { currency: "INR", theme: "dark" }
});

let data = loadData();
let currentPage = "dashboard";
let toastTimer;
let genericConfig = null;
let receiptImageURL = null;

function loadData() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaults();
    const saved = JSON.parse(raw);
    const base = defaults();
    return {
      ...base, ...saved,
      profile: saved.profile || null,
      transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
      wallets: Array.isArray(saved.wallets) && saved.wallets.length ? saved.wallets : base.wallets,
      budgets: Array.isArray(saved.budgets) ? saved.budgets : [],
      goals: Array.isArray(saved.goals) ? saved.goals : [],
      loans: Array.isArray(saved.loans) ? saved.loans : [],
      recurring: Array.isArray(saved.recurring) ? saved.recurring : [],
      receipts: Array.isArray(saved.receipts) ? saved.receipts : []
    };
  } catch {
    return defaults();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORE, JSON.stringify(data));
    updateProfile();
  } catch {
    notify("Storage is full. Export your backup and remove some data.");
  }
}

function notify(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function updateProfile() {
  const name = data.profile?.name || "Your profile";
  $("sidebarName").textContent = name;
  $("sidebarAvatar").textContent = name.charAt(0).toUpperCase();
  $("topAvatar").textContent = name.charAt(0).toUpperCase();
  $("planLabel").textContent = data.pro ? "PRO PLAN" : "FREE PLAN";
}

function sum(items, fn) {
  return items.reduce((total, item) => total + (Number(fn(item)) || 0), 0);
}

function walletBalance(walletId) {
  const wallet = data.wallets.find(w => w.id === walletId);
  if (!wallet) return 0;
  return number(wallet.opening) + sum(
    data.transactions.filter(t => t.walletId === walletId),
    t => t.type === "income" ? t.amount : -t.amount
  );
}

function totals() {
  const income = sum(data.transactions.filter(t => t.type === "income"), t => t.amount);
  const expenses = sum(data.transactions.filter(t => t.type === "expense"), t => t.amount);
  const walletTotal = sum(data.wallets, w => walletBalance(w.id));
  const savedGoals = sum(data.goals, g => g.saved);
  const debt = sum(data.loans, l => Math.max(0, l.principal - l.paid));
  return { income, expenses, walletTotal, savedGoals, debt };
}

function monthTransactions() {
  const month = today().slice(0, 7);
  return data.transactions.filter(t => String(t.date).startsWith(month));
}

function monthTotals() {
  const tx = monthTransactions();
  return {
    income: sum(tx.filter(t => t.type === "income"), t => t.amount),
    expenses: sum(tx.filter(t => t.type === "expense"), t => t.amount)
  };
}

function walletOptions(selected) {
  if (!data.wallets.length) return '<option value="">No wallets available</option>';
  return data.wallets.map(w =>
    `<option value="${esc(w.id)}" ${w.id === selected ? "selected" : ""}>${esc(w.name)}</option>`
  ).join("");
}

function setPage(page) {
  const allowed = [
    "dashboard", "transactions", "wallets", "budgets", "goals",
    "loans", "recurring", "receipts", "analytics", "reports", "pro", "settings"
  ];
  if (!allowed.includes(page)) return;
  currentPage = page;

  document.querySelectorAll("[data-page]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  const titles = {
    dashboard: "Your financial universe.",
    transactions: "Every move, accounted for.",
    wallets: "Your money, in one place.",
    budgets: "Give every rupee a purpose.",
    goals: "Small steps. Bigger dreams.",
    loans: "Your repayment command centre.",
    recurring: "Stay ahead of regular payments.",
    receipts: "Turn receipts into records.",
    analytics: "Understand your money.",
    reports: "Your numbers, clearly presented.",
    pro: "Unlock your next level.",
    settings: "Make FINOVA yours."
  };

  $("currentSection").textContent = page.charAt(0).toUpperCase() + page.slice(1);
  $("pageHeading").textContent = titles[page];
  renderPage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPage() {
  const content = $("pageContent");
  const pages = {
    dashboard: renderDashboard,
    transactions: renderTransactions,
    wallets: renderWallets,
    budgets: renderBudgets,
    goals: renderGoals,
    loans: renderLoans,
    recurring: renderRecurring,
    receipts: renderReceipts,
    analytics: renderAnalytics,
    reports: renderReports,
    pro: renderPro,
    settings: renderSettings
  };
  content.innerHTML = pages[currentPage]();
}

function stat(label, value, icon, color, foot) {
  return `<article class="stat-card" style="--accent:${color};--glow:${color}20">
    <div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon">${icon}</span></div>
    <div class="stat-value">${value}</div>
    <div class="stat-foot">${foot}</div>
  </article>`;
}

function panel(title, subtitle, content, action = "") {
  return `<section class="panel">
    <div class="panel-head"><div><h3>${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${action}</div>
    ${content}
  </section>`;
}

function emptyState(icon, title, message, button, action) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div>
    <strong>${title}</strong><p>${message}</p>
    ${button ? `<button class="btn btn-secondary" data-action="${action}">${button}</button>` : ""}
  </div>`;
}

function recentTransactions(limit = 6) {
  const tx = [...data.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id.localeCompare(a.id)).slice(0, limit);
  if (!tx.length) return emptyState("⇄", "Your story starts here", "Add your first income or expense to see activity.", "Add transaction", "add-transaction");

  return `<div class="table-wrap"><table><thead><tr><th>DETAILS</th><th>DATE</th><th>AMOUNT</th></tr></thead><tbody>
    ${tx.map(t => `<tr>
      <td><div class="item-main"><span class="item-icon">${t.type === "income" ? "↙" : "↗"}</span>
        <div><strong>${esc(t.title)}</strong><small>${esc(t.category)}</small></div></div></td>
      <td>${esc(t.date)}</td>
      <td class="amount ${t.type === "income" ? "positive" : "negative"}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</td>
    </tr>`).join("")}
    </tbody></table></div>`;
}

function categorySpending(transactions) {
  const map = {};
  transactions.filter(t => t.type === "expense").forEach(t => {
    map[t.category] = (map[t.category] || 0) + number(t.amount);
  });
  return Object.entries(map).sort((a,b) => b[1] - a[1]);
}

const chartColors = ["#58f1e3","#9a7cff","#ef8dff","#63edb0","#ffbf69","#7fa5ff","#ff7895","#7ce0d0"];

function spendingDonut(transactions) {
  const cats = categorySpending(transactions);
  const total = sum(cats, c => c[1]);
  if (!total) return emptyState("◉", "No spending data yet", "Record expenses to generate your breakdown.");

  let cursor = 0;
  const stops = cats.map((c, i) => {
    const start = cursor;
    cursor += c[1] / total * 360;
    return `${chartColors[i % chartColors.length]} ${start}deg ${cursor}deg`;
  }).join(", ");

  return `<div class="donut-layout">
    <div class="donut" style="background:conic-gradient(${stops})">
      <div class="donut-center"><strong>${money(total)}</strong><small>Total spent</small></div>
    </div>
    <div class="legend">${cats.slice(0,6).map((c,i) => `<div class="legend-row">
      <span class="legend-dot" style="background:${chartColors[i % chartColors.length]}"></span>
      <span>${esc(c[0])}</span><strong>${Math.round(c[1]/total*100)}%</strong>
    </div>`).join("")}</div>
  </div>`;
}

function renderDashboard() {
  const all = totals();
  const m = monthTotals();
  const wallet = data.wallets[0];
  const balance = all.walletTotal;
  const monthlySaved = m.income - m.expenses;
  const budgets = data.budgets.slice(0, 3);
  const budgetHTML = budgets.length ? budgets.map(b => {
    const spent = sum(monthTransactions().filter(t => t.type === "expense" && t.category === b.category), t => t.amount);
    const pct = b.limit > 0 ? Math.min(100, spent / b.limit * 100) : 0;
    return `<div style="margin-bottom:18px">
      <div class="progress-line"><strong>${esc(b.category)}</strong><span>${money(spent)} / ${money(b.limit)}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;${pct>=100?"background:var(--red)":""}"></div></div>
    </div>`;
  }).join("") : emptyState("◉","No budgets yet","Create a budget to monitor category spending.","Create budget","add-budget");

  return `
    <div class="inline-actions" style="justify-content:space-between;margin-bottom:17px">
      <span class="pill cyan"><span class="live-dot"></span> YOUR MONEY OVERVIEW</span>
      <button class="btn btn-primary" data-action="add-transaction">＋ Add transaction</button>
    </div>
    <div class="grid grid-4">
      ${stat("Total wallet balance",money(balance),"▣","#58f1e3",`${data.wallets.length} wallet(s) tracked`)}
      ${stat("Income this month",money(m.income),"↙","#63edb0","Recorded this month")}
      ${stat("Expenses this month",money(m.expenses),"↗","#ff7895","Recorded this month")}
      ${stat("Net this month",money(monthlySaved),"⌁","#9a7cff",monthlySaved>=0?"Income minus expenses":"Expenses exceed income")}
    </div>

    <div class="grid grid-2 section-gap">
      <section class="bank-card">
        <div class="bank-card-top"><span class="eyebrow" style="color:#fff">FINOVA · VIRTUAL CARD</span><span class="card-contactless">)))</span></div>
        <div class="card-balance"><small>TRACKED WALLET BALANCE</small><strong>${money(balance)}</strong></div>
        <div class="bank-card-bottom"><div><span class="card-number">•••• &nbsp;•••• &nbsp;•••• &nbsp;${String(wallet?.id || "0000").replace(/\W/g,"").slice(-4).padStart(4,"0")}</span><span class="card-holder">${esc(data.profile?.name || "FINOVA USER").toUpperCase()}</span></div><span class="card-network">F</span></div>
        <div class="card-decor"></div>
      </section>
      ${panel("Your money snapshot","All-time totals",
        `<div class="progress-line"><span>Total income</span><strong class="positive">${money(all.income)}</strong></div>
         <div class="progress-line"><span>Total expenses</span><strong class="negative">${money(all.expenses)}</strong></div>
         <div class="progress-line"><span>Saved towards goals</span><strong>${money(all.savedGoals)}</strong></div>
         <div class="progress-line"><span>Remaining loan principal</span><strong>${money(all.debt)}</strong></div>
         <div class="notice" style="margin-top:15px">Your balance uses the opening balances you entered plus recorded transactions. It is not a live bank balance.</div>`)}
    </div>

    <div class="grid grid-2 section-gap">
      ${panel("Spending intelligence","This month's expense categories",spendingDonut(monthTransactions()),`<button class="mini-link" data-page="analytics">View insights ↗</button>`)}
      ${panel("Budget radar","Keep your spending on track",budgetHTML,`<button class="mini-link" data-action="add-budget">＋ Add</button>`)}
    </div>

    <div class="section-gap">
      ${panel("Recent activity","Your latest recorded money movements",recentTransactions(),`<button class="mini-link" data-page="transactions">All transactions ↗</button>`)}
    </div>
    <div class="grid grid-3 section-gap">
      <article class="feature-card"><div class="feature-icon">◎</div><h3>Savings goals</h3><p>${data.goals.length ? `${data.goals.length} goal(s) in progress.` : "Create a goal and track your progress."}</p><button class="mini-link" data-page="goals">Open goals →</button></article>
      <article class="feature-card"><div class="feature-icon">↗</div><h3>Loan control</h3><p>${data.loans.length ? `${data.loans.length} loan(s) being tracked.` : "Track repayments and estimated EMI."}</p><button class="mini-link" data-page="loans">Open loans →</button></article>
      <article class="feature-card"><div class="feature-icon">✦</div><h3>FINOVA Pro</h3><p>Explore premium tools and reporting features.</p><button class="mini-link" data-page="pro">Explore Pro →</button></article>
    </div>`;
}

function renderTransactions() {
  const rows = [...data.transactions].sort((a,b) => (b.date || "").localeCompare(a.date || "")).map(t => `
    <tr>
      <td><div class="item-main"><span class="item-icon">${t.type==="income"?"↙":"↗"}</span><div><strong>${esc(t.title)}</strong><small>${esc(t.category)} · ${esc(data.wallets.find(w=>w.id===t.walletId)?.name || "Wallet removed")}</small></div></div></td>
      <td>${esc(t.date)}</td>
      <td><span class="pill">${esc(t.type)}</span></td>
      <td class="amount ${t.type==="income"?"positive":"negative"}">${t.type==="income"?"+":"−"}${money(t.amount)}</td>
      <td><button class="small-btn" data-action="delete-tx" data-id="${esc(t.id)}">Delete</button></td>
    </tr>`).join("");

  return `<div class="inline-actions" style="justify-content:space-between;margin-bottom:18px">
    <span class="muted">${data.transactions.length} recorded transaction(s)</span>
    <button class="btn btn-primary" data-action="add-transaction">＋ Add transaction</button>
  </div>
  ${panel("Transaction ledger","Only entries you have saved appear here",
    rows ? `<div class="table-wrap"><table><thead><tr><th>TRANSACTION</th><th>DATE</th><th>TYPE</th><th>AMOUNT</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState("⇄","Nothing recorded yet","Add your first transaction to start tracking.","Add transaction","add-transaction"))}`;
}

function renderWallets() {
  const all = totals();
  const cards = data.wallets.map((w,i) => `
    <article class="wallet-card">
      <div class="wallet-card-head"><span class="wallet-icon">▣</span><span class="pill ${w.frozen?"":"cyan"}">${w.frozen?"Frozen demo":"Active"}</span></div>
      <h3>${esc(w.name)}</h3><p class="muted">${esc(w.type)} · ${data.transactions.filter(t=>t.walletId===w.id).length} transactions</p>
      <div class="wallet-balance">${money(walletBalance(w.id))}</div>
      <div class="bank-card ${esc(w.theme || "card-dark")}" style="min-height:155px;padding:16px;animation:none">
        <div class="bank-card-top"><span class="eyebrow" style="color:white">FINOVA · DEMO CARD</span><span class="card-chip"></span></div>
        <div class="card-balance" style="margin:18px 0"><small>TRACKED BALANCE</small><strong style="font-size:22px">${money(walletBalance(w.id))}</strong></div>
        <div class="bank-card-bottom"><span class="card-number">•••• •••• •••• ${String(i+1).padStart(4,"0")}</span><span class="card-network">F</span></div>
      </div>
      <div class="inline-actions" style="margin-top:13px">
        <button class="small-btn" data-action="toggle-wallet" data-id="${esc(w.id)}">${w.frozen?"Unfreeze demo":"Freeze demo"}</button>
        ${w.id!=="main"?`<button class="small-btn" data-action="delete-wallet" data-id="${esc(w.id)}">Delete</button>`:""}
      </div>
    </article>`).join("");

  return `<div class="inline-actions" style="justify-content:space-between;margin-bottom:18px">
    <span class="muted">Tracked total: <strong>${money(all.walletTotal)}</strong></span>
    <button class="btn btn-primary" data-action="add-wallet">＋ Add wallet</button>
  </div>
  <div class="wallet-grid">${cards}</div>
  <div class="notice section-gap">These are simulated wallet and card displays. They do not create bank accounts, issue payment cards, or connect to a bank. Freezing a card here changes only its demo status.</div>`;
}

function renderBudgets() {
  const list = data.budgets.map(b => {
    const spent = sum(monthTransactions().filter(t=>t.type==="expense" && t.category===b.category),t=>t.amount);
    const pct = b.limit ? spent/b.limit*100 : 0;
    const over = spent > b.limit;
    return `<article class="goal-card">
      <div class="wallet-card-head"><span class="wallet-icon">◉</span><span class="pill ${over?"":"cyan"}">${over?"Over budget":"Budget"}</span></div>
      <h3>${esc(b.category)}</h3><div class="wallet-balance">${money(spent)} <small>spent</small></div>
      <div class="progress-line"><span>Monthly limit</span><strong>${money(b.limit)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,pct)}%;${over?"background:var(--red)":""}"></div></div>
      <div class="progress-line"><span>${Math.round(pct)}% used</span><span>${money(Math.max(0,b.limit-spent))} left</span></div>
      <button class="small-btn" data-action="delete-budget" data-id="${esc(b.id)}">Delete budget</button>
    </article>`;
  }).join("");
  return `<div class="inline-actions" style="justify-content:space-between;margin-bottom:18px"><span class="muted">Budgets calculate spending from saved expenses this month.</span><button class="btn btn-primary" data-action="add-budget">＋ Create budget</button></div>
    ${list ? `<div class="goal-grid">${list}</div>` : emptyState("◉","Plan your spending","Set category limits and FINOVA will calculate how much you've used.","Create budget","add-budget")}`;
}

function renderGoals() {
  const cards = data.goals.map(g => {
    const pct = g.target ? g.saved/g.target*100 : 0;
    return `<article class="goal-card">
      <div class="wallet-card-head"><span class="goal-emoji">${esc(g.emoji || "◎")}</span><span class="pill purple">${Math.min(100,Math.round(pct))}% complete</span></div>
      <h3>${esc(g.name)}</h3><p class="muted">${g.deadline ? "Target date: "+esc(g.deadline) : "No target date set"}</p>
      <div class="wallet-balance">${money(g.saved)} <small>saved</small></div>
      <div class="progress-line"><span>Target</span><strong>${money(g.target)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,pct)}%"></div></div>
      <div class="inline-actions" style="margin-top:14px"><button class="small-btn" data-action="contribute-goal" data-id="${esc(g.id)}">＋ Add savings</button><button class="small-btn" data-action="delete-goal" data-id="${esc(g.id)}">Delete</button></div>
    </article>`;
  }).join("");
  return `<div class="inline-actions" style="justify-content:space-between;margin-bottom:18px"><span class="muted">Record progress toward your personal targets.</span><button class="btn btn-primary" data-action="add-goal">＋ New goal</button></div>
    ${cards ? `<div class="goal-grid">${cards}</div>` : emptyState("◎","Dream it. Track it.","Create a savings goal and watch your progress grow.","Create goal","add-goal")}`;
}

function renderLoans() {
  const cards = data.loans.map(l => {
    const principal = number(l.principal);
    const paid = Math.min(principal, number(l.paid));
    const pct = principal ? paid/principal*100 : 0;
    const remaining = Math.max(0,principal-paid);
    const monthlyRate = number(l.rate)/1200;
    const emi = monthlyRate === 0
      ? (number(l.term) ? principal/number(l.term) : 0)
      : (number(l.term) ? principal*monthlyRate*Math.pow(1+monthlyRate,number(l.term))/(Math.pow(1+monthlyRate,number(l.term))-1) : 0);
    return `<article class="loan-card">
      <div class="wallet-card-head"><span class="wallet-icon">↗</span><span class="pill ${remaining===0?"cyan":"purple"}">${remaining===0?"Completed":"In progress"}</span></div>
      <h3>${esc(l.name)}</h3><p class="muted">Interest rate: ${number(l.rate)}% p.a.</p>
      <div class="wallet-balance">${money(remaining)} <small>principal remaining</small></div>
      <div class="progress-line"><span>Principal paid</span><strong>${Math.round(pct)}%</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="progress-line"><span>Recorded payments: ${money(paid)}</span><span>EMI estimate: ${money(emi)}</span></div>
      <p class="muted tiny">Estimated EMI based on original principal, annual rate and term. Extra fees and lender rules are not included.</p>
      <div class="inline-actions"><button class="small-btn" data-action="pay-loan" data-id="${esc(l.id)}" ${remaining===0?"disabled":""}>Record EMI payment</button><button class="small-btn" data-action="delete-loan" data-id="${esc(l.id)}">Delete</button></div>
    </article>`;
  }).join("");
  return `<div class="inline-actions" style="justify-content:space-between;margin-bottom:18px"><span class="muted">Record repayments to update your progress.</span><button class="btn btn-primary" data-action="add-loan">＋ Add loan</button></div>
    ${cards ? `<div class="loan-grid">${cards}</div>` : emptyState("↗","Take control of repayments","Add a loan to estimate EMI and record principal repayments.","Add loan","add-loan")}`;
}

function renderRecurring() {
  const list = data.recurring.map(r => `<tr>
    <td><div class="item-main"><span class="item-icon">⟳</span><div><strong>${esc(r.name)}</strong><small>${esc(r.category)}</small></div></div></td>
    <td>${money(r.amount)}</td><td>${esc(r.frequency)}</td><td>${esc(r.nextDate || "Not set")}</td>
    <td><button class="small-btn" data-action="record-recurring" data-id="${esc(r.id)}">Record expense</button> <button class="small-btn" data-action="delete-recurring" data-id="${esc(r.id)}">Delete</button></td>
  </tr>`).join("");
  return `<div class="inline-actions" style="justify-content:space-between;margin-bottom:18px"><span class="muted">Manage recurring items manually. Browser notifications are not enabled.</span><button class="btn btn-primary" data-action="add-recurring">＋ Add recurring</button></div>
    ${list ? panel("Recurring payments","Use Record expense when a payment occurs.",`<div class="table-wrap"><table><thead><tr><th>ITEM</th><th>AMOUNT</th><th>FREQUENCY</th><th>NEXT DATE</th><th>ACTIONS</th></tr></thead><tbody>${list}</tbody></table></div>`) : emptyState("⟳","No recurring items","Track subscriptions, bills and regular expenses.","Add recurring","add-recurring")}`;
}

function renderReceipts() {
  const list = data.receipts.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${money(r.amount)}</td><td>${esc(r.date)}</td></tr>`).join("");
  return `<div class="grid grid-2">
    <section class="panel">
      <div class="panel-head"><div><h3>Receipt workspace</h3><p>Choose a receipt photo and review its details.</p></div><span class="feature-icon">▤</span></div>
      <label class="file-drop" for="receiptFile"><span class="feature-icon">↑</span><strong>Select a receipt image</strong><p>JPG, PNG or another image supported by your browser</p><span class="btn btn-secondary">Choose image</span></label>
      <input class="hidden" id="receiptFile" type="file" accept="image/*">
      <img id="receiptPreview" class="receipt-preview hidden" alt="Selected receipt preview">
      <div class="notice">Selecting a photo does not automatically extract text in this version. Enter the amount and category below to save an accurate record.</div>
      <form id="receiptForm">
        <div class="form-group"><label>Merchant or receipt name</label><input id="receiptName" required maxlength="100" placeholder="e.g. Grocery store"></div>
        <div class="form-row">
          <div class="form-group"><label>Amount (₹)</label><input id="receiptAmount" type="number" min=".01" step=".01" required placeholder="0.00"></div>
          <div class="form-group"><label>Category</label><select id="receiptCategory"><option>Food</option><option>Transport</option><option>Shopping</option><option>Bills</option><option>Health</option><option>Education</option><option>Other</option></select></div>
        </div>
        <div class="form-group"><label>Date</label><input id="receiptDate" type="date" value="${today()}" required></div>
        <button class="btn btn-primary full" type="submit">Save receipt and expense</button>
      </form>
    </section>
    <section>${panel("Receipt history","Saved receipts",list ? `<div class="table-wrap"><table><thead><tr><th>NAME</th><th>CATEGORY</th><th>AMOUNT</th><th>DATE</th></tr></thead><tbody>${list}</tbody></table></div>` : emptyState("▤","No receipts saved","Your saved receipts will appear here."))}</section>
  </div>`;
}

function renderAnalytics() {
  const all = totals();
  const m = monthTotals();
  const cats = categorySpending(monthTransactions());
  const top = cats.length ? cats.map((c,i) => {
    const pct = m.expenses ? c[1]/m.expenses*100 : 0;
    return `<div class="category-row"><span>${esc(c[0])}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${chartColors[i%chartColors.length]}"></div></div><strong>${money(c[1])}</strong></div>`;
  }).join("") : emptyState("⌁","Waiting for activity","Add expenses to see category analysis.");
  const recentMonths = [];
  for(let i=5;i>=0;i--){
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth()-i);
    const key = d.toISOString().slice(0,7);
    const tx = data.transactions.filter(t => String(t.date).startsWith(key));
    recentMonths.push({
      label:d.toLocaleString("en-IN",{month:"short"}),
      income:sum(tx.filter(t=>t.type==="income"),t=>t.amount),
      expense:sum(tx.filter(t=>t.type==="expense"),t=>t.amount)
    });
  }
  const max = Math.max(1,...recentMonths.flatMap(x=>[x.income,x.expense]));
  const bars = recentMonths.map(mo=>`<div style="flex:1;min-width:0;text-align:center">
    <div style="height:145px;display:flex;align-items:flex-end;justify-content:center;gap:4px;padding:0 2px">
      <div title="Income ${money(mo.income)}" style="height:${mo.income/max*100}%;width:35%;min-height:${mo.income?3:0}px;border-radius:5px 5px 0 0;background:var(--cyan)"></div>
      <div title="Expenses ${money(mo.expense)}" style="height:${mo.expense/max*100}%;width:35%;min-height:${mo.expense?3:0}px;border-radius:5px 5px 0 0;background:var(--purple)"></div>
    </div><small>${mo.label}</small></div>`).join("");

  return `<div class="grid grid-3">
    ${stat("All-time income",money(all.income),"↙","#63edb0","Recorded income")}
    ${stat("All-time expenses",money(all.expenses),"↗","#ff7895","Recorded expenses")}
    ${stat("This month's net",money(m.income-m.expenses),"⌁","#9a7cff","Income minus expenses")}
  </div>
  <div class="grid grid-2 section-gap">
    ${panel("Income vs expenses","Six-month view · recorded data only",`
      <div class="inline-actions" style="margin-bottom:15px"><span class="pill cyan">● Income</span><span class="pill purple">● Expenses</span></div>
      <div style="display:flex;align-items:flex-end;gap:10px;padding-top:10px">${bars}</div>`)}
    ${panel("Where money goes","Current month's expense categories",top)}
  </div>
  <div class="notice section-gap">Analytics are based only on the records saved in this browser. FINOVA does not retrieve transactions from your bank.</div>`;
}

function renderReports() {
  return `<div class="grid grid-2">
    <section class="panel"><div class="feature-icon">▧</div><h3 style="margin-top:15px">Transaction report</h3><p class="muted">Download your recorded transactions in spreadsheet-friendly CSV format.</p><button class="btn btn-primary full" data-action="export-csv">Export CSV</button></section>
    <section class="panel"><div class="feature-icon">⬇</div><h3 style="margin-top:15px">Full data backup</h3><p class="muted">Export a JSON copy of your profile, transactions, wallets, goals, loans and settings.</p><button class="btn btn-primary full" data-action="export-json">Download backup</button></section>
    <section class="panel"><div class="feature-icon">▣</div><h3 style="margin-top:15px">Import backup</h3><p class="muted">Restore a FINOVA JSON backup from a file. This replaces current saved data.</p><input id="backupFile" type="file" accept=".json,application/json"><button class="btn btn-secondary full" style="margin-top:12px" data-action="import-json">Restore selected backup</button></section>
    <section class="panel"><div class="feature-icon">◉</div><h3 style="margin-top:15px">Quick summary</h3><div class="progress-line"><span>Transactions</span><strong>${data.transactions.length}</strong></div><div class="progress-line"><span>Wallets</span><strong>${data.wallets.length}</strong></div><div class="progress-line"><span>Goals</span><strong>${data.goals.length}</strong></div><div class="progress-line"><span>Loans</span><strong>${data.loans.length}</strong></div></section>
  </div>
  <div class="notice section-gap">CSV and JSON exports are generated on your device. Keep backup files private because they can contain your personal financial records.</div>`;
}

function renderPro() {
  const features = [
    "Expanded financial insights and comparisons",
    "Downloadable reports and data exports",
    "Advanced budget and goal analysis",
    "Loan and EMI tracking tools",
    "Receipt history and finance organisation",
    "Future premium features as they are implemented"
  ];
  return `<section class="hero-panel">
    <span class="eyebrow">FINOVA PRO · PREMIUM EXPERIENCE</span>
    <h2>Make every rupee<br><span class="gradient-text">work smarter.</span></h2>
    <p>Explore the premium plan for people who want a more detailed view of their finances.</p>
    <span class="pill purple">✦ PREMIUM MEMBERSHIP</span>
  </section>
  <div class="price-grid section-gap">
    <article class="price-card">
      <span class="eyebrow">MONTHLY PLAN</span><div class="price">₹99<small> / month</small></div>
      <p class="muted">Flexible monthly pricing.</p>
      <ul class="check-list">${features.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
      <button class="btn btn-secondary full" data-action="pro-checkout">Choose monthly · ₹99</button>
    </article>
    <article class="price-card featured">
      <span class="pill purple">ANNUAL PLAN</span><div class="price">₹1,169<small> / year</small></div>
      <p class="muted">An annual subscription option.</p>
      <ul class="check-list">${features.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>
      <button class="btn btn-pro full" data-action="pro-checkout">Choose annual · ₹1,169</button>
    </article>
  </div>
  <div class="notice section-gap"><strong>Payment setup required:</strong> These are displayed prices, not a completed purchase. Real subscriptions require a secure payment provider or Google Play Billing, purchase verification, and subscription management. This demo does not collect card details or unlock Pro through a fake payment.</div>
  <div class="section-gap">${panel("Your current membership","Membership status",`<div class="progress-line"><span>Current plan</span><strong>${data.pro?"FINOVA PRO":"FREE"}</strong></div><p class="muted tiny">Pro is not activated by this demo checkout. Do not advertise a paid subscription as live until billing is integrated and tested.</p>`)}</div>`;
}

function renderSettings() {
  return `<div class="grid grid-2">
    <section class="panel"><div class="panel-head"><div><h3>Your profile</h3><p>Basic information saved on this device.</p></div><span class="feature-icon">♙</span></div>
      <div class="settings-row"><div><strong>Name</strong><p>${esc(data.profile?.name || "Not set")}</p></div><button class="small-btn" data-action="edit-profile">Edit</button></div>
      <div class="settings-row"><div><strong>Age</strong><p>${esc(data.profile?.age ?? "Not set")}</p></div><button class="small-btn" data-action="edit-profile">Edit</button></div>
    </section>
    <section class="panel"><div class="panel-head"><div><h3>Storage and privacy</h3><p>Understand where your information lives.</p></div><span class="feature-icon">⌑</span></div>
      <div class="settings-row"><div><strong>Storage mode</strong><p>Local browser storage on this device</p></div><span class="pill cyan">LOCAL</span></div>
      <div class="settings-row"><div><strong>Cloud synchronisation</strong><p>Not configured in this version</p></div><span class="pill">OFF</span></div>
      <div class="settings-row"><div><strong>Export your data</strong><p>Save a backup before clearing browser data.</p></div><button class="small-btn" data-page="reports">Open reports</button></div>
    </section>
    <section class="panel"><h3>App information</h3><p class="muted">FINOVA is a personal finance tracking demo. It does not offer bank services, investment execution or financial advice.</p><div class="pill">VERSION 1.0 · BROWSER EDITION</div></section>
    <section class="panel"><h3>Danger zone</h3><p class="muted">This removes locally stored transactions and settings. Export a backup first if you want to keep them.</p><button class="btn btn-danger" data-action="reset-data">Reset all local data</button></section>
  </div>`;
}

/* ---------- Onboarding ---------- */

function showOnboarding() {
  $("onboarding").classList.remove("hidden");
  $("app").classList.add("hidden");
  $("welcomeStep").classList.remove("hidden");
  $("policyStep").classList.add("hidden");
  $("profileName").value = data.profile?.name || "";
  $("profileAge").value = data.profile?.age || "";
}

function showApp() {
  $("onboarding").classList.add("hidden");
  $("app").classList.remove("hidden");
  updateProfile();
  setPage("dashboard");
}

$("welcomeContinue").addEventListener("click", () => {
  const name = $("profileName").value.trim();
  const age = Number($("profileAge").value);
  if (!name) return notify("Enter your name to continue.");
  if (!Number.isInteger(age) || age < 1 || age > 120) return notify("Enter a valid age.");
  data.profile = { name, age };
  saveData();
  $("welcomeStep").classList.add("hidden");
  $("policyStep").classList.remove("hidden");
});

$("backWelcome").addEventListener("click", () => {
  $("policyStep").classList.add("hidden");
  $("welcomeStep").classList.remove("hidden");
});

$("enterApp").addEventListener("click", () => {
  if (!$("policyConsent").checked) return notify("Please confirm that you have read the information.");
  data.policyAccepted = true;
  saveData();
  showApp();
});

$("logoutBtn").addEventListener("click", () => {
  if (confirm("Return to the welcome screen? Your saved data will remain on this device.")) showOnboarding();
});

/* ---------- Transactions ---------- */

function openTransaction() {
  $("txDate").value = today();
  $("txAmount").value = "";
  $("txTitle").value = "";
  $("txType").value = "expense";
  $("txCategory").value = "Food";
  $("txWallet").innerHTML = walletOptions(data.wallets[0]?.id);
  $("transactionDialog").showModal();
}

$("transactionForm").addEventListener("submit", e => {
  e.preventDefault();
  const amount = Number($("txAmount").value);
  const title = $("txTitle").value.trim();
  const walletId = $("txWallet").value;
  if (!title || !Number.isFinite(amount) || amount <= 0 || !walletId) return notify("Check the transaction details.");
  const wallet = data.wallets.find(w=>w.id===walletId);
  if (!wallet) return notify("Select a valid wallet.");
  if (wallet.frozen) return notify("This demo wallet is frozen. Unfreeze it before adding a transaction.");

  data.transactions.push({
    id: uid(), type: $("txType").value, amount, title,
    category: $("txCategory").value, date: $("txDate").value || today(),
    walletId
  });
  saveData();
  $("transactionDialog").close();
  renderPage();
  notify("Transaction saved.");
});

/* ---------- Generic add/edit dialogs ---------- */

function field(label, name, type="text", options={}) {
  const required = options.required === false ? "" : "required";
  if (type === "select") {
    return `<div class="form-group"><label>${esc(label)}</label><select name="${esc(name)}" ${required}>${options.values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}</select></div>`;
  }
  return `<div class="form-group"><label>${esc(label)}</label><input name="${esc(name)}" type="${esc(type)}" ${required}
    ${options.min !== undefined ? `min="${options.min}"` : ""}
    ${options.step ? `step="${options.step}"` : ""}
    ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}
    placeholder="${esc(options.placeholder || "")}"></div>`;
}

function openGeneric(config) {
  genericConfig = config;
  $("genericEyebrow").textContent = config.eyebrow || "FINOVA";
  $("genericTitle").textContent = config.title;
  $("genericFields").innerHTML = config.fields.map(f => field(f.label,f.name,f.type,f.options || {})).join("");
  $("genericDialog").showModal();
}

$("genericForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!genericConfig) return;
  const fd = new FormData(e.currentTarget);
  const values = Object.fromEntries(fd.entries());
  genericConfig.save(values);
  $("genericDialog").close();
  genericConfig = null;
  saveData();
  renderPage();
});

function addWallet() {
  openGeneric({
    title:"Add wallet", eyebrow:"WALLETS",
    fields:[
      {label:"Wallet name",name:"name",options:{maxlength:45,placeholder:"e.g. Savings wallet"}},
      {label:"Wallet type",name:"type",type:"select",options:{values:["Cash","Savings","Current","Other"]}},
      {label:"Opening balance (₹)",name:"opening",type:"number",options:{min:0,step:"0.01"}},
      {label:"Card colour",name:"theme",type:"select",options:{values:["card-dark","card-cyan","card-pink"]}}
    ],
    save:v=>{
      data.wallets.push({id:uid(),name:v.name.trim(),type:v.type,opening:number(v.opening),frozen:false,theme:v.theme});
      notify("Wallet added.");
    }
  });
}

function addBudget() {
  openGeneric({
    title:"Create budget",eyebrow:"BUDGET PLANNER",
    fields:[
      {label:"Category",name:"category",type:"select",options:{values:["Food","Transport","Shopping","Bills","Entertainment","Health","Education","Rent","Travel","Other"]}},
      {label:"Monthly limit (₹)",name:"limit",type:"number",options:{min:0.01,step:"0.01"}}
    ],
    save:v=>{
      if(data.budgets.some(b=>b.category===v.category)) { notify("A budget for this category already exists."); return; }
      data.budgets.push({id:uid(),category:v.category,limit:number(v.limit)});
      notify("Budget created.");
    }
  });
}

function addGoal() {
  openGeneric({
    title:"Create savings goal",eyebrow:"SAVINGS",
    fields:[
      {label:"Goal name",name:"name",options:{maxlength:60,placeholder:"e.g. New laptop"}},
      {label:"Target amount (₹)",name:"target",type:"number",options:{min:0.01,step:"0.01"}},
      {label:"Already saved (₹)",name:"saved",type:"number",options:{min:0,step:"0.01"}},
      {label:"Emoji",name:"emoji",options:{maxlength:4,placeholder:"◎"}},
      {label:"Target date (optional)",name:"deadline",type:"date",options:{required:false}}
    ],
    save:v=>{
      data.goals.push({id:uid(),name:v.name.trim(),target:number(v.target),saved:number(v.saved),emoji:v.emoji||"◎",deadline:v.deadline});
      notify("Savings goal created.");
    }
  });
}

function addLoan() {
  openGeneric({
    title:"Add loan",eyebrow:"LOAN TRACKER",
    fields:[
      {label:"Loan name",name:"name",options:{maxlength:60,placeholder:"e.g. Education loan"}},
      {label:"Original principal (₹)",name:"principal",type:"number",options:{min:0.01,step:"0.01"}},
      {label:"Annual interest rate (%)",name:"rate",type:"number",options:{min:0,step:"0.01"}},
      {label:"Term in months",name:"term",type:"number",options:{min:1,step:"1"}}
    ],
    save:v=>{
      data.loans.push({id:uid(),name:v.name.trim(),principal:number(v.principal),paid:0,rate:number(v.rate),term:Math.max(1,Math.floor(number(v.term)))});
      notify("Loan added.");
    }
  });
}

function addRecurring() {
  openGeneric({
    title:"Add recurring payment",eyebrow:"RECURRING",
    fields:[
      {label:"Payment name",name:"name",options:{maxlength:60,placeholder:"e.g. Internet bill"}},
      {label:"Amount (₹)",name:"amount",type:"number",options:{min:0.01,step:"0.01"}},
      {label:"Category",name:"category",type:"select",options:{values:["Food","Transport","Shopping","Bills","Entertainment","Health","Education","Rent","Other"]}},
      {label:"Frequency",name:"frequency",type:"select",options:{values:["Weekly","Monthly","Quarterly","Yearly"]}},
      {label:"Next payment date",name:"nextDate",type:"date"}
    ],
    save:v=>{
      data.recurring.push({id:uid(),name:v.name.trim(),amount:number(v.amount),category:v.category,frequency:v.frequency,nextDate:v.nextDate});
      notify("Recurring item saved.");
    }
  });
}

/* ---------- Actions ---------- */

document.addEventListener("click", e => {
  const pageBtn = e.target.closest("[data-page]");
  if (pageBtn) {
    e.preventDefault();
    setPage(pageBtn.dataset.page);
    return;
  }

  const closeBtn = e.target.closest("[data-close]");
  if (closeBtn) {
    $(closeBtn.dataset.close)?.close();
    return;
  }

  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  switch(action) {
    case "add-transaction": openTransaction(); break;
    case "add-wallet": addWallet(); break;
    case "add-budget": addBudget(); break;
    case "add-goal": addGoal(); break;
    case "add-loan": addLoan(); break;
    case "add-recurring": addRecurring(); break;

    case "delete-tx":
      if(confirm("Delete this transaction? The wallet balance will be recalculated.")) {
        data.transactions = data.transactions.filter(t=>t.id!==id);
        saveData(); renderPage(); notify("Transaction deleted.");
      }
      break;

    case "toggle-wallet": {
      const w=data.wallets.find(w=>w.id===id);
      if(w) { w.frozen=!w.frozen; saveData(); renderPage(); notify(w.frozen?"Demo wallet frozen.":"Demo wallet unfrozen."); }
      break;
    }

    case "delete-wallet":
      if(data.transactions.some(t=>t.walletId===id)) return notify("Delete this wallet's transactions first.");
      if(confirm("Delete this wallet?")) {
        data.wallets=data.wallets.filter(w=>w.id!==id);
        saveData(); renderPage(); notify("Wallet deleted.");
      }
      break;

    case "delete-budget":
      if(confirm("Delete this budget?")) { data.budgets=data.budgets.filter(b=>b.id!==id); saveData(); renderPage(); }
      break;

    case "delete-goal":
      if(confirm("Delete this savings goal?")) { data.goals=data.goals.filter(g=>g.id!==id); saveData(); renderPage(); }
      break;

    case "contribute-goal": {
      const g=data.goals.find(g=>g.id===id);
      if(!g) break;
      const amount=Number(prompt("How much would you like to add to this goal? (₹)"));
      if(!Number.isFinite(amount)||amount<=0) break;
      g.saved+=amount;
      saveData(); renderPage(); notify("Goal progress updated.");
      break;
    }

    case "delete-loan":
      if(confirm("Delete this loan and its recorded repayment progress?")) { data.loans=data.loans.filter(l=>l.id!==id); saveData(); renderPage(); }
      break;

    case "pay-loan": {
      const loan=data.loans.find(l=>l.id===id);
      if(!loan) break;
      const remaining=Math.max(0,loan.principal-loan.paid);
      const amount=Number(prompt(`Record a principal repayment. Remaining principal: ${money(remaining)}. Amount paid (₹):`));
      if(!Number.isFinite(amount)||amount<=0) break;
      if(amount>remaining) return notify("Payment cannot exceed remaining principal in this tracker.");
      loan.paid+=amount;
      saveData(); renderPage(); notify("Repayment recorded.");
      break;
    }

    case "delete-recurring":
      if(confirm("Delete this recurring item?")) { data.recurring=data.recurring.filter(r=>r.id!==id); saveData(); renderPage(); }
      break;

    case "record-recurring": {
      const r=data.recurring.find(r=>r.id===id);
      if(!r) break;
      if(!data.wallets.length) return notify("Add a wallet first.");
      if(!confirm(`Record ${money(r.amount)} for ${r.name} as an expense?`)) break;
      const wallet=data.wallets.find(w=>w.id==="main") || data.wallets[0];
      if(wallet.frozen) return notify("Your selected wallet is frozen.");
      data.transactions.push({id:uid(),type:"expense",amount:r.amount,title:r.name,category:r.category,date:today(),walletId:wallet.id});
      saveData(); renderPage(); notify("Recurring expense recorded.");
      break;
    }

    case "pro-checkout":
      notify("Real payments are not configured. No money has been charged.");
      break;

    case "export-csv": exportCSV(); break;
    case "export-json": exportJSON(); break;
    case "import-json": importJSON(); break;

    case "edit-profile": {
      openGeneric({
        title:"Edit profile",eyebrow:"YOUR PROFILE",
        fields:[
          {label:"Name",name:"name",options:{maxlength:50}},
          {label:"Age",name:"age",type:"number",options:{min:1,step:"1"}}
        ],
        save:v=>{
          const age=Number(v.age);
          if(!v.name.trim()||!Number.isInteger(age)||age<1||age>120) return notify("Enter a valid name and age.");
          data.profile={name:v.name.trim(),age};
          notify("Profile updated.");
        }
      });
      break;
    }

    case "reset-data":
      if(confirm("This permanently clears FINOVA's local data in this browser. Export a backup first. Continue?")) {
        localStorage.removeItem(STORE);
        data=defaults();
        showOnboarding();
        notify("Local data reset.");
      }
      break;
  }
});

/* ---------- Receipt image and receipt records ---------- */

document.addEventListener("change", e => {
  if(e.target.id==="receiptFile") {
    const file=e.target.files?.[0];
    if(!file) return;
    if(!file.type.startsWith("image/")) return notify("Please choose an image file.");
    if(file.size>8*1024*1024) return notify("Choose an image smaller than 8 MB.");
    if(receiptImageURL) URL.revokeObjectURL(receiptImageURL);
    receiptImageURL=URL.createObjectURL(file);
    const preview=$("receiptPreview");
    preview.src=receiptImageURL;
    preview.classList.remove("hidden");
    notify("Receipt selected. Review and enter the details.");
  }

  if(e.target.id==="backupFile") {
    const file=e.target.files?.[0];
    if(file) notify("Backup selected. Tap Restore selected backup to continue.");
  }
});

document.addEventListener("submit", e => {
  if(e.target.id!=="receiptForm") return;
  e.preventDefault();

  const name=$("receiptName").value.trim();
  const amount=Number($("receiptAmount").value);
  const category=$("receiptCategory").value;
  const date=$("receiptDate").value || today();

  if(!name||!Number.isFinite(amount)||amount<=0) return notify("Enter a valid receipt name and amount.");
  if(!data.wallets.length) return notify("Add a wallet first.");

  const wallet=data.wallets.find(w=>w.id==="main")||data.wallets[0];
  if(wallet.frozen) return notify("Unfreeze your demo wallet before saving an expense.");

  const receipt={id:uid(),name,amount,category,date};
  data.receipts.push(receipt);
  data.transactions.push({id:uid(),type:"expense",amount,title:name,category,date,walletId:wallet.id});
  saveData();
  renderPage();
  notify("Receipt saved and expense recorded.");
});

/* ---------- Export and restore ---------- */

function downloadFile(filename, content, type) {
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function exportJSON() {
  downloadFile(`finova-backup-${today()}.json`,JSON.stringify(data,null,2),"application/json");
  notify("Backup export started.");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g,'""')}"`;
}

function exportCSV() {
  const header=["Date","Type","Description","Category","Amount INR","Wallet"];
  const rows=data.transactions.map(t=>[
    t.date,t.type,t.title,t.category,t.amount,
    data.wallets.find(w=>w.id===t.walletId)?.name || "Wallet removed"
  ]);
  const csv=[header,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n");
  downloadFile(`finova-transactions-${today()}.csv`,"\uFEFF"+csv,"text/csv;charset=utf-8");
  notify("CSV export started.");
}

function importJSON() {
  const file=$("backupFile").files?.[0];
  if(!file) return notify("Choose a backup JSON file first.");
  if(!confirm("Restore this backup? It will replace the data currently saved in this browser.")) return;

  const reader=new FileReader();
  reader.onload=()=>{
    try {
      const parsed=JSON.parse(reader.result);
      const arrays=["transactions","wallets","budgets","goals","loans","recurring","receipts"];
      if(!parsed||typeof parsed!=="object"||!arrays.every(k=>Array.isArray(parsed[k]))) throw new Error("Invalid backup");
      if(!parsed.profile||typeof parsed.profile.name!=="string") throw new Error("Missing profile");
      const base=defaults();
      data={...base,...parsed};
      saveData();
      showApp();
      setPage("reports");
      notify("Backup restored.");
    } catch {
      notify("This file is not a valid FINOVA backup.");
    }
  };
  reader.onerror=()=>notify("Could not read the selected file.");
  reader.readAsText(file);
}

/* ---------- Start ---------- */

function init() {
  $("txDate").value=today();
  $("receiptDate").value=today();

  if(data.profile && data.policyAccepted) showApp();
  else showOnboarding();
}

init();

