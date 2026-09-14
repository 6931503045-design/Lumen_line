const mock = window.mockData || {
  summary: { balance: 0, income: 0, expense: 0, safeToSpend: 0, progress: 0, confidence: 'high', safeToSpendConfidence: 'high', monthlyBudgetLimit: 300000, monthlyBudgetUsed: 185000 },
  transactions: [],
  categories: [],
  plans: [],
  donutData: { labels: [], values: [], colors: [] },
  lineData: { labels: [], income: [], expense: [] },
};

const transactionState = {
  activeTab: 'all',
  searchValue: '',
  selectedDates: [],
  multiSelect: false,
  selectedIds: [],
};

const categoryState = {
  activeTab: 'all',
  sortMode: false,
};

const pageState = {
  planWizard: { step: 1, name: '', amount: '', months: '', mode: 'balanced' },
};

function safeNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  const numericValue = Number(value || 0) / 100;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(numericValue);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

// 🔴 แก้บั๊ก: เดิมเอา clamp() ไปแสดงผลตรงๆ ทำให้เห็น "61.66666666666667%" บนการ์ดงบประมาณ
// clamp ยังคืนทศนิยมเหมือนเดิม (ใช้กับ width ของแถบ progress ที่ต้องการความละเอียด)
// ส่วนการแสดงผลเป็นตัวเลขให้คนอ่านใช้ตัวนี้แทน
function formatPercent(value) {
  return Math.round(clamp(value));
}

function getProgressTone(value) {
  const percent = clamp(value);
  if (percent > 100) return 'danger';
  if (percent >= 80) return 'warning';
  return 'success';
}

function getConfidenceMeta(level) {
  const map = {
    low: { label: 'ประเมินเบื้องต้น', icon: '🔴', className: 'low' },
    medium: { label: 'ความมั่นใจปานกลาง', icon: '🟡', className: 'medium' },
    high: { label: 'ความมั่นใจสูง', icon: '🟢', className: 'high' },
  };
  return map[level] || map.high;
}

function renderConfidenceBadge(level) {
  const meta = getConfidenceMeta(level);
  return `<span class="confidence-badge ${meta.className}">${meta.icon} ${meta.label}</span>`;
}

function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  if (window.__moneyBotCharts && window.__moneyBotCharts[canvasId]) {
    window.__moneyBotCharts[canvasId].destroy();
  }

  if (!window.__moneyBotCharts) {
    window.__moneyBotCharts = {};
  }

  window.__moneyBotCharts[canvasId] = new Chart(canvas, config);
}

function renderMonthlyBudgetSummary() {
  const container = document.getElementById('monthlyBudgetSummary');
  if (!container) return;

  // ยังไม่ได้ตั้งงบ (หรือ backend ยังไม่มี budget.service) — บอกตรงๆ ดีกว่าโชว์ 0%
  // ซึ่งผู้ใช้จะอ่านว่า "ฉันตั้งงบไว้ 0 บาท"
  if (mock.summary.monthlyBudgetLimit == null) {
    container.innerHTML = `
      <div class="budget-summary-head">
        <h3>งบประมาณรายเดือน</h3>
      </div>
      <p class="empty-note">ยังไม่ได้ตั้งงบประมาณ</p>
    `;
    return;
  }

  const limit = safeNumber(mock.summary.monthlyBudgetLimit);
  const used = safeNumber(mock.summary.monthlyBudgetUsed);
  const percent = limit > 0 ? (used / limit) * 100 : 0;
  const toneClass = getProgressTone(percent);

  container.innerHTML = `
    <div class="budget-summary-head">
      <h3>งบประมาณรายเดือน</h3>
      <span>${formatPercent(percent)}%</span>
    </div>
    <div class="budget-row">
      <strong>${formatMoney(used)}</strong>
      <span>จาก ${formatMoney(limit)}</span>
    </div>
    <div class="progress-bar budget-progress ${toneClass}"><span style="width: ${clamp(percent)}%"></span></div>
  `;
}

