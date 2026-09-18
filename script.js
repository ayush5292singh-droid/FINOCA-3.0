"use strict";

/* =========================================================
   FINANCE MANAGER - MAXIMUM OFFLINE EDITION
   LOANS + EMI + FINANCE PRO
   ========================================================= */

const STORAGE_KEY = "finance_manager_maximum_v2";

const defaultData = {
  profile: {
    name: "My Finance",
    currency: "INR",
    theme: "dark"
  },

  wallets: [
    {
      id: "wallet-main",
      name: "Main Wallet",
      type: "Cash",
      opening: 0
    }
  ],

  transactions: [],
  budgets: [],
  goals: [],
  recurring: [],
  loans: [],

  settings: {
    monthlyIncomeTarget: 0,
    notifications: true
  },

  pro: {
    active: false
  }
};

let data = loadData();
let currentPage = "dashboard";

let expenseChart = null;
let trendChart = null;
let categoryChart = null;
let receiptImage = "";

const categories = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Education",
  "Rent",
  "Salary",
  "Investment",
  "Travel",
  "Other"
];

const icons = {
  Food: "🍔",
  Transport: "🚗",
  Shopping: "🛍️",
  Bills: "🧾",
  Entertainment: "🎮",
  Health: "💊",
  Education: "📚",
  Rent: "🏠",
  Salary: "💼",
  Investment: "📈",
  Travel: "✈️",
  Other: "◈"
};

const currencySymbols = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "د.إ"
};

/* =========================================================
   DATA
   ========================================================= */

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return structuredClone(defaultData);
    }

    const parsed = JSON.parse(saved);

    return {
      ...structuredClone(defaultData),
      ...parsed,

      profile: {
        ...defaultData.profile,
        ...(parsed.profile || {})
      },

      settings: {
        ...defaultData.settings,
        ...(parsed.settings || {})
      },

      pro: {
        ...defaultData.pro,
        ...(parsed.pro || {})
      },

      wallets: parsed.wallets || [],
      transactions: parsed.transactions || [],
      budgets: parsed.budgets || [],
      goals: parsed.goals || [],
      recurring: parsed.recurring || [],
      loans: parsed.loans || []
    };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}

function money(value) {
  const symbol = currencySymbols[data.profile.currency] || "₹";

  return symbol + Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  });
}

function numberValue(value) {
  return Number(value || 0);
}

function today() {
  return new Date().toISOString().slice(0,10);
}

function monthKey(date = today()) {
  return date.slice(0,7);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================================================
   UI
   ========================================================= */

function showToast(message,type="success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");

  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => toast.remove(),3200);
}

function openModal(html) {
  document.getElementById("modal-box").innerHTML = html;
  document.getElementById("modal-backdrop").classList.add("open");
}

function closeModal(event) {
  if (!event || event.target.id === "modal-backdrop") {
    document.getElementById("modal-backdrop").classList.remove("open");
    receiptImage = "";
  }
}

function closeModalDirect() {
  document.getElementById("modal-backdrop").classList.remove("open");
  receiptImage = "";
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

function toggleTheme() {
  data.profile.theme =
    data.profile.theme === "dark" ? "light" : "dark";

  document.documentElement.setAttribute(
    "data-theme",
    data.profile.theme
  );

  saveData();
  render();
}

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click",() => {
      currentPage = button.dataset.page;

      document.querySelectorAll(".nav-btn").forEach(item => {
        item.classList.toggle("active",item === button);
      });

      document.getElementById("sidebar").classList.remove("open");

      render();
    });
  });
}

function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  render();
}

/* =========================================================
   TOTALS
   ========================================================= */

function totals() {
  let income = 0;
  let expenses = 0;

  data.transactions.forEach(transaction => {
    if (transaction.type === "income") {
      income += numberValue(transaction.amount);
    }

    if (transaction.type === "expense") {
      expenses += numberValue(transaction.amount);
    }
  });

  const opening = data.wallets.reduce(
    (sum,wallet) => sum + numberValue(wallet.opening),
    0
  );

  return {
    income,
    expenses,
    opening,
    balance: opening + income - expenses,
    net: income - expenses
  };
}

function walletBalance(walletId) {
  const wallet = data.wallets.find(item => item.id === walletId);

  if (!wallet) return 0;

  let result = numberValue(wallet.opening);

  data.transactions.forEach(transaction => {
    if (transaction.walletId !== walletId) return;

    if (transaction.type === "income") {
      result += numberValue(transaction.amount);
    }

    if (transaction.type === "expense") {
      result -= numberValue(transaction.amount);
    }
  });

  return result;
}

function monthlyTransactions(month = monthKey()) {
  return data.transactions.filter(item =>
    item.date.startsWith(month)
  );
}

function monthlyTotals(month = monthKey()) {
  const transactions = monthlyTransactions(month);

  return {
    income: transactions
      .filter(item => item.type === "income")
      .reduce((sum,item) => sum + numberValue(item.amount),0),

    expenses: transactions
      .filter(item => item.type === "expense")
      .reduce((sum,item) => sum + numberValue(item.amount),0)
  };
}

/* =========================================================
   RENDER ENGINE
   ========================================================= */

function render() {
  document.documentElement.setAttribute(
    "data-theme",
    data.profile.theme
  );

  const titles = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    wallets: "Wallets",
    budgets: "Budgets",
    goals: "Savings Goals",
    loans: "Loans",
    recurring: "Recurring Payments",
    receipts: "Receipt Scanner",
    analytics: "Analytics",
    reports: "Reports",
    pro: "Finance Pro",
    backup: "Backup & Restore",
    settings: "Settings"
  };

  document.getElementById("page-title").textContent =
    titles[currentPage] || "Dashboard";

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
    backup: renderBackup,
    settings: renderSettings
  };

  document.getElementById("app-content").innerHTML =
    `<div class="page">${pages[currentPage]()}</div>`;

  if (currentPage === "dashboard") {
    setTimeout(drawDashboardCharts,50);
  }

  if (currentPage === "analytics") {
    setTimeout(drawAnalyticsCharts,50);
  }
}