function renderDashboard() {
  const summary = mock.summary;
  const confidenceBadgeWrap = document.getElementById('confidenceBadgeWrap');
  const netBalance = document.getElementById('netBalance');
  const incomeAmount = document.getElementById('incomeAmount');
  const expenseAmount = document.getElementById('expenseAmount');
  const safeToSpend = document.getElementById('safeToSpend');
  const confidenceScore = document.getElementById('confidenceScore');
  const goalCards = document.getElementById('goalCards');
  const transactionList = document.getElementById('transactionList');

  renderMonthlyBudgetSummary();

  // ไม่มีค่าความมั่นใจ = ยังคำนวณไม่ได้ ซ่อนป้ายไปเลยดีกว่าแปะ "ความมั่นใจสูง" ที่ไม่มีที่มา
  if (confidenceBadgeWrap) {
    confidenceBadgeWrap.innerHTML = summary.confidence ? renderConfidenceBadge(summary.confidence) : '';
  }

  if (netBalance) netBalance.textContent = formatMoney(summary.balance);
  if (incomeAmount) incomeAmount.textContent = formatMoney(summary.income);
  if (expenseAmount) expenseAmount.textContent = formatMoney(summary.expense);
  if (safeToSpend) {
    safeToSpend.textContent = summary.safeToSpend == null ? '—' : formatMoney(summary.safeToSpend);
  }
  if (confidenceScore) {
    confidenceScore.textContent = summary.progress == null ? '—' : `${formatPercent(summary.progress)}%`;
  }

  if (transactionList) {
    transactionList.innerHTML = mock.transactions
      .slice(0, 4)
      .map((item) => {
        const amount = Number(item.amount || 0);
        const sign = amount >= 0 ? '+' : '-';
        const icon = item.type === 'income' ? '💰' : '🧾';
        const displayAmount = formatMoney(Math.abs(amount));
        const aiBadge = item.parsedBy === 'ai' ? '<span class="ai-tag">✨ AI</span>' : '';

        return `
          <li class="transaction-item">
            <div class="transaction-left">
              <div class="transaction-icon">${icon}</div>
              <div class="transaction-text">
                <strong>${item.title}${aiBadge}</strong>
                <small>${item.category} • ${item.time}</small>
              </div>
            </div>
            <span class="amount ${item.type}">${sign}${displayAmount}</span>
          </li>
        `;
      })
      .join('');
  }

  if (goalCards && mock.plans.length === 0) {
    goalCards.innerHTML = '<p class="empty-note">ยังไม่มีแผนออม</p>';
  } else if (goalCards) {
    goalCards.innerHTML = mock.plans
      .map((plan) => {
        const statusText = plan.status === 'off_track' ? '⚠️ หลุดเป้า' : plan.status === 'completed' ? '🎉 ครบเป้าแล้ว' : 'ปกติ';

        return `
          <div class="goal-card">
            <div class="goal-header">
              <strong>${plan.name}</strong>
              <span class="confidence-badge ${getConfidenceMeta(plan.confidence || 'high').className}">${getConfidenceMeta(plan.confidence || 'high').icon} ${getConfidenceMeta(plan.confidence || 'high').label}</span>
            </div>
            <div class="progress-bar"><span style="width: ${clamp(plan.progress)}%"></span></div>
            <div class="card-row">
              <span>${statusText}</span>
              <strong>${formatMoney(plan.saved)} / ${formatMoney(plan.target)}</strong>
            </div>
          </div>
        `;
      })
      .join('');
  }

  if (document.getElementById('spendingDonut')) {
    createChart('spendingDonut', {
      type: 'doughnut',
      data: {
        labels: mock.donutData.labels,
        datasets: [{
          data: mock.donutData.values,
          backgroundColor: mock.donutData.colors,
          borderWidth: 0,
          cutout: '62%',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: getComputedStyle(document.body).getPropertyValue('--text').trim(),
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${context.parsed}%`;
              },
            },
          },
        },
      },
    });
  }

  if (document.getElementById('cashTrend')) {
    createChart('cashTrend', {
      type: 'line',
      data: {
        labels: mock.lineData.labels,
        datasets: [
          {
            label: 'รายรับ',
            data: mock.lineData.income,
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.18)',
            tension: 0.35,
            fill: false,
            borderWidth: 3,
          },
          {
            label: 'รายจ่าย',
            data: mock.lineData.expense,
            borderColor: '#f472b6',
            backgroundColor: 'rgba(244, 114, 182, 0.18)',
            tension: 0.35,
            fill: false,
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: getComputedStyle(document.body).getPropertyValue('--text').trim(),
            },
          },
        },
        scales: {
          x: {
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--muted').trim() },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            ticks: {
              color: getComputedStyle(document.body).getPropertyValue('--muted').trim(),
              callback(value) {
                return `฿${Number(value) / 1000}k`;
              },
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });
  }
}

function getSelectedDateLabel(dateKey) {
  if (!dateKey) return 'เลือกวันที่';
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(date);
}

function buildDatePickerModal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [];

  for (let i = 0; i < firstDay; i += 1) {
    cells.push('<div class="calendar-empty"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const active = transactionState.selectedDates.includes(value) ? 'selected' : '';
    cells.push(`<button type="button" class="calendar-day ${active}" data-date-value="${value}">${day}</button>`);
  }

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>เลือกวันที่</h3>
        <button class="close-btn" type="button" data-close-modal="true">✕</button>
      </div>
      <div class="calendar-grid">${cells.join('')}</div>
      <div class="modal-actions">
        <button class="secondary-btn" type="button" data-clear-dates="true">ล้าง</button>
        <button class="primary-btn" type="button" data-apply-dates="true">ใช้วันที่ที่เลือก</button>
      </div>
    </div>
  `;

  openModal(html);

  document.querySelectorAll('[data-date-value]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.dateValue;
      if (transactionState.selectedDates.includes(value)) {
        transactionState.selectedDates = transactionState.selectedDates.filter((date) => date !== value);
      } else {
        transactionState.selectedDates.push(value);
      }
      buildDatePickerModal();
    });
  });

  const clearBtn = document.querySelector('[data-clear-dates]');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      transactionState.selectedDates = [];
      closeModal();
      renderTransactionsPage();
    });
  }

  const applyBtn = document.querySelector('[data-apply-dates]');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      closeModal();
      renderTransactionsPage();
    });
  }
}