function statCard(label,value,className,meta) {
  return `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value ${className}">${money(value)}</div>
      <div class="stat-meta">${meta}</div>
    </div>
  `;
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const t = totals();
  const month = monthlyTotals();

  const recent = [...data.transactions]
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0,6);

  const savingsRate = month.income
    ? Math.round(((month.income - month.expenses) / month.income) * 100)
    : 0;

  const activeLoans = data.loans.filter(
    loan => loan.paidEmis < loan.totalEmis
  );

  return `
    <section class="stats-grid">
      ${statCard("TOTAL BALANCE",t.balance,"neutral","Across all wallets")}
      ${statCard("TOTAL INCOME",t.income,"income","All recorded income")}
      ${statCard("TOTAL EXPENSES",t.expenses,"expense","All recorded spending")}
      ${statCard("NET POSITION",t.net,t.net >= 0 ? "income":"expense","Income minus expenses")}
    </section>

    <div class="dashboard-grid">

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Cashflow overview</h3>
            <p>Income and expenses by month</p>
          </div>
          <span class="badge">LIVE LOCAL DATA</span>
        </div>

        <div class="chart-box">
          <canvas id="trend-chart"></canvas>
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Spending categories</h3>
            <p>Where your money goes</p>
          </div>
        </div>

        <div class="chart-box small">
          <canvas id="expense-chart"></canvas>
        </div>
      </section>

    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Quick actions</h3>
          <p>Manage your money faster</p>
        </div>
      </div>

      <div class="quick-actions">
        <button onclick="openTransactionModal('income')">
          <span>↗</span>Add income
        </button>

        <button onclick="openTransactionModal('expense')">
          <span>↘</span>Add expense
        </button>

        <button onclick="openWalletModal()">
          <span>▣</span>New wallet
        </button>

        <button onclick="openLoanModal()">
          <span>▰</span>New loan
        </button>

        <button onclick="navigateTo('loans')">
          <span>₹</span>Pay EMI
        </button>

        <button onclick="navigateTo('pro')">
          <span>✦</span>Finance Pro
        </button>
      </div>
    </section>

    ${activeLoans.length ? `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Loan command center</h3>
            <p>Your active EMI commitments</p>
          </div>

          <button class="secondary-btn" onclick="navigateTo('loans')">
            View loans
          </button>
        </div>

        <div class="cards-grid">
          ${activeLoans.slice(0,3).map(loanMiniCard).join("")}
        </div>
      </section>
    ` : ""}

    <div class="dashboard-grid">

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Recent transactions</h3>
            <p>Your latest financial activity</p>
          </div>

          <button class="secondary-btn"
            onclick="navigateTo('transactions')">
            View all
          </button>
        </div>

        ${transactionTable(recent)}
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Smart insights</h3>
            <p>Automatic observations from your data</p>
          </div>
        </div>

        ${generateInsights()}
      </section>

    </div>

    <section class="panel">
      <div class="panel-header">
        <div>
          <h3>Monthly performance</h3>
          <p>${new Date().toLocaleString("en-IN",{month:"long",year:"numeric"})}</p>
        </div>

        <span class="badge">${savingsRate}% savings rate</span>
      </div>

      <div class="progress">
        <div class="progress-bar"
          style="width:${Math.max(0,Math.min(100,savingsRate))}%">
        </div>
      </div>

      <p class="stat-meta">
        ${
          month.income
            ? `You saved ${money(month.income-month.expenses)} this month.`
            : "Add income and expenses to unlock monthly performance insights."
        }
      </p>
    </section>
  `;
}

/* =========================================================
   TRANSACTIONS
   ========================================================= */