function renderTransactionsPage() {
  const incomeSummary = document.getElementById('incomeSummary');
  const expenseSummary = document.getElementById('expenseSummary');
  const transactionTable = document.getElementById('transactionTable');
  const searchInput = document.getElementById('transactionSearch');
  const selectedDateChips = document.getElementById('selectedDateChips');
  const multiSelectBtn = document.getElementById('toggleMultiSelectBtn');
  const batchActionBar = document.getElementById('batchActionBar');

  if (incomeSummary) incomeSummary.textContent = formatMoney(mock.summary.income);
  if (expenseSummary) expenseSummary.textContent = formatMoney(mock.summary.expense);

  if (searchInput) {
    searchInput.value = transactionState.searchValue;
  }

  if (multiSelectBtn) {
    multiSelectBtn.textContent = transactionState.multiSelect ? 'ยกเลิกโหมดเลือก' : 'เลือกหลายรายการ';
  }

  if (selectedDateChips) {
    if (transactionState.selectedDates.length === 0) {
      selectedDateChips.innerHTML = '';
    } else {
      selectedDateChips.innerHTML = transactionState.selectedDates.map((dateKey) => `
        <span class="date-chip">
          ${getSelectedDateLabel(dateKey)}
          <button type="button" data-remove-date="${dateKey}">×</button>
        </span>
      `).join('');
    }
  }

  if (transactionTable) {
    const filtered = mock.transactions.filter((item) => {
      const matchesTab = transactionState.activeTab === 'all' || item.type === transactionState.activeTab;
      const matchesSearch = !transactionState.searchValue || `${item.title} ${item.category}`.toLowerCase().includes(transactionState.searchValue.toLowerCase());
      const matchesDate = transactionState.selectedDates.length === 0 || Boolean(item.dateKey && transactionState.selectedDates.includes(item.dateKey));
      return matchesTab && matchesSearch && matchesDate;
    });

    const grouped = filtered.reduce((acc, item) => {
      const key = item.date || 'อื่น ๆ';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const html = Object.entries(grouped)
      .map(([groupName, items]) => `
        <div class="date-group">
          <div class="date-group-header">${groupName}</div>
          ${items.map((item) => {
            const amount = Number(item.amount || 0);
            const sign = amount >= 0 ? '+' : '-';
            const icon = item.type === 'income' ? '💰' : '🧾';
            const aiBadge = item.parsedBy === 'ai' ? '<span class="ai-tag">✨ AI</span>' : '';
            const displayAmount = formatMoney(Math.abs(amount));
            const selectedClass = transactionState.selectedIds.includes(item.id) ? 'row-selected' : '';
            const checkbox = transactionState.multiSelect ? `<input type="checkbox" class="row-check" data-row-check="${item.id}" ${transactionState.selectedIds.includes(item.id) ? 'checked' : ''} />` : '';

            return `
              <div class="transaction-row ${selectedClass}">
                ${checkbox}
                <div class="transaction-icon">${icon}</div>
                <div class="transaction-text">
                  <strong>${item.title}${aiBadge}</strong>
                  <small>${item.category} • ${item.time}</small>
                </div>
                <div class="transaction-actions">
                  <span class="amount ${item.type}">${sign}${displayAmount}</span>
                  <button class="row-more" type="button" data-transaction-menu="${item.id}">⋮</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `)
      .join('');

    transactionTable.innerHTML = html || '<div class="empty-state">ไม่พบรายการตามเงื่อนไข</div>';
  }

  if (batchActionBar) {
    if (transactionState.selectedIds.length === 0) {
      batchActionBar.classList.add('hidden');
      batchActionBar.innerHTML = '';
    } else {
      batchActionBar.classList.remove('hidden');
      batchActionBar.innerHTML = `
        <div class="batch-actions">
          <button type="button" data-batch-action="select-all">เลือกทั้งหมด</button>
          <button type="button" data-batch-action="set-category">เปลี่ยนหมวดหมู่</button>
          <button type="button" data-batch-action="set-type">เปลี่ยนประเภท</button>
          <button type="button" data-batch-action="delete">ลบทั้งหมด</button>
        </div>
      `;
    }
  }
}

function renderCategoriesPage() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;

  const filtered = mock.categories
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .filter((item) => categoryState.activeTab === 'all' || item.type === categoryState.activeTab);

  categoryList.innerHTML = filtered
    .map((item) => `
      <div class="category-item-box" draggable="${categoryState.sortMode ? 'true' : 'false'}" data-category-row="${item.id}" data-category-id="${item.id}">
        <div class="category-top">
          <div class="category-name">
            ${categoryState.sortMode ? '<span class="drag-handle">☰</span>' : ''}
            <span class="category-badge">${item.icon}</span>
            <span>${item.name}</span>
          </div>
          <span class="pill ${item.type === 'income' ? 'success' : 'warning'}">${Math.round(((item.used || 0) / (item.limit || 1)) * 100)}%</span>
        </div>
        <div class="progress-bar"><span style="width: ${clamp(((item.used || 0) / (item.limit || 1)) * 100)}%"></span></div>
        <div class="card-row">
          <span>ใช้ไปแล้ว</span>
          <strong>${formatMoney(item.used)}</strong>
        </div>
        <div class="category-actions-row">
          <button type="button" class="secondary-btn small" data-category-set-limit="${item.id}">ตั้งงบ</button>
          <label class="essential-toggle">
            <span>หมวดจำเป็น</span>
            <input type="checkbox" data-category-id="${item.id}" ${item.isEssential ? 'checked' : ''} />
          </label>
        </div>
      </div>
    `)
    .join('');

  if (categoryState.sortMode) {
    document.querySelectorAll('[data-category-row]').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', card.dataset.categoryRow);
      });

      card.addEventListener('dragover', (event) => {
        event.preventDefault();
      });

      card.addEventListener('drop', (event) => {
        event.preventDefault();
        const draggedId = Number(event.dataTransfer.getData('text/plain'));
        const targetId = Number(card.dataset.categoryRow);
        reorderCategories(draggedId, targetId);
      });
    });
  }
}

function renderPlanCards() {
  const planCards = document.getElementById('planCards');
  if (!planCards) return;

  planCards.innerHTML = mock.plans
    .filter((plan) => plan.active !== false)
    .map((plan) => {
      const badge = getConfidenceMeta(plan.confidence || 'high');
      const statusBadge = plan.status === 'off_track'
        ? '<span class="pill warning">⚠️ หลุดเป้า</span>'
        : plan.status === 'completed'
          ? '<span class="pill success">🎉 ครบเป้าแล้ว</span>'
          : '<span class="pill success">ปกติ</span>';

      return `
        <div class="goal-card">
          <div class="goal-header">
            <strong>${plan.name}</strong>
            <div class="plan-menu-wrap">
              <span class="confidence-badge ${badge.className}">${badge.icon} ${badge.label}</span>
              <button class="row-more plan-more" type="button" data-plan-menu="${plan.id}">⋮</button>
            </div>
          </div>
          <div class="progress-bar"><span style="width: ${clamp(plan.progress || 0)}%"></span></div>
          <div class="card-row">
            <span>${formatMoney(plan.saved)} / ${formatMoney(plan.target)}</span>
            <strong>${plan.dueMonth}</strong>
          </div>
          <div class="plan-actions-row">
            ${statusBadge}
            <button class="secondary-btn small" type="button" data-plan-transfer="${plan.id}">โอนเข้าแผนนี้</button>
          </div>
        </div>
      `;
    }).join('');
}

function renderAnalyzePage() {
  if (document.getElementById('spendingDonutAnalyze')) {
    createChart('spendingDonutAnalyze', {
      type: 'doughnut',
      data: {
        labels: mock.donutData.labels,
        datasets: [{
          data: mock.donutData.values,
          backgroundColor: mock.donutData.colors,
          borderWidth: 0,
          cutout: '60%',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: getComputedStyle(document.body).getPropertyValue('--text').trim(),
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
        },
      },
    });
  }

  const emptyStateAnalyze = document.getElementById('emptyStateAnalyze');
  if (emptyStateAnalyze && mock.summary.daysOfData < 7) {
    emptyStateAnalyze.hidden = false;
  }

  if (document.getElementById('reportChart')) {
    const budgetLine = new Array(mock.lineData.labels.length).fill(300000);
    createChart('reportChart', {
      type: 'bar',
      data: {
        labels: mock.lineData.labels,
        datasets: [
          {
            label: 'รายรับ',
            data: mock.lineData.income,
            backgroundColor: 'rgba(52, 211, 153, 0.8)',
            borderRadius: 8,
          },
          {
            label: 'รายจ่าย',
            data: mock.lineData.expense,
            backgroundColor: 'rgba(244, 114, 182, 0.8)',
            borderRadius: 8,
          },
          {
            type: 'line',
            label: 'งบประมาณ',
            data: budgetLine,
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167, 139, 250, 0.3)',
            borderDash: [6, 6],
            tension: 0.1,
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: getComputedStyle(document.body).getPropertyValue('--text').trim(),
            },
          },
        },
        scales: {
          x: {
            ticks: { color: getComputedStyle(document.body).getPropertyValue('--muted').trim() },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: getComputedStyle(document.body).getPropertyValue('--muted').trim(),
              callback(value) {
                return `฿${Number(value) / 1000}k`;
              },
            },
            grid: { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });
  }

  const badgeWrap = document.getElementById('safeToSpendBadgeWrap');
  if (badgeWrap) {
    badgeWrap.innerHTML = renderConfidenceBadge(mock.summary.safeToSpendConfidence || 'high');
  }

  renderPlanCards();

  const priceInput = document.getElementById('purchasePrice');
  const buyNowResult = document.getElementById('buyNowResult');
  const saveLaterResult = document.getElementById('saveLaterResult');
  const simulatePurchaseBtn = document.getElementById('simulatePurchaseBtn');

  if (simulatePurchaseBtn && priceInput) {
    const updateSimulation = () => {
      const value = Number(priceInput.value || 0);
      if (buyNowResult) buyNowResult.textContent = formatMoney(value);
      if (saveLaterResult) saveLaterResult.textContent = formatMoney(value * 0.6);
    };
    simulatePurchaseBtn.addEventListener('click', updateSimulation);
    priceInput.addEventListener('input', updateSimulation);
    updateSimulation();
  }

  const createPlanBtn = document.getElementById('createPlanBtn');
  if (createPlanBtn) {
    createPlanBtn.addEventListener('click', () => {
      openPlanWizard();
    });
  }
}

function openPlanWizard() {
  const wizardState = pageState.planWizard;
  wizardState.step = 1;
  wizardState.name = '';
  wizardState.amount = '150000';
  wizardState.months = '6';
  wizardState.mode = 'balanced';

  const html = `
    <div class="modal-card wide">
      <div class="modal-head">
        <h3>สร้างแผนออม</h3>
        <button class="close-btn" type="button" data-close-modal="true">✕</button>
      </div>
      <div class="wizard-step-indicator">
        <span class="wizard-step ${wizardState.step === 1 ? 'active' : ''}">1</span>
        <span class="wizard-step ${wizardState.step === 2 ? 'active' : ''}">2</span>
        <span class="wizard-step ${wizardState.step === 3 ? 'active' : ''}">3</span>
      </div>
      <div id="planWizardBody"></div>
    </div>
  `;

  openModal(html);
  renderPlanWizardStep();
}

function renderPlanWizardStep() {
  const body = document.getElementById('planWizardBody');
  if (!body) return;
  const state = pageState.planWizard;

  if (state.step === 1) {
    body.innerHTML = `
      <div class="form-grid">
        <label class="form-field">
          <span>ชื่อแผน</span>
          <input id="planNameInput" value="${state.name || 'ออมซื้อไอเทม'}" />
        </label>
        <label class="form-field">
          <span>เป้าหมาย</span>
          <input id="planAmountInput" type="number" value="${state.amount}" />
        </label>
        <label class="form-field">
          <span>ระยะเวลา (เดือน)</span>
          <input id="planMonthsInput" type="number" value="${state.months}" min="1" />
        </label>
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-plan-next="1">ต่อไป</button>
      </div>
    `;
  }

  if (state.step === 2) {
    const planStrategies = [
      { key: 'fast', label: '⚡ เร็ว', hint: 'ต้นทุนสูง', save: safeNumber(state.amount) * 0.18 },
      { key: 'balanced', label: '⚖️ สมดุล', hint: 'ปลอดภัย', save: safeNumber(state.amount) * 0.12 },
      { key: 'relaxed', label: '🌿 สบาย', hint: 'ผ่อนคลาย', save: safeNumber(state.amount) * 0.08 },
    ];

    body.innerHTML = `
      <div class="strategy-grid">
        ${planStrategies.map((strategy) => `
          <button type="button" class="strategy-card ${state.mode === strategy.key ? 'selected' : ''}" data-plan-strategy="${strategy.key}">
            <strong>${strategy.label}</strong>
            <small>${strategy.hint}</small>
            <span>${formatMoney(strategy.save)}</span>
          </button>
        `).join('')}
      </div>
      <div class="modal-actions split">
        <button class="secondary-btn" type="button" data-plan-back="1">ย้อนกลับ</button>
        <button class="primary-btn" type="button" data-plan-next="2">ต่อไป</button>
      </div>
    `;
  }

  if (state.step === 3) {
    const target = safeNumber(state.amount);
    const monthly = Math.round(target / safeNumber(state.months || 1));
    const save = state.mode === 'fast' ? target * 0.18 : state.mode === 'balanced' ? target * 0.12 : target * 0.08;
    body.innerHTML = `
      <div class="plan-summary-card">
        <h4>${(document.getElementById('planNameInput')?.value || 'ออมซื้อไอเทม')}</h4>
        <div class="summary-row"><span>เป้าหมาย</span><strong>${formatMoney(target)}</strong></div>
        <div class="summary-row"><span>ต่อเดือน</span><strong>${formatMoney(Math.round(monthly))}</strong></div>
        <div class="summary-row"><span>รูปแบบ</span><strong>${state.mode === 'fast' ? '⚡ เร็ว' : state.mode === 'balanced' ? '⚖️ สมดุล' : '🌿 สบาย'}</strong></div>
        <div class="summary-row"><span>คาดการณ์ออม</span><strong>${formatMoney(Math.round(save))}</strong></div>
      </div>
      <div class="modal-actions split">
        <button class="secondary-btn" type="button" data-plan-back="2">ย้อนกลับ</button>
        <button class="primary-btn" type="button" data-plan-confirm="true">ยืนยันแผนนี้</button>
      </div>
    `;
  }
}

function addPlanFromWizard() {
  const state = pageState.planWizard;
  const name = document.getElementById('planNameInput')?.value || 'แผนออมใหม่';
  const target = safeNumber(document.getElementById('planAmountInput')?.value || state.amount || 0);
  const months = safeNumber(document.getElementById('planMonthsInput')?.value || state.months || 1);
  const monthlySave = Math.max(1000, Math.round(target / Math.max(months, 1)));
  const nextPlan = {
    id: Date.now(),
    name,
    target,
    saved: 0,
    progress: 0,
    confidence: 'medium',
    status: 'normal',
    dueMonth: `ภายใน ${months} เดือน`,
    monthly_save: monthlySave,
    active: true,
  };

  mock.plans.push(nextPlan);
  closeModal();
  renderAnalyzePage();
  showSuccessModal('สร้างแผนสำเร็จ');
}

function setupThemeToggle() {
  const toggleButton = document.querySelector('.theme-toggle');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const root = document.body;

  const setTheme = (nextTheme) => {
    root.dataset.theme = nextTheme;
    localStorage.setItem('moneybot-theme', nextTheme);
    if (toggleButton) {
      toggleButton.textContent = nextTheme === 'dark' ? '☀️' : '🌙';
    }
    if (darkModeToggle) {
      darkModeToggle.checked = nextTheme === 'dark';
    }
  };

  const savedTheme = localStorage.getItem('moneybot-theme') || root.dataset.theme || 'dark';
  setTheme(savedTheme);

  if (toggleButton) {
    toggleButton.addEventListener('click', () => {
      const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', (event) => {
      setTheme(event.target.checked ? 'dark' : 'light');
    });
  }
}

function openModal(html) {
  const current = document.querySelector('.global-modal');
  if (current) current.remove();

  const modal = document.createElement('div');
  modal.className = 'global-modal';
  modal.innerHTML = html;
  document.body.appendChild(modal);

  document.body.classList.add('modal-open');

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close-modal]')) {
      closeModal();
    }
  });
}

function closeModal() {
  document.querySelector('.global-modal')?.remove();
  document.body.classList.remove('modal-open');
}

function showSuccessModal(message) {
  const html = `
    <div class="modal-card success-modal">
      <div class="success-icon">✓</div>
      <h3>สำเร็จ</h3>
      <p>${message}</p>
      <div class="modal-actions split">
        <button class="secondary-btn" type="button" data-close-modal="true">ปิด</button>
        <button class="primary-btn" type="button" data-close-modal="true">ตกลง</button>
      </div>
    </div>
  `;
  openModal(html);
}

function buildKeypadInput(amountValue = 0, onComplete) {
  const keypads = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['00', '0', '⌫'],
  ];

  let currentAmount = safeNumber(amountValue);
  const inputId = `keypadAmount_${Date.now()}`;
  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>กรอกจำนวนเงิน</h3>
        <button class="close-btn" type="button" data-close-modal="true">✕</button>
      </div>
      <div class="keypad-display">
        <span>จำนวน</span>
        <strong id="${inputId}">${formatMoney(currentAmount)}</strong>
      </div>
      <div class="keypad">
        ${keypads.flat().map((key) => `<button type="button" class="keypad-key" data-keypad-value="${key}">${key}</button>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-keypad-confirm="true">ยืนยัน</button>
      </div>
    </div>
  `;

  openModal(html);
  const display = document.getElementById(inputId);
  const confirmBtn = document.querySelector('[data-keypad-confirm]');

  document.querySelectorAll('.keypad-key').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.keypadValue;
      if (value === '⌫') {
        currentAmount = Math.floor(currentAmount / 10);
      } else if (value === '00') {
        currentAmount = Number(String(currentAmount) + '00');
      } else {
        currentAmount = Number(String(currentAmount) + value);
      }
      if (display) display.textContent = formatMoney(currentAmount);
    });
  });

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      onComplete(currentAmount);
      closeModal();
    });
  }
}

function openAddTransactionModal() {
  const formId = `add-transaction-${Date.now()}`;
  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>เพิ่มรายการใหม่</h3>
        <button class="close-btn" type="button" data-close-modal="true">✕</button>
      </div>
      <div class="form-grid">
        <label class="form-field floating">
          <span>ชื่อรายการ</span>
          <input id="newTxnTitle" value="" placeholder="เช่น ค่าบริการ" />
        </label>
        <label class="form-field floating">
          <span>หมวดหมู่</span>
          <select id="newTxnCategory">
            ${mock.categories.map((item) => `<option value="${item.name}">${item.name}</option>`).join('')}
          </select>
        </label>
        <div class="segmented-control">
          <button type="button" class="segmented active" data-new-transaction-type="expense">รายจ่าย</button>
          <button type="button" class="segmented" data-new-transaction-type="income">รายรับ</button>
        </div>
        <label class="form-field floating">
          <span>วันที่</span>
          <input id="newTxnDate" type="date" value="${new Date().toISOString().slice(0, 10)}" />
        </label>
        <label class="form-field floating">
          <span>เวลา</span>
          <input id="newTxnTime" type="time" value="09:00" />
        </label>
      </div>
      <div class="keypad-display compact">
        <span>จำนวน</span>
        <strong id="newTxnAmountPreview">฿0.00</strong>
      </div>
      <div class="keypad small-grid">
        ${['7','8','9','4','5','6','1','2','3','00','0','⌫'].map((key) => `<button type="button" class="keypad-key" data-keypad-new="${key}">${key}</button>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-save-transaction="true">บันทึก</button>
      </div>
    </div>
  `;
  openModal(html);

  let amountValue = 0;
  const amountPreview = document.getElementById('newTxnAmountPreview');
  const updatePreview = () => { if (amountPreview) amountPreview.textContent = formatMoney(amountValue); };
  updatePreview();

  document.querySelectorAll('[data-keypad-new]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.keypadNew;
      if (value === '⌫') {
        amountValue = Math.floor(amountValue / 10);
      } else if (value === '00') {
        amountValue = Number(String(amountValue) + '00');
      } else {
        amountValue = Number(String(amountValue) + value);
      }
      updatePreview();
    });
  });

  document.querySelectorAll('[data-new-transaction-type]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-new-transaction-type]').forEach((btn) => btn.classList.toggle('active', btn === button));
    });
  });

  const saveButton = document.querySelector('[data-save-transaction]');
  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const title = document.getElementById('newTxnTitle')?.value || 'รายการใหม่';
      const category = document.getElementById('newTxnCategory')?.value || 'อื่น ๆ';
      const type = document.querySelector('[data-new-transaction-type].active')?.dataset.newTransactionType || 'expense';
      const date = document.getElementById('newTxnDate')?.value || new Date().toISOString().slice(0, 10);
      const time = document.getElementById('newTxnTime')?.value || '09:00';
      const sign = type === 'income' ? 1 : -1;
      const nextAmount = amountValue * sign;
      mock.transactions.unshift({
        id: Date.now(),
        title,
        amount: nextAmount,
        type,
        category,
        time,
        date: date === new Date().toISOString().slice(0, 10) ? 'วันนี้' : date,
        dateKey: date,
        parsedBy: 'manual',
      });
      closeModal();
      renderDashboard();
      renderTransactionsPage();
      showSuccessModal('เพิ่มรายการสำเร็จ');
    });
  }
}

function openTransactionActionMenu(transactionId) {
  const transaction = mock.transactions.find((item) => item.id === Number(transactionId));
  if (!transaction) return;

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>${transaction.title}</h3>
        <button class="close-btn" type="button" data-close-modal="true">✕</button>
      </div>
      <div class="settings-list">
        <button class="settings-row" type="button" data-edit-transaction="${transaction.id}"><span>แก้ไข</span><strong>›</strong></button>
        <button class="settings-row danger" type="button" data-delete-transaction="${transaction.id}"><span>ลบ</span><strong>›</strong></button>
      </div>
    </div>
  `;
  openModal(html);
}

function editTransaction(transactionId) {
  const transaction = mock.transactions.find((item) => item.id === Number(transactionId));
  if (!transaction) return;

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>แก้ไขรายการ</h3>
        <button class="close-btn" type="button" data-close-modal="true">✕</button>
      </div>
      <div class="form-grid">
        <label class="form-field floating">
          <span>ชื่อรายการ</span>
          <input id="editTxnTitle" value="${transaction.title}" />
        </label>
        <label class="form-field floating">
          <span>หมวดหมู่</span>
          <select id="editTxnCategory">
            ${mock.categories.map((item) => `<option value="${item.name}" ${item.name === transaction.category ? 'selected' : ''}>${item.name}</option>`).join('')}
          </select>
        </label>
        <div class="segmented-control">
          <button type="button" class="segmented ${transaction.type === 'expense' ? 'active' : ''}" data-edit-type="expense">รายจ่าย</button>
          <button type="button" class="segmented ${transaction.type === 'income' ? 'active' : ''}" data-edit-type="income">รายรับ</button>
        </div>
        <label class="form-field floating">
          <span>วันที่</span>
          <input id="editTxnDate" type="date" value="${transaction.dateKey || new Date().toISOString().slice(0, 10)}" />
        </label>
        <label class="form-field floating">
          <span>เวลา</span>
          <input id="editTxnTime" type="time" value="${transaction.time || '09:00'}" />
        </label>
      </div>
      <div class="keypad-display compact">
        <span>จำนวน</span>
        <strong id="editTxnAmountPreview">${formatMoney(Math.abs(transaction.amount))}</strong>
      </div>
      <div class="keypad small-grid">
        ${['7','8','9','4','5','6','1','2','3','00','0','⌫'].map((key) => `<button type="button" class="keypad-key" data-edit-keypad="${key}">${key}</button>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-update-transaction="${transaction.id}">บันทึก</button>
      </div>
    </div>
  `;
  openModal(html);

  let amountValue = Math.abs(transaction.amount);
  const updatePreview = () => {
    document.getElementById('editTxnAmountPreview').textContent = formatMoney(amountValue);
  };
  updatePreview();

  document.querySelectorAll('[data-edit-keypad]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.editKeypad;
      if (value === '⌫') {
        amountValue = Math.floor(amountValue / 10);
      } else if (value === '00') {
        amountValue = Number(String(amountValue) + '00');
      } else {
        amountValue = Number(String(amountValue) + value);
      }
      updatePreview();
    });
  });

  document.querySelectorAll('[data-edit-type]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-edit-type]').forEach((btn) => btn.classList.toggle('active', btn === button));
    });
  });

  const updateButton = document.querySelector('[data-update-transaction]');
  if (updateButton) {
    updateButton.addEventListener('click', () => {
      const nextItem = mock.transactions.find((item) => item.id === Number(transactionId));
      if (!nextItem) return;
      const selectedType = document.querySelector('[data-edit-type].active')?.dataset.editType || nextItem.type;
      const nextDate = document.getElementById('editTxnDate')?.value || nextItem.dateKey || new Date().toISOString().slice(0, 10);
      nextItem.title = document.getElementById('editTxnTitle')?.value || nextItem.title;
      nextItem.category = document.getElementById('editTxnCategory')?.value || nextItem.category;
      nextItem.type = selectedType;
      nextItem.amount = (selectedType === 'income' ? 1 : -1) * amountValue;
      nextItem.time = document.getElementById('editTxnTime')?.value || nextItem.time;
      nextItem.date = nextDate === new Date().toISOString().slice(0, 10) ? 'วันนี้' : nextDate;
      nextItem.dateKey = nextDate;
      closeModal();
      renderDashboard();
      renderTransactionsPage();
      showSuccessModal('อัปเดตรายการสำเร็จ');
    });
  }
}

function deleteTransaction(transactionId) {
  const target = mock.transactions.find((item) => item.id === Number(transactionId));
  if (!target) return;
  mock.transactions = mock.transactions.filter((item) => item.id !== Number(transactionId));
  transactionState.selectedIds = transactionState.selectedIds.filter((id) => id !== Number(transactionId));
  closeModal();
  renderDashboard();
  renderTransactionsPage();
  showSuccessModal('ลบรายการสำเร็จ');
}

function reorderCategories(draggedId, targetId) {
  const list = mock.categories.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const draggedIndex = list.findIndex((item) => item.id === draggedId);
  const targetIndex = list.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return;
  const [moved] = list.splice(draggedIndex, 1);
  list.splice(targetIndex, 0, moved);
  list.forEach((item, index) => { item.sortOrder = index + 1; });
  categoryState.sortMode = false;
  renderCategoriesPage();
}

function setCategoryLimit(categoryId) {
  const category = mock.categories.find((item) => item.id === Number(categoryId));
  if (!category) return;
  buildKeypadInput(category.limit || 30000, (amount) => {
    category.limit = amount;
    category.percentage = Math.round(((category.used || 0) / amount) * 100 || 0);
    renderCategoriesPage();
    showSuccessModal('ตั้งงบรายหมวดสำเร็จ');
  });
}