function transactionTable(transactions) {
  if (!transactions.length) {
    return `
      <div class="empty">
        <strong>No transactions yet</strong>
        Add your first income or expense to begin.
      </div>
    `;
  }

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>TRANSACTION</th>
            <th>DATE</th>
            <th>WALLET</th>
            <th>AMOUNT</th>
            <th>ACTION</th>
          </tr>
        </thead>

        <tbody>
          ${transactions.map(transaction => {
            const wallet = data.wallets.find(
              w => w.id === transaction.walletId
            );

            return `
              <tr>
                <td>
                  <span class="transaction-name">
                    <span class="category-icon">
                      ${icons[transaction.category] || "◈"}
                    </span>

                    <span>
                      <strong>${escapeHTML(transaction.description)}</strong>
                      <br>
                      <small>${escapeHTML(transaction.category)}</small>
                    </span>
                  </span>
                </td>

                <td>${escapeHTML(transaction.date)}</td>

                <td>
                  ${escapeHTML(wallet ? wallet.name : "Unknown")}
                </td>

                <td class="${transaction.type === "income" ? "income":"expense"}">
                  ${transaction.type === "income" ? "+" : "-"}${money(transaction.amount)}
                </td>

                <td>
                  <button class="danger-btn"
                    onclick="deleteTransaction('${transaction.id}')">
                    Delete
                  </button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTransactions() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>All transactions</h3>
          <p>Track every movement of money</p>
        </div>

        <button class="primary-btn"
          onclick="openTransactionModal()">
          + Add
        </button>
      </div>

      <div class="toolbar">
        <input id="transaction-search"
          placeholder="Search transactions..."
          oninput="filterTransactions()">

        <select id="transaction-type-filter"
          onchange="filterTransactions()">
          <option value="all">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expenses</option>
        </select>

        <select id="transaction-category-filter"
          onchange="filterTransactions()">
          <option value="all">All categories</option>
          ${categories.map(category => `<option>${category}</option>`).join("")}
        </select>
      </div>

      <div id="transaction-results">
        ${transactionTable(
          [...data.transactions]
          .sort((a,b) => b.date.localeCompare(a.date))
        )}
      </div>

    </section>
  `;
}

function filterTransactions() {
  const query =
    document.getElementById("transaction-search").value.toLowerCase();

  const type =
    document.getElementById("transaction-type-filter").value;

  const category =
    document.getElementById("transaction-category-filter").value;

  const filtered = data.transactions.filter(transaction => {

    const matchesQuery =
      transaction.description.toLowerCase().includes(query) ||
      transaction.category.toLowerCase().includes(query) ||
      (transaction.notes || "").toLowerCase().includes(query);

    const matchesType =
      type === "all" || transaction.type === type;

    const matchesCategory =
      category === "all" ||
      transaction.category === category;

    return matchesQuery &&
      matchesType &&
      matchesCategory;
  });

  document.getElementById("transaction-results").innerHTML =
    transactionTable(
      filtered.sort((a,b) => b.date.localeCompare(a.date))
    );
}

function openTransactionModal(type="expense") {
  const walletOptions = data.wallets.map(wallet =>
    `<option value="${wallet.id}">
      ${escapeHTML(wallet.name)}
    </option>`
  ).join("");

  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Add transaction</h2>

    <form onsubmit="saveTransaction(event)">

      <div class="form-grid">

        <div class="form-group">
          <label>Transaction type</label>

          <select name="type">
            <option value="expense"
              ${type === "expense" ? "selected":""}>
              Expense
            </option>

            <option value="income"
              ${type === "income" ? "selected":""}>
              Income
            </option>
          </select>
        </div>

        <div class="form-group">
          <label>Amount (${data.profile.currency})</label>
          <input name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required>
        </div>

        <div class="form-group">
          <label>Description</label>
          <input name="description"
            required
            placeholder="e.g. Grocery shopping">
        </div>

        <div class="form-group">
          <label>Category</label>

          <select name="category">
            ${categories.map(category =>
              `<option>${category}</option>`
            ).join("")}
          </select>
        </div>

        <div class="form-group">
          <label>Wallet</label>

          <select name="walletId" required>
            ${walletOptions}
          </select>
        </div>

        <div class="form-group">
          <label>Date</label>

          <input name="date"
            type="date"
            value="${today()}"
            required>
        </div>

        <div class="form-group full">
          <label>Notes</label>

          <textarea name="notes"
            rows="3"
            placeholder="Optional notes"></textarea>
        </div>

      </div>

      <div class="form-actions">
        <button type="button"
          class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn"
          type="submit">
          Save transaction
        </button>
      </div>

    </form>
  `);
}

function saveTransaction(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const amount = numberValue(form.get("amount"));

  if (amount <= 0) {
    showToast("Enter a valid amount.","error");
    return;
  }

  data.transactions.push({
    id: uid("transaction"),
    type: form.get("type"),
    amount,
    description: form.get("description").trim(),
    category: form.get("category"),
    walletId: form.get("walletId"),
    date: form.get("date"),
    notes: form.get("notes").trim(),
    createdAt: new Date().toISOString()
  });

  saveData();
  closeModalDirect();
  showToast("Transaction saved.");
  render();
}

function deleteTransaction(id) {
  if (!confirm("Delete this transaction?")) return;

  data.transactions =
    data.transactions.filter(item => item.id !== id);

  saveData();
  showToast("Transaction deleted.");
  render();
}

/* =========================================================
   WALLETS
   ========================================================= */

function renderWallets() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Your wallets and accounts</h3>
          <p>Manage cash, bank accounts and digital wallets</p>
        </div>

        <button class="primary-btn"
          onclick="openWalletModal()">
          + New wallet
        </button>
      </div>

      <div class="cards-grid">
        ${data.wallets.map(wallet => `
          <div class="wallet-card">

            <div class="wallet-top">
              <div class="wallet-symbol">▣</div>

              <button class="danger-btn"
                onclick="deleteWallet('${wallet.id}')">
                Delete
              </button>
            </div>

            <h3>${escapeHTML(wallet.name)}</h3>

            <small>${escapeHTML(wallet.type)}</small>

            <div class="card-amount">
              ${money(walletBalance(wallet.id))}
            </div>

            <small>
              Opening balance: ${money(wallet.opening)}
            </small>

          </div>
        `).join("")}
      </div>

    </section>
  `;
}

function openWalletModal() {
  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Create wallet</h2>

    <form onsubmit="saveWallet(event)">

      <div class="form-group">
        <label>Wallet name</label>
        <input name="name"
          required
          placeholder="e.g. HDFC Bank">
      </div>

      <div class="form-group">
        <label>Wallet type</label>

        <select name="type">
          <option>Cash</option>
          <option>Bank account</option>
          <option>Credit card</option>
          <option>Digital wallet</option>
          <option>Investment</option>
          <option>Other</option>
        </select>
      </div>

      <div class="form-group">
        <label>Opening balance</label>
        <input name="opening"
          type="number"
          step="0.01"
          value="0">
      </div>

      <div class="form-actions">
        <button type="button"
          class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn">
          Create wallet
        </button>
      </div>

    </form>
  `);
}

function saveWallet(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  data.wallets.push({
    id: uid("wallet"),
    name: form.get("name").trim(),
    type: form.get("type"),
    opening: numberValue(form.get("opening"))
  });

  saveData();
  closeModalDirect();
  showToast("Wallet created.");
  render();
}

function deleteWallet(id) {
  if (data.wallets.length <= 1) {
    showToast("You must keep at least one wallet.","error");
    return;
  }

  if (data.transactions.some(t => t.walletId === id)) {
    showToast(
      "This wallet has transactions and cannot be deleted.",
      "error"
    );
    return;
  }

  data.wallets =
    data.wallets.filter(wallet => wallet.id !== id);

  saveData();
  showToast("Wallet deleted.");
  render();
}

/* =========================================================
   BUDGETS
   ========================================================= */

function renderBudgets() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Monthly budgets</h3>
          <p>Set spending limits for categories</p>
        </div>

        <button class="primary-btn"
          onclick="openBudgetModal()">
          + Add budget
        </button>
      </div>

      ${
        data.budgets.length
        ? `
          <div class="cards-grid">
            ${data.budgets.map(budget => {

              const spent = data.transactions
                .filter(t =>
                  t.type === "expense" &&
                  t.category === budget.category &&
                  t.date.startsWith(budget.month)
                )
                .reduce(
                  (sum,t) => sum + numberValue(t.amount),
                  0
                );

              const percentage =
                budget.limit
                ? Math.round((spent / budget.limit) * 100)
                : 0;

              return `
                <div class="budget-card">

                  <div class="wallet-top">
                    <div class="category-icon">
                      ${icons[budget.category] || "◈"}
                    </div>

                    <button class="danger-btn"
                      onclick="deleteBudget('${budget.id}')">
                      Delete
                    </button>
                  </div>

                  <h3>${escapeHTML(budget.category)}</h3>
                  <small>${budget.month}</small>

                  <div class="card-amount">
                    ${money(spent)}
                  </div>

                  <div class="progress">
                    <div class="progress-bar"
                      style="
                        width:${Math.min(100,percentage)}%;
                        ${percentage > 100 ? "background:var(--red)" : ""}
                      ">
                    </div>
                  </div>

                  <div class="progress-label">
                    <span>${percentage}% used</span>
                    <span>Limit: ${money(budget.limit)}</span>
                  </div>

                </div>
              `;
            }).join("")}
          </div>
        `
        : `
          <div class="empty">
            <strong>No budgets created</strong>
            Create a budget to control your spending.
          </div>
        `
      }

    </section>
  `;
}

function openBudgetModal() {
  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Create budget</h2>

    <form onsubmit="saveBudget(event)">

      <div class="form-group">
        <label>Category</label>

        <select name="category">
          ${categories
            .filter(c => c !== "Salary")
            .map(c => `<option>${c}</option>`)
            .join("")}
        </select>
      </div>

      <div class="form-group">
        <label>Monthly limit</label>
        <input name="limit"
          type="number"
          min="1"
          required>
      </div>

      <div class="form-group">
        <label>Month</label>
        <input name="month"
          type="month"
          value="${monthKey()}"
          required>
      </div>

      <div class="form-actions">
        <button type="button"
          class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn">
          Save budget
        </button>
      </div>

    </form>
  `);
}

function saveBudget(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  data.budgets.push({
    id: uid("budget"),
    category: form.get("category"),
    limit: numberValue(form.get("limit")),
    month: form.get("month")
  });

  saveData();
  closeModalDirect();
  showToast("Budget created.");
  render();
}

function deleteBudget(id) {
  data.budgets =
    data.budgets.filter(item => item.id !== id);

  saveData();
  showToast("Budget deleted.");
  render();
}

/* =========================================================
   SAVINGS GOALS
   ========================================================= */

function renderGoals() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Savings goals</h3>
          <p>Turn your plans into measurable targets</p>
        </div>

        <button class="primary-btn"
          onclick="openGoalModal()">
          + New goal
        </button>
      </div>

      ${
        data.goals.length
        ? `
          <div class="cards-grid">
            ${data.goals.map(goal => {

              const percentage =
                goal.target
                ? Math.round((goal.saved / goal.target) * 100)
                : 0;

              return `
                <div class="goal-card">

                  <div class="goal-top">
                    <div class="category-icon">◎</div>

                    <button class="danger-btn"
                      onclick="deleteGoal('${goal.id}')">
                      Delete
                    </button>
                  </div>

                  <h3>${escapeHTML(goal.name)}</h3>

                  <small>
                    Deadline:
                    ${escapeHTML(goal.deadline || "Not set")}
                  </small>

                  <div class="card-amount">
                    ${money(goal.saved)}
                  </div>

                  <div class="progress">
                    <div class="progress-bar"
                      style="width:${Math.min(100,percentage)}%">
                    </div>
                  </div>

                  <div class="progress-label">
                    <span>${percentage}% complete</span>
                    <span>${money(goal.target)} target</span>
                  </div>

                  <button
                    class="secondary-btn"
                    style="margin-top:15px;width:100%"
                    onclick="addToGoal('${goal.id}')">
                    + Add savings
                  </button>

                </div>
              `;
            }).join("")}
          </div>
        `
        : `
          <div class="empty">
            <strong>No savings goals</strong>
            Create a goal for your next big achievement.
          </div>
        `
      }

    </section>
  `;
}

function openGoalModal() {
  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Create savings goal</h2>

    <form onsubmit="saveGoal(event)">

      <div class="form-group">
        <label>Goal name</label>
        <input name="name"
          required
          placeholder="e.g. New laptop">
      </div>

      <div class="form-group">
        <label>Target amount</label>
        <input name="target"
          type="number"
          min="1"
          required>
      </div>

      <div class="form-group">
        <label>Already saved</label>
        <input name="saved"
          type="number"
          min="0"
          value="0">
      </div>

      <div class="form-group">
        <label>Deadline</label>
        <input name="deadline"
          type="date">
      </div>

      <div class="form-actions">
        <button type="button"
          class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn">
          Create goal
        </button>
      </div>

    </form>
  `);
}

function saveGoal(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  data.goals.push({
    id: uid("goal"),
    name: form.get("name").trim(),
    target: numberValue(form.get("target")),
    saved: numberValue(form.get("saved")),
    deadline: form.get("deadline")
  });

  saveData();
  closeModalDirect();
  showToast("Savings goal created.");
  render();
}

function addToGoal(id) {
  const amount = prompt("How much did you save?");

  if (amount === null) return;

  const value = numberValue(amount);

  if (value <= 0) {
    showToast("Enter a valid amount.","error");
    return;
  }

  const goal = data.goals.find(item => item.id === id);

  if (!goal) return;

  goal.saved += value;

  saveData();
  showToast("Savings added.");
  render();
}

function deleteGoal(id) {
  data.goals =
    data.goals.filter(item => item.id !== id);

  saveData();
  showToast("Goal deleted.");
  render();
}

/* =========================================================
   LOANS
   ========================================================= */

function loanProgress(loan) {
  if (!loan.totalEmis) return 0;

  return Math.min(
    100,
    Math.round(
      (numberValue(loan.paidEmis) /
       numberValue(loan.totalEmis)) * 100
    )
  );
}

function loanRemainingEmis(loan) {
  return Math.max(
    0,
    numberValue(loan.totalEmis) -
    numberValue(loan.paidEmis)
  );
}

function loanTotalPayable(loan) {
  return numberValue(loan.emi) *
    numberValue(loan.totalEmis);
}

function loanOutstanding(loan) {
  return Math.max(
    0,
    loanTotalPayable(loan) -
    numberValue(loan.emi) *
    numberValue(loan.paidEmis)
  );
}

function loanMiniCard(loan) {
  const percentage = loanProgress(loan);
  const remaining = loanRemainingEmis(loan);

  return `
    <div class="loan-card">

      <div class="loan-header">
        <div class="loan-title">
          <div class="loan-icon">₹</div>

          <div>
            <h3>${escapeHTML(loan.name)}</h3>
            <small>${escapeHTML(loan.lender || "Loan")}</small>
          </div>
        </div>

        <div class="loan-progress-number">
          ${percentage}%
        </div>
      </div>

      <div class="progress" style="margin-top:18px">
        <div class="progress-bar"
          style="width:${percentage}%">
        </div>
      </div>

      <div class="loan-stats">

        <div class="loan-stat">
          <small>EMI</small>
          <strong>${money(loan.emi)}</strong>
        </div>

        <div class="loan-stat">
          <small>Paid</small>
          <strong>${loan.paidEmis}/${loan.totalEmis}</strong>
        </div>

        <div class="loan-stat">
          <small>Remaining</small>
          <strong>${remaining}</strong>
        </div>

      </div>

      <button
        class="primary-btn"
        style="width:100%"
        onclick="payLoanEmi('${loan.id}')"
        ${remaining <= 0 ? "disabled":""}>
        ${remaining <= 0 ? "✓ Loan completed":"Pay EMI"}
      </button>

    </div>
  `;
}

function renderLoans() {
  const totalOutstanding = data.loans
    .filter(l => loanRemainingEmis(l) > 0)
    .reduce((sum,l) => sum + loanOutstanding(l),0);

  const monthlyEmi = data.loans
    .filter(l => loanRemainingEmis(l) > 0)
    .reduce((sum,l) => sum + numberValue(l.emi),0);

  const completed = data.loans.filter(
    l => loanProgress(l) >= 100
  ).length;

  return `
    <section class="stats-grid">

      ${statCard(
        "ACTIVE LOANS",
        data.loans.filter(l => loanRemainingEmis(l) > 0).length,
        "neutral",
        "Currently running"
      )}

      ${statCard(
        "MONTHLY EMI",
        monthlyEmi,
        "expense",
        "Current EMI commitment"
      )}

      ${statCard(
        "OUTSTANDING",
        totalOutstanding,
        "expense",
        "Estimated remaining EMI value"
      )}

      ${statCard(
        "COMPLETED",
        completed,
        "income",
        "Fully paid loans"
      )}

    </section>

    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Loan command center</h3>
          <p>Track every loan and pay EMIs from one place.</p>
        </div>

        <button class="primary-btn"
          onclick="openLoanModal()">
          + Add loan
        </button>
      </div>

      ${
        data.loans.length
        ? `
          <div class="cards-grid">
            ${data.loans.map(loanMiniCard).join("")}
          </div>
        `
        : `
          <div class="empty">
            <strong>No loans added</strong>
            Add your first loan to start tracking EMI progress.
            <br><br>
            <button class="primary-btn"
              onclick="openLoanModal()">
              + Add your first loan
            </button>
          </div>
        `
      }

    </section>
  `;
}

function openLoanModal() {
  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Add loan</h2>

    <p class="stat-meta">
      Enter your loan details. The app will automatically calculate
      EMI progress and outstanding payments.
    </p>

    <form onsubmit="saveLoan(event)">

      <div class="form-grid">

        <div class="form-group">
          <label>Loan name</label>
          <input name="name"
            required
            placeholder="e.g. Home Loan">
        </div>

        <div class="form-group">
          <label>Lender / Bank</label>
          <input name="lender"
            placeholder="e.g. SBI">
        </div>

        <div class="form-group">
          <label>Total loan amount</label>
          <input name="principal"
            type="number"
            min="0"
            step="0.01"
            required
            placeholder="500000">
        </div>

        <div class="form-group">
          <label>Monthly EMI</label>
          <input name="emi"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="15000">
        </div>

        <div class="form-group">
          <label>Total number of EMIs</label>
          <input name="totalEmis"
            type="number"
            min="1"
            step="1"
            required
            placeholder="36">
        </div>

        <div class="form-group">
          <label>Already paid EMIs</label>
          <input name="paidEmis"
            type="number"
            min="0"
            step="1"
            value="0">
        </div>

        <div class="form-group">
          <label>Interest rate (%)</label>
          <input name="interest"
            type="number"
            min="0"
            step="0.01"
            value="0">
        </div>

        <div class="form-group">
          <label>Next EMI date</label>
          <input name="dueDate"
            type="date"
            value="${today()}">
        </div>

      </div>

      <div class="insight">
        <strong>How progress works:</strong>
        If you enter 2 paid EMIs out of 10 total EMIs,
        the app automatically shows <strong>20%</strong> completed.
      </div>

      <div class="form-actions">

        <button type="button"
          class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn">
          Save loan
        </button>

      </div>

    </form>
  `);
}

function saveLoan(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  const totalEmis =
    Math.max(1,Math.floor(numberValue(form.get("totalEmis"))));

  const paidEmis =
    Math.min(
      totalEmis,
      Math.max(0,Math.floor(numberValue(form.get("paidEmis"))))
    );

  const emi = numberValue(form.get("emi"));

  if (emi <= 0) {
    showToast("Enter a valid EMI amount.","error");
    return;
  }

  data.loans.push({
    id: uid("loan"),
    name: form.get("name").trim(),
    lender: form.get("lender").trim(),
    principal: numberValue(form.get("principal")),
    emi,
    totalEmis,
    paidEmis,
    interest: numberValue(form.get("interest")),
    dueDate: form.get("dueDate"),
    createdAt: new Date().toISOString(),
    payments: []
  });

  saveData();
  closeModalDirect();
  showToast("Loan added successfully.");
  navigateTo("loans");
}

function payLoanEmi(id) {
  const loan = data.loans.find(item => item.id === id);

  if (!loan) return;

  if (loanRemainingEmis(loan) <= 0) {
    showToast("This loan is already completed.","error");
    return;
  }

  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Pay EMI</h2>

    <div class="loan-card">

      <div class="loan-title">
        <div class="loan-icon">₹</div>

        <div>
          <h3>${escapeHTML(loan.name)}</h3>
          <small>${escapeHTML(loan.lender || "Loan")}</small>
        </div>
      </div>

      <div class="loan-stats">

        <div class="loan-stat">
          <small>EMI</small>
          <strong>${money(loan.emi)}</strong>
        </div>

        <div class="loan-stat">
          <small>Current progress</small>
          <strong>${loanProgress(loan)}%</strong>
        </div>

        <div class="loan-stat">
          <small>Remaining</small>
          <strong>${loanRemainingEmis(loan)}</strong>
        </div>

      </div>

      <div class="progress">
        <div class="progress-bar"
          style="width:${loanProgress(loan)}%">
        </div>
      </div>

      <p class="stat-meta">
        After this payment your progress will become
        <strong>${Math.min(
          100,
          Math.round(
            ((loan.paidEmis + 1) / loan.totalEmis) * 100
          )
        )}%</strong>.
      </p>

      <div class="form-actions">

        <button class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn"
          onclick="confirmLoanEmi('${loan.id}')">
          Confirm ₹${Number(loan.emi).toLocaleString("en-IN")}
        </button>

      </div>

    </div>
  `);
}

function confirmLoanEmi(id) {
  const loan = data.loans.find(item => item.id === id);

  if (!loan || loanRemainingEmis(loan) <= 0) return;

  loan.paidEmis++;

  if (!Array.isArray(loan.payments)) {
    loan.payments = [];
  }

  loan.payments.push({
    id: uid("emi"),
    amount: loan.emi,
    date: today()
  });

  saveData();
  closeModalDirect();

  if (loan.paidEmis >= loan.totalEmis) {
    showToast("🎉 Loan fully completed!");
  } else {
    showToast(
      `EMI paid. Loan is now ${loanProgress(loan)}% complete.`
    );
  }

  render();
}

/* =========================================================
   RECURRING
   ========================================================= */

function renderRecurring() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Recurring payments</h3>
          <p>Keep track of subscriptions and regular bills</p>
        </div>

        <button class="primary-btn"
          onclick="openRecurringModal()">
          + Add payment
        </button>
      </div>

      ${
        data.recurring.length
        ? `
          <div class="cards-grid">
            ${data.recurring.map(item => `
              <div class="goal-card">

                <div class="goal-top">
                  <div class="category-icon">↻</div>

                  <button class="danger-btn"
                    onclick="deleteRecurring('${item.id}')">
                    Delete
                  </button>
                </div>

                <h3>${escapeHTML(item.name)}</h3>

                <small>${escapeHTML(item.frequency)}</small>

                <div class="card-amount">
                  ${money(item.amount)}
                </div>

                <small>
                  Next payment:
                  ${escapeHTML(item.nextDate)}
                </small>

                <button
                  class="secondary-btn"
                  style="width:100%;margin-top:15px"
                  onclick="markRecurringPaid('${item.id}')">
                  Mark as paid
                </button>

              </div>
            `).join("")}
          </div>
        `
        : `
          <div class="empty">
            <strong>No recurring payments</strong>
            Add subscriptions, EMIs or monthly bills.
          </div>
        `
      }

    </section>
  `;
}

function openRecurringModal() {
  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Add recurring payment</h2>

    <form onsubmit="saveRecurring(event)">

      <div class="form-group">
        <label>Payment name</label>
        <input name="name"
          required
          placeholder="e.g. Internet bill">
      </div>

      <div class="form-group">
        <label>Amount</label>
        <input name="amount"
          type="number"
          min="0.01"
          required>
      </div>

      <div class="form-group">
        <label>Frequency</label>

        <select name="frequency">
          <option>Weekly</option>
          <option>Monthly</option>
          <option>Yearly</option>
        </select>
      </div>

      <div class="form-group">
        <label>Next payment date</label>
        <input name="nextDate"
          type="date"
          value="${today()}"
          required>
      </div>

      <div class="form-actions">

        <button type="button"
          class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn">
          Save payment
        </button>

      </div>

    </form>
  `);
}

function saveRecurring(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  data.recurring.push({
    id: uid("recurring"),
    name: form.get("name").trim(),
    amount: numberValue(form.get("amount")),
    frequency: form.get("frequency"),
    nextDate: form.get("nextDate")
  });

  saveData();
  closeModalDirect();
  showToast("Recurring payment added.");
  render();
}

function markRecurringPaid(id) {
  const item = data.recurring.find(
    payment => payment.id === id
  );

  if (!item) return;

  const date = new Date(item.nextDate);

  if (item.frequency === "Weekly") {
    date.setDate(date.getDate()+7);
  }

  if (item.frequency === "Monthly") {
    date.setMonth(date.getMonth()+1);
  }

  if (item.frequency === "Yearly") {
    date.setFullYear(date.getFullYear()+1);
  }

  item.nextDate =
    date.toISOString().slice(0,10);

  saveData();

  showToast(
    "Payment marked as paid. Next date updated."
  );

  render();
}

function deleteRecurring(id) {
  data.recurring =
    data.recurring.filter(item => item.id !== id);

  saveData();
  showToast("Recurring payment deleted.");
  render();
}

/* =========================================================
   RECEIPTS
   ========================================================= */

function renderReceipts() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Receipt scanner</h3>
          <p>Upload a bill image and record the expense</p>
        </div>

        <span class="badge">
          MANUAL CONFIRMATION
        </span>
      </div>

      <div class="upload-zone">

        <strong>Upload receipt image</strong>

        <p>Select a receipt from your device.</p>

        <br>

        <input type="file"
          accept="image/*"
          onchange="previewReceipt(event)">

        <div id="receipt-preview-area"></div>

      </div>

      <div class="insight"
        style="margin-top:20px">

        <strong>Receipt system:</strong>
        This offline edition stores the receipt image locally.
        Automatic OCR requires an OCR service or native Android
        integration.

      </div>

      <button class="primary-btn"
        onclick="openReceiptEntryModal()"
        style="margin-top:10px">
        Enter receipt details
      </button>

    </section>
  `;
}

function previewReceipt(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function(e) {
    receiptImage = e.target.result;

    document.getElementById(
      "receipt-preview-area"
    ).innerHTML = `
      <img
        class="receipt-preview"
        src="${receiptImage}"
        alt="Receipt preview">

      <p>Receipt loaded successfully.</p>
    `;
  };

  reader.readAsDataURL(file);
}

function openReceiptEntryModal() {
  const walletOptions =
    data.wallets.map(wallet =>
      `<option value="${wallet.id}">
        ${escapeHTML(wallet.name)}
      </option>`
    ).join("");

  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <h2>Record receipt expense</h2>

    <form onsubmit="saveReceiptExpense(event)">

      <div class="form-group">
        <label>Merchant name</label>
        <input name="description"
          required
          placeholder="e.g. Supermarket">
      </div>

      <div class="form-group">
        <label>Total amount</label>
        <input name="amount"
          type="number"
          min="0.01"
          step="0.01"
          required>
      </div>

      <div class="form-group">
        <label>Category</label>

        <select name="category">
          ${categories.map(category =>
            `<option>${category}</option>`
          ).join("")}
        </select>
      </div>

      <div class="form-group">
        <label>Wallet</label>

        <select name="walletId">
          ${walletOptions}
        </select>
      </div>

      <div class="form-group">
        <label>Date</label>
        <input name="date"
          type="date"
          value="${today()}">
      </div>

      <div class="form-actions">

        <button type="button"
          class="secondary-btn"
          onclick="closeModalDirect()">
          Cancel
        </button>

        <button class="primary-btn">
          Record expense
        </button>

      </div>

    </form>
  `);
}

function saveReceiptExpense(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  data.transactions.push({
    id: uid("receipt"),
    type: "expense",
    amount: numberValue(form.get("amount")),
    description: form.get("description").trim(),
    category: form.get("category"),
    walletId: form.get("walletId"),
    date: form.get("date"),
    notes: "Added through receipt scanner",
    receiptImage,
    createdAt: new Date().toISOString()
  });

  saveData();
  closeModalDirect();

  showToast("Receipt expense saved.");
  render();
}

/* =========================================================
   ANALYTICS
   ========================================================= */

function renderAnalytics() {
  const expenses =
    data.transactions.filter(item => item.type === "expense");

  const largest = expenses.length
    ? Math.max(...expenses.map(item => item.amount))
    : 0;

  const average = expenses.length
    ? expenses.reduce((sum,item) =>
        sum + numberValue(item.amount),0
      ) / expenses.length
    : 0;

  const t = totals();

  const savingRate =
    t.income
      ? ((t.net / t.income) * 100).toFixed(1)
      : 0;

  return `
    <section class="stats-grid">

      ${statCard(
        "AVERAGE EXPENSE",
        average,
        "expense",
        "Per expense transaction"
      )}

      ${statCard(
        "LARGEST EXPENSE",
        largest,
        "expense",
        "Highest recorded expense"
      )}

      <div class="stat-card">
        <div class="stat-label">SAVINGS RATE</div>
        <div class="stat-value income">${savingRate}%</div>
        <div class="stat-meta">Based on total income</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">TRANSACTIONS</div>
        <div class="stat-value neutral">
          ${data.transactions.length}
        </div>
        <div class="stat-meta">Total recorded entries</div>
      </div>

    </section>

    <div class="dashboard-grid">

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Category analysis</h3>
            <p>Total expenses by category</p>
          </div>
        </div>

        <div class="chart-box">
          <canvas id="category-chart"></canvas>
        </div>
      </section>

      <section class="panel">

        <div class="panel-header">
          <div>
            <h3>Analysis notes</h3>
            <p>Based on your stored transactions</p>
          </div>
        </div>

        ${generateInsights()}

      </section>

    </div>
  `;
}

function generateInsights() {
  const t = totals();
  const month = monthlyTotals();

  const expenseTransactions =
    data.transactions.filter(t => t.type === "expense");

  if (!data.transactions.length) {
    return `
      <div class="insight">
        <strong>Welcome!</strong><br>
        Add transactions to receive automatic financial observations.
      </div>
    `;
  }

  const categoryTotals = {};

  expenseTransactions.forEach(transaction => {
    categoryTotals[transaction.category] =
      (categoryTotals[transaction.category] || 0) +
      numberValue(transaction.amount);
  });

  const biggestCategory =
    Object.entries(categoryTotals)
      .sort((a,b) => b[1]-a[1])[0];

  const insights = [];

  if (t.net > 0) {
    insights.push(
      `Your overall net position is positive by
      <strong>${money(t.net)}</strong>.`
    );
  } else {
    insights.push(
      `Your expenses exceed your income by
      <strong>${money(Math.abs(t.net))}</strong>.`
    );
  }

  if (biggestCategory) {
    insights.push(
      `Your highest spending category is
      <strong>${escapeHTML(biggestCategory[0])}</strong>
      at <strong>${money(biggestCategory[1])}</strong>.`
    );
  }

  if (month.income > 0) {
    const rate =
      Math.round(
        ((month.income-month.expenses)/month.income)*100
      );

    insights.push(
      `Your current monthly savings rate is approximately
      <strong>${rate}%</strong>.`
    );
  }

  if (data.goals.length) {
    const nearest = data.goals[0];

    insights.push(
      `Your active goal
      <strong>${escapeHTML(nearest.name)}</strong>
      is ${Math.round(
        (nearest.saved/nearest.target)*100
      )}% complete.`
    );
  }

  if (data.loans.length) {
    const active = data.loans.filter(
      l => loanRemainingEmis(l) > 0
    );

    if (active.length) {
      insights.push(
        `You currently have
        <strong>${active.length}</strong>
        active loan${active.length > 1 ? "s":""}.`
      );
    }
  }

  return insights
    .map(text => `<div class="insight">${text}</div>`)
    .join("");
}

/* =========================================================
   CHARTS
   ========================================================= */

function drawDashboardCharts() {
  if (typeof Chart === "undefined") return;

  const monthly = {};

  data.transactions.forEach(transaction => {
    const month = transaction.date.slice(0,7);

    if (!monthly[month]) {
      monthly[month] = {
        income: 0,
        expense: 0
      };
    }

    if (transaction.type === "income") {
      monthly[month].income += numberValue(transaction.amount);
    }

    if (transaction.type === "expense") {
      monthly[month].expense += numberValue(transaction.amount);
    }
  });

  const labels =
    Object.keys(monthly).sort().slice(-6);

  const incomeData =
    labels.map(label => monthly[label].income);

  const expenseData =
    labels.map(label => monthly[label].expense);

  if (trendChart) trendChart.destroy();

  const trendCanvas =
    document.getElementById("trend-chart");

  if (!trendCanvas) return;

  trendChart = new Chart(trendCanvas,{
    type:"line",

    data:{
      labels: labels.length ? labels:["No data"],

      datasets:[
        {
          label:"Income",
          data:labels.length ? incomeData:[0],
          borderColor:"#55e6a5",
          backgroundColor:"rgba(85,230,165,.1)",
          fill:true,
          tension:.35
        },

        {
          label:"Expenses",
          data:labels.length ? expenseData:[0],
          borderColor:"#ff718d",
          backgroundColor:"rgba(255,113,141,.1)",
          fill:true,
          tension:.35
        }
      ]
    },

    options:chartOptions()
  });

  const categoryTotals = {};

  data.transactions
    .filter(t => t.type === "expense")
    .forEach(transaction => {
      categoryTotals[transaction.category] =
        (categoryTotals[transaction.category] || 0) +
        numberValue(transaction.amount);
    });

  const categoryLabels =
    Object.keys(categoryTotals);

  const categoryValues =
    Object.values(categoryTotals);

  if (expenseChart) expenseChart.destroy();

  const expenseCanvas =
    document.getElementById("expense-chart");

  if (!expenseCanvas) return;

  expenseChart = new Chart(expenseCanvas,{
    type:"doughnut",

    data:{
      labels:
        categoryLabels.length
        ? categoryLabels
        : ["No expenses"],

      datasets:[
        {
          data:
            categoryValues.length
            ? categoryValues
            : [1],

          backgroundColor:[
            "#55e6ff",
            "#a98bff",
            "#55e6a5",
            "#ff718d",
            "#ffd166",
            "#66b9ff",
            "#ff9f68",
            "#d4a5ff"
          ],

          borderWidth:0
        }
      ]
    },

    options:{
      responsive:true,
      maintainAspectRatio:false,

      plugins:{
        legend:{
          labels:{
            color:getComputedStyle(document.body).color
          }
        }
      }
    }
  });
}

function drawAnalyticsCharts() {
  if (typeof Chart === "undefined") return;

  const categoryTotals = {};

  data.transactions
    .filter(t => t.type === "expense")
    .forEach(transaction => {
      categoryTotals[transaction.category] =
        (categoryTotals[transaction.category] || 0) +
        numberValue(transaction.amount);
    });

  if (categoryChart) categoryChart.destroy();

  const canvas =
    document.getElementById("category-chart");

  if (!canvas) return;

  categoryChart = new Chart(canvas,{
    type:"bar",

    data:{
      labels:Object.keys(categoryTotals),

      datasets:[
        {
          label:"Expenses",
          data:Object.values(categoryTotals),
          backgroundColor:"#a98bff",
          borderRadius:8
        }
      ]
    },

    options:{
      responsive:true,
      maintainAspectRatio:false,

      scales:{
        x:{
          ticks:{color:"#8d9ab3"},
          grid:{display:false}
        },

        y:{
          ticks:{color:"#8d9ab3"},
          grid:{
            color:"rgba(141,154,179,.12)"
          }
        }
      }
    }
  });
}

function chartOptions() {
  return {
    responsive:true,
    maintainAspectRatio:false,

    interaction:{
      mode:"index",
      intersect:false
    },

    scales:{
      x:{
        ticks:{color:"#8d9ab3"},
        grid:{display:false}
      },

      y:{
        ticks:{color:"#8d9ab3"},
        grid:{
          color:"rgba(141,154,179,.12)"
        }
      }
    },

    plugins:{
      legend:{
        labels:{
          color:getComputedStyle(document.body).color
        }
      }
    }
  };
}

/* =========================================================
   REPORTS
   ========================================================= */

function renderReports() {
  const t = totals();

  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Financial reports</h3>
          <p>Export and print your finance data</p>
        </div>
      </div>

      <div class="report-grid">

        <div class="report-option">
          <h3>CSV transaction report</h3>
          <p>
            Export all transactions into a spreadsheet-compatible CSV.
          </p>

          <button class="primary-btn"
            onclick="exportCSV()">
            Export CSV
          </button>
        </div>

        <div class="report-option">
          <h3>Printable financial summary</h3>
          <p>
            Open a print-friendly summary.
          </p>

          <button class="primary-btn"
            onclick="printSummary()">
            Print summary
          </button>
        </div>

        <div class="report-option">
          <h3>Current balance</h3>
          <p>Total balance across all wallets.</p>
          <h2 class="neutral">${money(t.balance)}</h2>
        </div>

        <div class="report-option">
          <h3>Transaction count</h3>
          <p>Total number of financial entries.</p>
          <h2 class="neutral">${data.transactions.length}</h2>
        </div>

      </div>

    </section>
  `;
}

function exportCSV() {
  const headers = [
    "Date",
    "Type",
    "Description",
    "Category",
    "Amount",
    "Wallet",
    "Notes"
  ];

  const rows = data.transactions.map(transaction => {
    const wallet =
      data.wallets.find(
        w => w.id === transaction.walletId
      );

    return [
      transaction.date,
      transaction.type,
      transaction.description,
      transaction.category,
      transaction.amount,
      wallet ? wallet.name : "",
      transaction.notes || ""
    ];
  });

  const csv =
    [headers,...rows]
      .map(row =>
        row.map(value =>
          `"${String(value).replaceAll('"','""')}"`
        ).join(",")
      )
      .join("\n");

  downloadFile(
    "finance-manager-transactions.csv",
    csv,
    "text/csv"
  );

  showToast("CSV report exported.");
}

function printSummary() {
  const t = totals();

  const report = `
    <html>
      <head>
        <title>Finance Manager Report</title>

        <style>
          body{
            font-family:Arial;
            padding:30px
          }

          table{
            width:100%;
            border-collapse:collapse
          }

          th,td{
            padding:10px;
            border:1px solid #ddd;
            text-align:left
          }
        </style>
      </head>

      <body>

        <h1>FINANCE MANAGER REPORT</h1>

        <p>
          Generated:
          ${new Date().toLocaleString()}
        </p>

        <h2>
          Total balance: ${money(t.balance)}
        </h2>

        <h3>Total income: ${money(t.income)}</h3>
        <h3>Total expenses: ${money(t.expenses)}</h3>
        <h3>Net position: ${money(t.net)}</h3>

        <h2>Transactions</h2>

        <table>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th>Amount</th>
          </tr>

          ${data.transactions.map(transaction => `
            <tr>
              <td>${escapeHTML(transaction.date)}</td>
              <td>${escapeHTML(transaction.description)}</td>
              <td>${escapeHTML(transaction.type)}</td>
              <td>${money(transaction.amount)}</td>
            </tr>
          `).join("")}

        </table>

      </body>
    </html>
  `;

  const windowPrint =
    window.open("","_blank");

  if (!windowPrint) {
    showToast(
      "Please allow pop-ups to print.",
      "error"
    );
    return;
  }

  windowPrint.document.write(report);
  windowPrint.document.close();
  windowPrint.focus();
  windowPrint.print();
}

/* =========================================================
   FINANCE PRO
   ========================================================= */

function renderPro() {
  return `
    <section class="pro-hero">

      <div class="pro-symbol">✦</div>

      <span class="badge">FINANCE PRO</span>

      <h1>
        Turn your finance manager into a
        <span style="color:var(--cyan)">
          professional money dashboard.
        </span>
      </h1>

      <p>
        Advanced tools designed for deeper tracking,
        reporting and financial organisation.
      </p>

      <div class="pro-price">
        ₹99 <small>/ month</small>
      </div>

      <p>
        Or ₹1,169/year
      </p>

      <button class="primary-btn"
        onclick="showPremium()">
        Explore Finance Pro
      </button>

    </section>

    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Pro feature system</h3>
          <p>Premium capabilities planned for the full app.</p>
        </div>
      </div>

      <div class="pro-grid">

        <div class="pro-card">
          <div class="pro-icon">📊</div>
          <h3>Advanced Analytics</h3>
          <p>
            Deeper spending trends, income analysis,
            category breakdowns and performance tracking.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">📷</div>
          <h3>Smart Receipt OCR</h3>
          <p>
            Connect an OCR service to extract merchant,
            amount and date from receipts.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">▰</div>
          <h3>Advanced Loan Manager</h3>
          <p>
            Track multiple loans, EMI progress,
            remaining payments and repayment history.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">📄</div>
          <h3>Professional Reports</h3>
          <p>
            Export detailed finance reports and
            printable summaries.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">☁</div>
          <h3>Cloud Sync</h3>
          <p>
            Future backend integration can synchronise
            data between multiple devices.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">🤖</div>
          <h3>AI Money Insights</h3>
          <p>
            Future AI integration can analyse spending
            patterns and generate personalised summaries.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">💾</div>
          <h3>Advanced Backup</h3>
          <p>
            Structured backup and restore for your
            complete finance workspace.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">🌍</div>
          <h3>Multi Currency</h3>
          <p>
            Switch between supported currencies from
            the settings panel.
          </p>
        </div>

        <div class="pro-card">
          <div class="pro-icon">🎯</div>
          <h3>Smart Goals</h3>
          <p>
            Track savings targets and monitor progress
            toward financial goals.
          </p>
        </div>

      </div>

    </section>
  `;
}

function showPremium() {
  openModal(`
    <button class="modal-close"
      onclick="closeModalDirect()">×</button>

    <div class="premium-hero">

      <div class="big-symbol">✦</div>

      <h2>FINANCE PRO</h2>

      <p>
        Advanced tools for serious money management.
      </p>

      <h1 style="margin:20px 0;color:var(--purple)">
        ₹99
        <small>/ month</small>
      </h1>

      <div class="pro-plan">
        <h3>Monthly Plan</h3>

        <strong style="font-size:25px">
          ₹99/month
        </strong>

        <p>
          Flexible monthly access.
        </p>
      </div>

      <br>

      <div class="pro-plan">
        <h3>Yearly Plan</h3>

        <strong style="font-size:25px">
          ₹1,169/year
        </strong>

        <p>
          Full-year Finance Pro access.
        </p>
      </div>

      <ul class="feature-list">
        <li>Advanced analytics</li>
        <li>Advanced loan management</li>
        <li>Unlimited savings goals</li>
        <li>Enhanced reports</li>
        <li>Cloud synchronisation</li>
        <li>AI-powered insights</li>
        <li>Automatic receipt OCR integration</li>
        <li>Multi-device access</li>
        <li>Advanced backup tools</li>
      </ul>

      <div class="insight">
        <strong>Payment integration:</strong>
        This browser version does not pretend to process real
        payments. For an actual Google Play release, connect
        Google Play Billing or another supported payment system.
      </div>

      <button class="secondary-btn"
        style="width:100%"
        onclick="closeModalDirect()">
        Continue with free version
      </button>

    </div>
  `);
}

/* =========================================================
   BACKUP
   ========================================================= */

function renderBackup() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Backup and restore</h3>
          <p>Keep a copy of your financial records</p>
        </div>
      </div>

      <div class="report-grid">

        <div class="report-option">
          <h3>Export backup</h3>

          <p>
            Download wallets, transactions, goals,
            budgets, loans and settings as JSON.
          </p>

          <button class="primary-btn"
            onclick="exportBackup()">
            Download backup
          </button>
        </div>

        <div class="report-option">
          <h3>Restore backup</h3>

          <p>
            Import a previous Finance Manager backup.
          </p>

          <input type="file"
            accept=".json,application/json"
            onchange="restoreBackup(event)">
        </div>

        <div class="report-option">
          <h3>Local data</h3>

          <p>
            Your data is stored in this browser using
            localStorage.
          </p>

          <span class="badge">OFFLINE MODE</span>
        </div>

        <div class="report-option">
          <h3>Danger zone</h3>

          <p>
            Delete all locally stored financial data.
          </p>

          <button class="danger-btn"
            onclick="clearAllData()">
            Erase all data
          </button>
        </div>

      </div>

    </section>
  `;
}

function exportBackup() {
  downloadFile(
    "finance-manager-backup.json",
    JSON.stringify(data,null,2),
    "application/json"
  );

  showToast("Backup downloaded.");
}

function restoreBackup(event) {
  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = function() {
    try {
      const imported =
        JSON.parse(reader.result);

      if (!imported.wallets ||
          !imported.transactions) {
        throw new Error("Invalid backup");
      }

      data = {
        ...structuredClone(defaultData),
        ...imported,
        loans: imported.loans || []
      };

      saveData();

      showToast("Backup restored.");
      render();

    } catch {
      showToast(
        "Invalid backup file.",
        "error"
      );
    }
  };

  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm(
    "This will permanently erase all local app data. Continue?"
  )) return;

  localStorage.removeItem(STORAGE_KEY);

  data = structuredClone(defaultData);

  saveData();

  showToast("All data erased.");
  render();
}

function downloadFile(filename,content,type) {
  const blob =
    new Blob([content],{type});

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  link.click();

  URL.revokeObjectURL(url);
}

/* =========================================================
   SETTINGS
   ========================================================= */

function renderSettings() {
  return `
    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Application settings</h3>
          <p>Personalise your finance workspace</p>
        </div>
      </div>

      <div class="settings-row">

        <div>
          <h4>Profile name</h4>
          <p>
            Displayed as your finance workspace name.
          </p>
        </div>

        <div class="settings-control">
          <input id="profile-name"
            value="${escapeHTML(data.profile.name)}">
        </div>

      </div>

      <div class="settings-row">

        <div>
          <h4>Currency</h4>
          <p>Used for displaying amounts.</p>
        </div>

        <div class="settings-control">

          <select id="profile-currency">
            ${Object.keys(currencySymbols).map(currency =>
              `<option
                value="${currency}"
                ${data.profile.currency === currency ? "selected":""}>
                ${currency}
              </option>`
            ).join("")}
          </select>

        </div>

      </div>

      <div class="settings-row">

        <div>
          <h4>Theme</h4>
          <p>Switch appearance.</p>
        </div>

        <div class="settings-control">

          <select id="profile-theme">
            <option value="dark"
              ${data.profile.theme === "dark" ? "selected":""}>
              Dark
            </option>

            <option value="light"
              ${data.profile.theme === "light" ? "selected":""}>
              Light
            </option>
          </select>

        </div>

      </div>

      <div class="settings-row">

        <div>
          <h4>Monthly income target</h4>
          <p>Optional monthly income target.</p>
        </div>

        <div class="settings-control">

          <input id="income-target"
            type="number"
            value="${data.settings.monthlyIncomeTarget}">

        </div>

      </div>

      <div class="settings-row">

        <div>
          <h4>Save changes</h4>
          <p>Apply your preferences.</p>
        </div>

        <button class="primary-btn"
          onclick="saveSettings()">
          Save settings
        </button>

      </div>

    </section>

    <section class="panel">

      <div class="panel-header">
        <div>
          <h3>Feature status</h3>
          <p>Finance Manager capabilities</p>
        </div>
      </div>

      <div class="insight">
        <strong>Available:</strong>
        Offline transactions, wallets, budgets,
        goals, loans, EMI tracking, recurring payments,
        reports, charts and backup/restore.
      </div>

      <div class="insight">
        <strong>Integration required:</strong>
        Real bank connections, secure cloud accounts,
        automatic OCR, AI services, Google Play Billing,
        biometric security and multi-device synchronisation.
      </div>

    </section>
  `;
}

function saveSettings() {
  data.profile.name =
    document.getElementById("profile-name")
      .value.trim() || "My Finance";

  data.profile.currency =
    document.getElementById("profile-currency").value;

  data.profile.theme =
    document.getElementById("profile-theme").value;

  data.settings.monthlyIncomeTarget =
    numberValue(
      document.getElementById("income-target").value
    );

  saveData();

  showToast("Settings saved.");
  render();
}

/* =========================================================
   START
   ========================================================= */

setupNavigation();
render();