function openCategoryDetail(categoryId) {
  const category = mock.categories.find((item) => item.id === Number(categoryId));
  if (!category) return;

  const html = `
    <div class="modal-card wide">
      <div class="modal-head">
        <h3>${category.name}</h3>
        <button class="close-btn" type="button" data-close-modal="true">✕</button>
      </div>
      <div class="segmented-control">
        <button type="button" class="segmented active" data-category-tab="overview">ภาพรวม</button>
        <button type="button" class="segmented" data-category-tab="history">ประวัติ</button>
      </div>
      <div class="category-detail-card">
        <div class="summary-row"><span>งบที่ตั้ง</span><strong>${formatMoney(category.limit || 0)}</strong></div>
        <div class="summary-row"><span>ใช้ไปแล้ว</span><strong>${formatMoney(category.used || 0)}</strong></div>
        <div class="summary-row"><span>สัดส่วน</span><strong>${Math.round(((category.used || 0) / (category.limit || 1)) * 100 || 0)}%</strong></div>
      </div>
      <div class="chart-wrap small-donut">
        <canvas id="categoryDetailChart"></canvas>
      </div>
      <div class="chart-wrap small-line">
        <canvas id="categoryHistoryChart"></canvas>
      </div>
    </div>
  `;
  openModal(html);

  createChart('categoryDetailChart', {
    type: 'doughnut',
    data: {
      labels: ['ใช้ไป', 'คงเหลือ'],
      datasets: [{
        data: [Math.max(1, category.used || 0), Math.max(1, (category.limit || 0) - (category.used || 0))],
        backgroundColor: ['#8b5cf6', '#e9d5ff'],
        borderWidth: 0,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  createChart('categoryHistoryChart', {
    type: 'line',
    data: {
      labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'],
      datasets: [{
        label: 'ยอดใช้',
        data: [120000, 140000, 110000, 170000, 150000, category.used || 90000],
        borderColor: '#8b5cf6',
        borderDash: [6, 6],
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        fill: false,
        borderWidth: 2,
      }, {
        label: 'งบประมาณ',
        data: [150000, 150000, 150000, 150000, 150000, category.limit || 90000],
        borderColor: '#c4b5fd',
        backgroundColor: 'rgba(196, 181, 253, 0.15)',
        fill: false,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text').trim() } } },
      scales: {
        x: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--muted').trim() }, grid: { display: false } },
        y: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--muted').trim() }, grid: { color: 'rgba(255,255,255,0.05)' } },
      },
    },
  });
}

function bindTransactionControls() {
  const toggleMultiSelectBtn = document.getElementById('toggleMultiSelectBtn');
  if (toggleMultiSelectBtn) {
    toggleMultiSelectBtn.addEventListener('click', () => {
      transactionState.multiSelect = !transactionState.multiSelect;
      if (!transactionState.multiSelect) {
        transactionState.selectedIds = [];
      }
      renderTransactionsPage();
    });
  }

  const openDatePickerBtn = document.getElementById('openDatePickerBtn');
  if (openDatePickerBtn) {
    openDatePickerBtn.addEventListener('click', buildDatePickerModal);
  }

  document.querySelectorAll('.tab[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      transactionState.activeTab = button.dataset.filter || 'all';
      document.querySelectorAll('.tab[data-filter]').forEach((tab) => tab.classList.toggle('active', tab === button));
      renderTransactionsPage();
    });
  });

  const searchInput = document.getElementById('transactionSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      transactionState.searchValue = event.target.value;
      renderTransactionsPage();
    });
  }

  const quickAddBtn = document.getElementById('quickAddTransactionBtn');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', openAddTransactionModal);
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('[data-transaction-menu]');
    if (target) {
      openTransactionActionMenu(target.dataset.transactionMenu);
      return;
    }

    const editBtn = event.target.closest('[data-edit-transaction]');
    if (editBtn) {
      editTransaction(editBtn.dataset.editTransaction);
      return;
    }

    const deleteBtn = event.target.closest('[data-delete-transaction]');
    if (deleteBtn) {
      deleteTransaction(deleteBtn.dataset.deleteTransaction);
      return;
    }

    const rowCheck = event.target.closest('[data-row-check]');
    if (rowCheck) {
      const id = Number(rowCheck.dataset.rowCheck);
      const has = transactionState.selectedIds.includes(id);
      transactionState.selectedIds = has ? transactionState.selectedIds.filter((itemId) => itemId !== id) : [...transactionState.selectedIds, id];
      renderTransactionsPage();
      return;
    }

    const removeDateBtn = event.target.closest('[data-remove-date]');
    if (removeDateBtn) {
      transactionState.selectedDates = transactionState.selectedDates.filter((date) => date !== removeDateBtn.dataset.removeDate);
      renderTransactionsPage();
      return;
    }

    const batchAction = event.target.closest('[data-batch-action]');
    if (batchAction) {
      const action = batchAction.dataset.batchAction;
      if (action === 'delete') {
        mock.transactions = mock.transactions.filter((item) => !transactionState.selectedIds.includes(item.id));
        transactionState.selectedIds = [];
        renderTransactionsPage();
        renderDashboard();
      }
      if (action === 'set-category') {
        const categoryName = window.prompt('ระบุหมวดหมู่ใหม่', mock.categories[0]?.name || '');
        if (categoryName) {
          mock.transactions.forEach((item) => {
            if (transactionState.selectedIds.includes(item.id)) item.category = categoryName;
          });
          transactionState.selectedIds = [];
          renderTransactionsPage();
          renderDashboard();
        }
      }
      return;
    }

    const transferBtn = event.target.closest('[data-plan-transfer]');
    if (transferBtn) {
      const planId = Number(transferBtn.dataset.planTransfer);
      const plan = mock.plans.find((item) => item.id === planId);
      if (!plan) return;
      buildKeypadInput(0, (amount) => {
        plan.saved += amount;
        plan.progress = ((plan.saved / plan.target) * 100) || 0;
        if (plan.saved >= plan.target) {
          plan.status = 'completed';
          plan.confidence = 'high';
        } else if (plan.progress < 60) {
          plan.status = 'off_track';
          plan.confidence = 'medium';
        } else {
          plan.status = 'normal';
          plan.confidence = 'high';
        }
        renderAnalyzePage();
        renderDashboard();
        showSuccessModal('โอนเงินเข้าภารกิจสำเร็จ');
      });
      return;
    }

    const planMenu = event.target.closest('[data-plan-menu]');
    if (planMenu) {
      const planId = Number(planMenu.dataset.planMenu);
      const plan = mock.plans.find((item) => item.id === planId);
      if (!plan) return;
      const html = `
        <div class="modal-card small">
          <div class="modal-head"><h3>${plan.name}</h3><button class="close-btn" data-close-modal="true" type="button">✕</button></div>
          <div class="settings-list">
            <button class="settings-row" type="button" data-plan-edit="${plan.id}"><span>แก้ไข</span><strong>›</strong></button>
            <button class="settings-row danger" type="button" data-plan-delete="${plan.id}"><span>ลบแผน</span><strong>›</strong></button>
          </div>
        </div>
      `;
      openModal(html);
      return;
    }

    const planEdit = event.target.closest('[data-plan-edit]');
    if (planEdit) {
      const plan = mock.plans.find((item) => item.id === Number(planEdit.dataset.planEdit));
      if (!plan) return;
      const html = `
        <div class="modal-card small">
          <div class="modal-head"><h3>แก้ไขแผน</h3><button class="close-btn" data-close-modal="true" type="button">✕</button></div>
          <div class="form-grid">
            <label class="form-field floating"><span>ชื่อแผน</span><input id="editPlanName" value="${plan.name}" /></label>
            <label class="form-field floating"><span>เป้าหมาย</span><input id="editPlanTarget" type="number" value="${plan.target}" /></label>
            <label class="form-field floating"><span>monthly_save</span><input id="editPlanSave" type="number" value="${plan.monthly_save || 15000}" /></label>
            <label class="form-field floating"><span>วันครบกำหนด</span><input id="editPlanDue" value="${plan.dueMonth || 'มี.ค. 2026'}" /></label>
          </div>
          <div class="modal-actions"><button class="primary-btn full" type="button" data-plan-save-edits="${plan.id}">บันทึก</button></div>
        </div>
      `;
      openModal(html);
      return;
    }

    const planSaveEdits = event.target.closest('[data-plan-save-edits]');
    if (planSaveEdits) {
      const plan = mock.plans.find((item) => item.id === Number(planSaveEdits.dataset.planSaveEdits));
      if (!plan) return;
      plan.name = document.getElementById('editPlanName')?.value || plan.name;
      plan.target = safeNumber(document.getElementById('editPlanTarget')?.value || plan.target);
      plan.monthly_save = safeNumber(document.getElementById('editPlanSave')?.value || plan.monthly_save || 0);
      plan.dueMonth = document.getElementById('editPlanDue')?.value || plan.dueMonth;
      plan.progress = ((plan.saved / plan.target) * 100) || 0;
      closeModal();
      renderAnalyzePage();
      renderDashboard();
      showSuccessModal('แก้ไขแผนสำเร็จ');
      return;
    }

    const planDelete = event.target.closest('[data-plan-delete]');
    if (planDelete) {
      const id = Number(planDelete.dataset.planDelete);
      const plan = mock.plans.find((item) => item.id === id);
      if (plan) plan.active = false;
      closeModal();
      renderAnalyzePage();
      renderDashboard();
      showSuccessModal('ยกเลิกแผนสำเร็จ');
      return;
    }

    const categorySetLimit = event.target.closest('[data-category-set-limit]');
    if (categorySetLimit) {
      setCategoryLimit(categorySetLimit.dataset.categorySetLimit);
      return;
    }

    const categoryRow = event.target.closest('[data-category-row]');
    if (categoryRow && !event.target.closest('button') && !event.target.closest('input')) {
      openCategoryDetail(categoryRow.dataset.categoryRow);
      return;
    }

    if (event.target.closest('[data-plan-next]')) {
      const nextStep = Number(event.target.closest('[data-plan-next]').dataset.planNext);
      pageState.planWizard.step = nextStep;
      const inputName = document.getElementById('planNameInput');
      const inputAmount = document.getElementById('planAmountInput');
      const inputMonths = document.getElementById('planMonthsInput');
      if (inputName) pageState.planWizard.name = inputName.value;
      if (inputAmount) pageState.planWizard.amount = inputAmount.value;
      if (inputMonths) pageState.planWizard.months = inputMonths.value;
      renderPlanWizardStep();
      return;
    }

    if (event.target.closest('[data-plan-back]')) {
      const prev = Number(event.target.closest('[data-plan-back]').dataset.planBack);
      pageState.planWizard.step = prev;
      renderPlanWizardStep();
      return;
    }

    if (event.target.closest('[data-plan-strategy]')) {
      pageState.planWizard.mode = event.target.closest('[data-plan-strategy]').dataset.planStrategy;
      renderPlanWizardStep();
      return;
    }

    if (event.target.closest('[data-plan-confirm]')) {
      addPlanFromWizard();
      return;
    }

    if (event.target.closest('[data-save-transaction]')) {
      return;
    }

    if (event.target.closest('[data-close-modal]')) {
      closeModal();
    }
  });

  const toggleCategorySortBtn = document.getElementById('toggleCategorySortBtn');
  if (toggleCategorySortBtn) {
    toggleCategorySortBtn.addEventListener('click', () => {
      categoryState.sortMode = !categoryState.sortMode;
      renderCategoriesPage();
    });
  }

  document.querySelectorAll('.tab[data-category-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      categoryState.activeTab = button.dataset.categoryFilter || 'all';
      document.querySelectorAll('.tab[data-category-filter]').forEach((tab) => tab.classList.toggle('active', tab === button));
      renderCategoriesPage();
    });
  });

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-category-id]')) {
      const categoryId = Number(target.dataset.categoryId);
      const category = mock.categories.find((item) => item.id === categoryId);
      if (category) {
        category.isEssential = target.checked;
      }
    }
  });

  const datePickerOpen = document.getElementById('openDatePickerBtn');
  if (datePickerOpen) {
    datePickerOpen.addEventListener('click', buildDatePickerModal);
  }

  const quickAddTransactionBtn = document.getElementById('quickAddTransactionBtn');
  if (quickAddTransactionBtn) {
    quickAddTransactionBtn.addEventListener('click', openAddTransactionModal);
  }
}

function bindSettingsActions() {
  const rotateButton = document.getElementById('rotateTokenBtn');
  if (rotateButton) {
    rotateButton.addEventListener('click', () => {
      showSuccessModal('token ใหม่ถูกสร้างเรียบร้อยแล้ว');
    });
  }
}

function initializePage() {
  setupThemeToggle();
  bindTransactionControls();
  bindSettingsActions();

  const pageName = document.body.dataset.page;
  if (pageName === 'dashboard') renderDashboard();
  if (pageName === 'transactions') renderTransactionsPage();
  if (pageName === 'categories') renderCategoriesPage();
  if (pageName === 'analyze') renderAnalyzePage();
}

document.addEventListener('DOMContentLoaded', initializePage);
