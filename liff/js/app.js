// ชุดไอคอนหมวดหมู่ (Lucide) ที่ผู้ใช้เลือกได้ตอนสร้าง/แก้หมวดหมู่ — ครอบคลุมหมวดทั่วไปที่สุด
// หมวดไหนไม่มีไอคอนที่ตรง (หรือชื่อ key ไม่ตรงกับ key ในนี้เลย เช่น data เก่า/พิมพ์ผิด) จะ fallback ไปที่ "tag" อัตโนมัติ
// ป้องกันเคส "หมวดหมู่ไม่มีไอคอน" ไม่ให้เกิดขึ้นได้เลย ไม่ว่าผู้ใช้จะตั้งชื่อหมวดว่าอะไรก็ตาม
const CATEGORY_ICON_LIBRARY = {
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  bus: '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  fuel: '<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/>',
  'shopping-bag': '<path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  'graduation-cap': '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  'book-open': '<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>',
  clapperboard: '<path d="m12.296 3.464 3.02 3.956"/><path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z"/><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m6.18 5.276 3.1 3.899"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  'heart-pulse': '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/><path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  dumbbell: '<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/>',
  'paw-print': '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  gift: '<path d="M12 7v14"/><path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/><path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"/><rect x="3" y="7" width="18" height="4" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  smartphone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  'piggy-bank': '<path d="M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
};

const CATEGORY_ICON_FALLBACK = 'tag';

function renderCategoryIcon(iconKey) {
  const inner = CATEGORY_ICON_LIBRARY[iconKey] || CATEGORY_ICON_LIBRARY[CATEGORY_ICON_FALLBACK];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// ไอคอน UI ทั่วไป (ปุ่มปิด, แจ้งเตือน, สถานะ ฯลฯ) — แยกจาก CATEGORY_ICON_LIBRARY เพราะจุดใช้งานคงที่ ไม่ได้ให้ผู้ใช้เลือก
const UI_ICON_LIBRARY = {
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'grip-vertical': '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'party-popper': '<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>',
  zap: '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>',
  leaf: '<path d="M11 20a10 10 0 0010-10 25.9 25.9 0 00-1.04-7.281 1 1 0 00-1.755-.325C15.833 5.5 13 5.5 9.8 6.1A7 7 0 0011 20"/><path d="M2 21a5 5 0 012.911-4.544C7.613 15.212 8.351 15.24 11 13"/>',
  scale: '<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  receipt: '<path d="M12 17V7"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>',
  sparkles: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>',
  calendar: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevrons-left': '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
  'chevrons-right': '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};

function renderIcon(key, extraClass) {
  const inner = UI_ICON_LIBRARY[key];
  if (!inner) return '';
  return `<svg class="${extraClass || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

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
  categoryFilter: null,
  monthFilter: null,
};

const categoryState = {
  activeTab: 'all',
  sortMode: false,
};

const dashboardState = {
  budgetBreakdownOpen: false,
  heroView: 'safe',
  activeType: 'expense',
  activeMonthKey: (mock.monthlyHistory && mock.monthlyHistory[mock.monthlyHistory.length - 1]?.key) || null,
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

function getProgressTone(value) {
  const percent = clamp(value);
  if (percent > 100) return 'danger';
  if (percent >= 80) return 'warning';
  return 'success';
}

function getPlanStrategyMeta(mode) {
  const map = {
    fast: { label: 'เร็ว', icon: 'zap' },
    balanced: { label: 'สมดุล', icon: 'scale' },
    relaxed: { label: 'สบาย', icon: 'leaf' },
  };
  return map[mode] || map.balanced;
}

function getConfidenceMeta(level) {
  const map = {
    low: { label: 'ประเมินเบื้องต้น', className: 'low' },
    medium: { label: 'ความมั่นใจปานกลาง', className: 'medium' },
    high: { label: 'ความมั่นใจสูง', className: 'high' },
  };
  return map[level] || map.high;
}

function renderConfidenceBadge(level) {
  const meta = getConfidenceMeta(level);
  return `<span class="confidence-badge ${meta.className}"><span class="confidence-dot"></span>${meta.label}</span>`;
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

function getActiveMonth() {
  const history = mock.monthlyHistory || [];
  const found = history.find((month) => month.key === dashboardState.activeMonthKey);
  return found || history[history.length - 1] || { key: '', label: '', usage: {} };
}

function chevronIconSvg(isOpen) {
  return `<svg class="chevron-icon ${isOpen ? 'is-open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
}

function renderMonthlyBudgetSummary() {
  const container = document.getElementById('monthlyBudgetSummary');
  if (!container) return;

  const isOpen = dashboardState.budgetBreakdownOpen;
  const activeType = dashboardState.activeType;
  const activeMonth = getActiveMonth();

  const rows = mock.categories
    .filter((item) => item.type === activeType)
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((item) => ({
      ...item,
      used: safeNumber(activeMonth.usage[item.id]),
    }));

  const totalUsed = rows.reduce((sum, item) => sum + item.used, 0);
  const totalLimit = rows.reduce((sum, item) => sum + safeNumber(item.limit), 0);
  const percent = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

  const segmentsHtml = rows
    .map((item) => {
      const sharePercent = totalUsed > 0 ? (item.used / totalUsed) * 100 : 0;
      if (sharePercent <= 0) return '';
      return `<span class="stacked-bar-seg" style="width: ${sharePercent}%; background: ${item.color}" title="${item.name}" data-budget-category="${item.id}"></span>`;
    })
    .join('');

  const legendRows = rows
    .map((item) => {
      const itemPercent = clamp(((item.used || 0) / (item.limit || 1)) * 100);
      return `
        <div class="budget-legend-row" data-budget-category="${item.id}">
          <div class="budget-legend-head">
            <span class="legend-dot" style="background: ${item.color}"></span>
            <span>${item.name}</span>
            <strong>${formatMoney(item.used)}</strong>
          </div>
          <div class="progress-bar budget-legend-bar ${isOpen ? '' : 'hidden'}"><span style="width: ${itemPercent}%; background: ${item.color}"></span></div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="budget-summary-head">
      <h3>${activeType === 'income' ? 'รายรับรายเดือน' : 'งบประมาณรายเดือน'}</h3>
      <span>${Math.round(clamp(percent))}%</span>
    </div>

    <div class="budget-controls">
      <div class="tab-group" role="tablist" aria-label="ประเภทรายการ">
        <button type="button" class="tab ${activeType === 'expense' ? 'active' : ''}" data-budget-type="expense">รายจ่าย</button>
        <button type="button" class="tab ${activeType === 'income' ? 'active' : ''}" data-budget-type="income">รายรับ</button>
      </div>
      <button type="button" class="chip-button" id="openMonthPickerBtn">
        <span>${activeMonth.label}</span>
        ${chevronIconSvg(false)}
      </button>
    </div>

    <div class="budget-row">
      <strong>${formatMoney(totalUsed)}</strong>
      <span>จาก ${formatMoney(totalLimit)}</span>
    </div>

    <div class="stacked-bar">${segmentsHtml}</div>

    <div class="budget-legend-list">${legendRows}</div>

    <button type="button" class="budget-toggle-btn" id="toggleBudgetBreakdownBtn" aria-expanded="${isOpen}">
      <span>${isOpen ? 'ย่อ' : 'ดูรายละเอียดรายหมวด'}</span>
      ${chevronIconSvg(isOpen)}
    </button>
  `;

  const toggleBtn = document.getElementById('toggleBudgetBreakdownBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      dashboardState.budgetBreakdownOpen = !dashboardState.budgetBreakdownOpen;
      renderMonthlyBudgetSummary();
    });
  }

  container.querySelectorAll('[data-budget-type]').forEach((tab) => {
    tab.addEventListener('click', () => {
      dashboardState.activeType = tab.dataset.budgetType;
      renderMonthlyBudgetSummary();
    });
  });

  const monthPickerBtn = document.getElementById('openMonthPickerBtn');
  if (monthPickerBtn) {
    monthPickerBtn.addEventListener('click', openMonthPickerModal);
  }

  container.querySelectorAll('[data-budget-category]').forEach((el) => {
    el.addEventListener('click', () => {
      const category = rows.find((item) => item.id === Number(el.dataset.budgetCategory));
      if (category) openBudgetCategoryModal(category, totalUsed, activeMonth.key, activeType);
    });
  });
}

function openBudgetCategoryModal(category, totalUsed, monthKey, activeType) {
  const sharePercent = totalUsed > 0 ? Math.round((category.used / totalUsed) * 100) : 0;
  const typeLabel = activeType === 'income' ? 'รายรับ' : 'รายจ่าย';

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3><span class="legend-dot" style="background: ${category.color}"></span> ${category.name}</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="summary-row"><span>${typeLabel}ในหมวดนี้</span><strong>${formatMoney(category.used)}</strong></div>
      <div class="summary-row"><span>สัดส่วนของ${typeLabel}ทั้งหมดเดือนนี้</span><strong>${sharePercent}%</strong></div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-goto-category="${category.id}">ดูรายการในหน้าประวัติ</button>
      </div>
    </div>
  `;
  openModal(html);

  const gotoBtn = document.querySelector('[data-goto-category]');
  if (gotoBtn) {
    gotoBtn.addEventListener('click', () => {
      window.location.href = `transactions.html?category=${category.id}&month=${monthKey}`;
    });
  }
}

function openMonthPickerModal() {
  const history = mock.monthlyHistory || [];
  const activeKey = getActiveMonth().key;

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>เลือกเดือน</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="settings-list">
        ${history
          .slice()
          .reverse()
          .map((month) => `
            <button class="settings-row ${month.key === activeKey ? 'active-row' : ''}" type="button" data-select-month="${month.key}">
              <span>${month.label}</span>
              <strong>›</strong>
            </button>
          `)
          .join('')}
      </div>
    </div>
  `;
  openModal(html);

  document.querySelectorAll('[data-select-month]').forEach((button) => {
    button.addEventListener('click', () => {
      dashboardState.activeMonthKey = button.dataset.selectMonth;
      closeModal();
      renderMonthlyBudgetSummary();
    });
  });
}

/**
 * หน้าสรุป (index.html) — เวอร์ชัน v2: เน้นเฉพาะข้อมูลที่ต้องรู้ทันที
 * กราฟ (donut/แนวโน้ม) และ goal cards เต็มรูปแบบ ย้ายไปอยู่ที่ analyze.html แล้ว
 * ไม่ซ้ำซ้อนกันอีกต่อไปตามที่ตกลงกันไว้ตอนวางแผนดีไซน์
 */
function renderDashboard() {
  const summary = mock.summary;
  const heroConfidenceBadge = document.getElementById('heroConfidenceBadge');
  const heroSafeToSpend = document.getElementById('heroSafeToSpend');
  const heroFigureLabel = document.getElementById('heroFigureLabel');
  const transactionList = document.getElementById('transactionList');

  renderMonthlyBudgetSummary();

  if (heroConfidenceBadge) {
    heroConfidenceBadge.innerHTML = renderConfidenceBadge(summary.safeToSpendConfidence || 'high');
  }

  if (heroFigureLabel && heroSafeToSpend) {
    if (dashboardState.heroView === 'remaining') {
      heroFigureLabel.textContent = 'เงินที่เหลือในเดือนนี้';
      heroSafeToSpend.textContent = formatMoney(getRemainingThisMonth());
    } else {
      heroFigureLabel.textContent = 'ใช้ได้อย่างปลอดภัยวันนี้';
      heroSafeToSpend.textContent = formatMoney(summary.safeToSpend);
    }
  }

  if (transactionList) {
    transactionList.innerHTML = mock.transactions
      .slice(0, 4)
      .map((item) => {
        const amount = Number(item.amount || 0);
        const sign = amount >= 0 ? '+' : '-';
        const icon = renderIcon(item.type === 'income' ? 'wallet' : 'receipt');
        const displayAmount = formatMoney(Math.abs(amount));
        const aiBadge = item.parsedBy === 'ai' ? `<span class="ai-tag">${renderIcon('sparkles')} AI</span>` : '';

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
}

// ============================================================
// Custom dropdown/date picker — แทน <select>/<input type="date"> เดิมที่ browser
// render popup เองแบบไม่มีสไตล์ (ดูไม่เข้าธีมแอปเลย) ด้วย component ที่คุมหน้าตาได้เองทั้งหมด
// ============================================================

// เปิด popover ขึ้นด้านบนแทน ถ้าพื้นที่ด้านล่าง (ภายใน modal-card) เหลือไม่พอ
// กันปัญหา dropdown/ปฏิทินทับปุ่ม "บันทึก" เวลาช่องนั้นอยู่ใกล้ขอบล่างของ modal
function positionPopoverDirection(trigger, popover, estimatedHeight) {
  const triggerRect = trigger.getBoundingClientRect();
  const modalCard = trigger.closest('.modal-card');
  const boundsBottom = modalCard ? modalCard.getBoundingClientRect().bottom : window.innerHeight;
  const spaceBelow = boundsBottom - triggerRect.bottom;
  popover.classList.toggle('open-upward', spaceBelow < estimatedHeight);
}

function formatDateDisplay(dateKey) {
  if (!dateKey) return 'เลือกวันที่';
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' }).format(date);
}

function closeAllPopovers() {
  document.querySelectorAll('.popover-panel').forEach((panel) => { panel.hidden = true; });
}

function buildCalendarGridHtml(year, month, selectedDateKey) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push('<div class="calendar-empty"></div>');
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const active = value === selectedDateKey ? 'selected' : '';
    cells.push(`<button type="button" class="calendar-day ${active}" data-pick-date="${value}">${day}</button>`);
  }
  const monthLabel = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', calendar: 'gregory' }).format(new Date(year, month, 1));
  return { cellsHtml: cells.join(''), monthLabel };
}

function renderCustomDateField(fieldId, selectedDateKey) {
  return `
    <div class="custom-select" data-date-field="${fieldId}">
      <button type="button" class="custom-select-trigger" data-date-trigger>
        <span data-date-display>${formatDateDisplay(selectedDateKey)}</span>
        ${renderIcon('calendar', 'trigger-icon')}
      </button>
      <div class="popover-panel date-popover" hidden data-date-popover></div>
      <input type="hidden" id="${fieldId}" value="${selectedDateKey || ''}" />
    </div>
  `;
}

function bindCustomDateField(fieldId) {
  const wrap = document.querySelector(`[data-date-field="${fieldId}"]`);
  if (!wrap) return;
  const trigger = wrap.querySelector('[data-date-trigger]');
  const popover = wrap.querySelector('[data-date-popover]');
  const display = wrap.querySelector('[data-date-display]');
  const hiddenInput = document.getElementById(fieldId);

  let viewDate = hiddenInput.value ? new Date(`${hiddenInput.value}T00:00:00`) : new Date();

  function renderCalendar() {
    const { cellsHtml, monthLabel } = buildCalendarGridHtml(viewDate.getFullYear(), viewDate.getMonth(), hiddenInput.value);
    popover.innerHTML = `
      <div class="calendar-nav">
        <div class="calendar-nav-group">
          <button type="button" class="icon-btn small" data-cal-prev-year title="ปีก่อนหน้า">${renderIcon('chevrons-left')}</button>
          <button type="button" class="icon-btn small" data-cal-prev title="เดือนก่อนหน้า">${renderIcon('chevron-left')}</button>
        </div>
        <strong>${monthLabel}</strong>
        <div class="calendar-nav-group">
          <button type="button" class="icon-btn small" data-cal-next title="เดือนถัดไป">${renderIcon('chevron-right')}</button>
          <button type="button" class="icon-btn small" data-cal-next-year title="ปีถัดไป">${renderIcon('chevrons-right')}</button>
        </div>
      </div>
      <div class="calendar-weekday-row"><span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span></div>
      <div class="calendar-grid">${cellsHtml}</div>
    `;
    popover.querySelector('[data-cal-prev-year]').addEventListener('click', (event) => {
      event.stopPropagation();
      viewDate = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1);
      renderCalendar();
    });
    popover.querySelector('[data-cal-next-year]').addEventListener('click', (event) => {
      event.stopPropagation();
      viewDate = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1);
      renderCalendar();
    });
    popover.querySelector('[data-cal-prev]').addEventListener('click', (event) => {
      event.stopPropagation();
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      renderCalendar();
    });
    popover.querySelector('[data-cal-next]').addEventListener('click', (event) => {
      event.stopPropagation();
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      renderCalendar();
    });
    popover.querySelectorAll('[data-pick-date]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        hiddenInput.value = button.dataset.pickDate;
        display.textContent = formatDateDisplay(hiddenInput.value);
        popover.hidden = true;
      });
    });
  }

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = popover.hidden;
    closeAllPopovers();
    if (willOpen) {
      renderCalendar();
      positionPopoverDirection(trigger, popover, 340);
      popover.hidden = false;
    }
  });

  popover.addEventListener('click', (event) => event.stopPropagation());
}

function renderCustomSelect(fieldId, options, selectedValue) {
  const selected = selectedValue || options[0] || '';
  return `
    <div class="custom-select" data-select-field="${fieldId}">
      <button type="button" class="custom-select-trigger" data-select-trigger>
        <span data-select-display>${selected}</span>
        ${renderIcon('chevron-down', 'trigger-icon')}
      </button>
      <div class="popover-panel select-popover" hidden data-select-popover>
        ${options.map((option) => `<button type="button" class="select-option ${option === selected ? 'active' : ''}" data-select-option="${option}">${option}</button>`).join('')}
      </div>
      <input type="hidden" id="${fieldId}" value="${selected}" />
    </div>
  `;
}

function bindCustomSelect(fieldId) {
  const wrap = document.querySelector(`[data-select-field="${fieldId}"]`);
  if (!wrap) return;
  const trigger = wrap.querySelector('[data-select-trigger]');
  const popover = wrap.querySelector('[data-select-popover]');
  const display = wrap.querySelector('[data-select-display]');
  const hiddenInput = document.getElementById(fieldId);

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = popover.hidden;
    closeAllPopovers();
    if (willOpen) {
      positionPopoverDirection(trigger, popover, 240);
    }
    popover.hidden = !willOpen;
  });

  popover.addEventListener('click', (event) => event.stopPropagation());

  popover.querySelectorAll('[data-select-option]').forEach((button) => {
    button.addEventListener('click', () => {
      hiddenInput.value = button.dataset.selectOption;
      display.textContent = button.dataset.selectOption;
      popover.querySelectorAll('[data-select-option]').forEach((btn) => btn.classList.toggle('active', btn === button));
      popover.hidden = true;
    });
  });
}

const TIME_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const TIME_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// ช่องเวลา — ใช้ dropdown ชม./นาที 2 ตัว (ใช้ renderCustomSelect/bindCustomSelect ตัวเดียวกับหมวดหมู่)
// แทน <input type="time"> เดิมที่ browser render เองแบบไม่มีสไตล์ เหมือนที่แก้ไปแล้วกับวันที่
function renderCustomTimeField(baseId, timeValue) {
  const [rawHour, rawMinute] = (timeValue || '09:00').split(':');
  const hour = TIME_HOUR_OPTIONS.includes(rawHour) ? rawHour : '09';
  const minute = TIME_MINUTE_OPTIONS.includes(rawMinute)
    ? rawMinute
    : TIME_MINUTE_OPTIONS.reduce((closest, option) => (
      Math.abs(Number(option) - Number(rawMinute || 0)) < Math.abs(Number(closest) - Number(rawMinute || 0)) ? option : closest
    ), '00');

  return `
    <div class="time-select-row">
      ${renderCustomSelect(`${baseId}Hour`, TIME_HOUR_OPTIONS, hour)}
      <span class="time-sep">:</span>
      ${renderCustomSelect(`${baseId}Minute`, TIME_MINUTE_OPTIONS, minute)}
    </div>
  `;
}

function bindCustomTimeField(baseId) {
  bindCustomSelect(`${baseId}Hour`);
  bindCustomSelect(`${baseId}Minute`);
}

function getCustomTimeValue(baseId) {
  const hour = document.getElementById(`${baseId}Hour`)?.value || '09';
  const minute = document.getElementById(`${baseId}Minute`)?.value || '00';
  return `${hour}:${minute}`;
}

document.addEventListener('click', closeAllPopovers);

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
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
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

  const categoryFilterChips = document.getElementById('categoryFilterChips');
  if (categoryFilterChips) {
    const categoryNames = [...new Set(mock.categories.map((item) => item.name))];
    categoryFilterChips.innerHTML = `
      <button type="button" class="tab ${!transactionState.categoryFilter ? 'active' : ''}" data-category-chip="">ทุกหมวดหมู่</button>
      ${categoryNames.map((name) => `
        <button type="button" class="tab ${transactionState.categoryFilter === name ? 'active' : ''}" data-category-chip="${name}">${name}</button>
      `).join('')}
    `;
    categoryFilterChips.querySelectorAll('[data-category-chip]').forEach((button) => {
      button.addEventListener('click', () => {
        transactionState.categoryFilter = button.dataset.categoryChip || null;
        transactionState.monthFilter = null;
        renderTransactionsPage();
      });
    });
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

  const activeFilterChip = document.getElementById('activeFilterChip');
  if (activeFilterChip) {
    if (transactionState.categoryFilter && transactionState.monthFilter) {
      const monthEntry = (mock.monthlyHistory || []).find((item) => item.key === transactionState.monthFilter);
      const monthLabel = monthEntry ? ` · ${monthEntry.label}` : '';
      activeFilterChip.innerHTML = `
        <span class="date-chip">
          ${transactionState.categoryFilter}${monthLabel}
          <button type="button" data-clear-deep-link="true">×</button>
        </span>
      `;
    } else {
      activeFilterChip.innerHTML = '';
    }
  }

  if (transactionTable) {
    const filtered = mock.transactions.filter((item) => {
      const matchesTab = transactionState.activeTab === 'all' || item.type === transactionState.activeTab;
      const matchesSearch = !transactionState.searchValue || `${item.title} ${item.category}`.toLowerCase().includes(transactionState.searchValue.toLowerCase());
      const matchesDate = transactionState.selectedDates.length === 0 || Boolean(item.dateKey && transactionState.selectedDates.includes(item.dateKey));
      const matchesCategory = !transactionState.categoryFilter || item.category === transactionState.categoryFilter;
      const matchesMonth = !transactionState.monthFilter || Boolean(item.dateKey && item.dateKey.startsWith(transactionState.monthFilter));
      return matchesTab && matchesSearch && matchesDate && matchesCategory && matchesMonth;
    });

    const grouped = filtered.reduce((acc, item) => {
      const key = item.date || 'อื่น ๆ';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const html = Object.entries(grouped)
      .map(([groupName, items]) => {
        const groupTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const groupTotalSign = groupTotal >= 0 ? '+' : '-';
        return `
        <div class="date-group">
          <div class="date-group-header">
            <span>${groupName}</span>
            <span class="date-group-total ${groupTotal >= 0 ? 'income' : 'expense'}">รวม ${groupTotalSign}${formatMoney(Math.abs(groupTotal))}</span>
          </div>
          ${items.map((item) => {
            const amount = Number(item.amount || 0);
            const sign = amount >= 0 ? '+' : '-';
            const icon = renderIcon(item.type === 'income' ? 'wallet' : 'receipt');
            const aiBadge = item.parsedBy === 'ai' ? `<span class="ai-tag">${renderIcon('sparkles')} AI</span>` : '';
            const displayAmount = formatMoney(Math.abs(amount));
            const selectedClass = transactionState.selectedIds.includes(item.id) ? 'row-selected' : '';
            const checkbox = transactionState.multiSelect ? `<input type="checkbox" class="row-check" data-row-check="${item.id}" ${transactionState.selectedIds.includes(item.id) ? 'checked' : ''} />` : '';

            return `
              <div class="transaction-row ${transactionState.multiSelect ? 'selectable' : ''} ${selectedClass}">
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
      `;
      })
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
            ${categoryState.sortMode ? `<span class="drag-handle">${renderIcon('grip-vertical')}</span>` : ''}
            <span class="category-badge">${renderCategoryIcon(item.icon)}</span>
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
      const statusBadge = plan.status === 'off_track'
        ? `<span class="pill warning">${renderIcon('triangle-alert', 'pill-icon')} หลุดเป้า</span>`
        : plan.status === 'completed'
          ? `<span class="pill success">${renderIcon('party-popper', 'pill-icon')} ครบเป้าแล้ว</span>`
          : '<span class="pill success">ปกติ</span>';

      return `
        <div class="goal-card">
          <div class="goal-header">
            <strong>${plan.name}</strong>
            <div class="plan-menu-wrap">
              ${renderConfidenceBadge(plan.confidence || 'high')}
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
    const budgetLine = new Array(mock.lineData.labels.length).fill(mock.summary.monthlyBudgetLimit);
    createChart('reportChart', {
      type: 'bar',
      data: {
        labels: mock.lineData.labels,
        datasets: [
          {
            label: 'รายรับ',
            data: mock.lineData.income,
            backgroundColor: 'rgba(76, 175, 80, 0.85)',
            borderRadius: 8,
          },
          {
            label: 'รายจ่าย',
            data: mock.lineData.expense,
            backgroundColor: 'rgba(20, 23, 15, 0.75)',
            borderRadius: 8,
          },
          {
            type: 'line',
            label: 'งบประมาณ',
            data: budgetLine,
            borderColor: '#a86400',
            backgroundColor: 'rgba(245, 165, 36, 0.15)',
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
            grid: { color: 'rgba(16,20,11,0.06)' },
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
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
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
        <button class="primary-btn full" type="button" data-plan-next="2">ต่อไป</button>
      </div>
    `;
  }

  if (state.step === 2) {
    const planStrategies = [
      { key: 'fast', label: 'เร็ว', icon: 'zap', hint: 'ต้นทุนสูง', save: safeNumber(state.amount) * 0.18 },
      { key: 'balanced', label: 'สมดุล', icon: 'scale', hint: 'ปลอดภัย', save: safeNumber(state.amount) * 0.12 },
      { key: 'relaxed', label: 'สบาย', icon: 'leaf', hint: 'ผ่อนคลาย', save: safeNumber(state.amount) * 0.08 },
    ];

    body.innerHTML = `
      <div class="strategy-grid">
        ${planStrategies.map((strategy) => `
          <button type="button" class="strategy-card ${state.mode === strategy.key ? 'selected' : ''}" data-plan-strategy="${strategy.key}">
            <strong>${renderIcon(strategy.icon, 'strategy-icon')} ${strategy.label}</strong>
            <small>${strategy.hint}</small>
            <span>${formatMoney(strategy.save)}</span>
          </button>
        `).join('')}
      </div>
      <div class="modal-actions split">
        <button class="secondary-btn" type="button" data-plan-back="1">ย้อนกลับ</button>
        <button class="primary-btn" type="button" data-plan-next="3">ต่อไป</button>
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
        <div class="summary-row"><span>รูปแบบ</span><strong>${renderIcon(getPlanStrategyMeta(state.mode).icon, 'strategy-icon')} ${getPlanStrategyMeta(state.mode).label}</strong></div>
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
      <div class="success-icon">${renderIcon('check')}</div>
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
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
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
  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>เพิ่มรายการใหม่</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="form-grid">
        <label class="form-field">
          <span>ประเภท</span>
          <div class="segmented-control">
            <button type="button" class="segmented active" data-new-transaction-type="expense">รายจ่าย</button>
            <button type="button" class="segmented" data-new-transaction-type="income">รายรับ</button>
          </div>
        </label>
        <label class="form-field">
          <span>หมวดหมู่</span>
          ${renderCustomSelect('newTxnCategory', mock.categories.map((item) => item.name), mock.categories[0]?.name)}
        </label>
        <label class="form-field">
          <span>รายละเอียด</span>
          <input id="newTxnTitle" value="" placeholder="เช่น ค่าบริการ" />
        </label>
        <label class="form-field">
          <span>จำนวนเงิน</span>
          <div class="amount-input-wrap">
            <input id="newTxnAmount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" />
            <span class="amount-input-suffix">฿</span>
          </div>
        </label>
        <label class="form-field">
          <span>วันที่</span>
          ${renderCustomDateField('newTxnDate', new Date().toISOString().slice(0, 10))}
        </label>
        <label class="form-field">
          <span>เวลา</span>
          ${renderCustomTimeField('newTxnTime', '09:00')}
        </label>
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-save-transaction="true">บันทึก</button>
      </div>
    </div>
  `;
  openModal(html);
  bindCustomSelect('newTxnCategory');
  bindCustomDateField('newTxnDate');
  bindCustomTimeField('newTxnTime');

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
      const time = getCustomTimeValue('newTxnTime');
      const amountValue = safeNumber(document.getElementById('newTxnAmount')?.value) * 100;
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
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
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
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="form-grid">
        <label class="form-field">
          <span>ประเภท</span>
          <div class="segmented-control">
            <button type="button" class="segmented ${transaction.type === 'expense' ? 'active' : ''}" data-edit-type="expense">รายจ่าย</button>
            <button type="button" class="segmented ${transaction.type === 'income' ? 'active' : ''}" data-edit-type="income">รายรับ</button>
          </div>
        </label>
        <label class="form-field">
          <span>หมวดหมู่</span>
          ${renderCustomSelect('editTxnCategory', mock.categories.map((item) => item.name), transaction.category)}
        </label>
        <label class="form-field">
          <span>รายละเอียด</span>
          <input id="editTxnTitle" value="${transaction.title}" />
        </label>
        <label class="form-field">
          <span>จำนวนเงิน</span>
          <div class="amount-input-wrap">
            <input id="editTxnAmount" type="number" inputmode="decimal" min="0" step="0.01" value="${Math.abs(transaction.amount) / 100}" />
            <span class="amount-input-suffix">฿</span>
          </div>
        </label>
        <label class="form-field">
          <span>วันที่</span>
          ${renderCustomDateField('editTxnDate', transaction.dateKey || new Date().toISOString().slice(0, 10))}
        </label>
        <label class="form-field">
          <span>เวลา</span>
          ${renderCustomTimeField('editTxnTime', transaction.time || '09:00')}
        </label>
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-update-transaction="${transaction.id}">บันทึก</button>
      </div>
    </div>
  `;
  openModal(html);
  bindCustomSelect('editTxnCategory');
  bindCustomDateField('editTxnDate');
  bindCustomTimeField('editTxnTime');

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
      const amountValue = safeNumber(document.getElementById('editTxnAmount')?.value) * 100;
      nextItem.title = document.getElementById('editTxnTitle')?.value || nextItem.title;
      nextItem.category = document.getElementById('editTxnCategory')?.value || nextItem.category;
      nextItem.type = selectedType;
      nextItem.amount = (selectedType === 'income' ? 1 : -1) * amountValue;
      nextItem.time = getCustomTimeValue('editTxnTime');
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

const CATEGORY_ICON_LABELS = {
  utensils: 'อาหาร',
  home: 'ที่พัก',
  bus: 'เดินทาง',
  car: 'รถยนต์',
  fuel: 'น้ำมัน',
  'shopping-bag': 'ช้อปปิ้ง',
  shirt: 'เสื้อผ้า',
  'graduation-cap': 'การศึกษา',
  'book-open': 'หนังสือ',
  clapperboard: 'บันเทิง',
  coffee: 'เครื่องดื่ม',
  'heart-pulse': 'สุขภาพ',
  dumbbell: 'ออกกำลังกาย',
  'paw-print': 'สัตว์เลี้ยง',
  plane: 'เดินทางไกล',
  gift: 'ของขวัญ',
  users: 'ครอบครัว/เพื่อน',
  smartphone: 'มือถือ/เน็ต',
  banknote: 'เงิน',
  briefcase: 'งาน',
  'piggy-bank': 'เงินออม',
  tag: 'อื่นๆ',
};

const CATEGORY_COLOR_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

function openAddCategoryModal() {
  let selectedIcon = CATEGORY_ICON_FALLBACK;

  const html = `
    <div class="modal-card">
      <div class="modal-head">
        <h3>เพิ่มหมวดใหม่</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="form-grid">
        <label class="form-field floating">
          <span>ชื่อหมวดหมู่</span>
          <input id="newCategoryName" placeholder="เช่น ค่าอินเทอร์เน็ต" />
        </label>
        <div class="segmented-control">
          <button type="button" class="segmented active" data-new-category-type="expense">รายจ่าย</button>
          <button type="button" class="segmented" data-new-category-type="income">รายรับ</button>
        </div>
        <label class="form-field floating">
          <span>งบ/เป้าต่อเดือน (บาท)</span>
          <input id="newCategoryLimit" type="number" min="0" value="1000" />
        </label>
      </div>
      <div class="field-label" style="margin-top: var(--space-2);">เลือกไอคอน (ถ้าไม่เลือก จะใช้ไอคอนกลาง)</div>
      <div class="icon-picker-grid">
        ${Object.keys(CATEGORY_ICON_LIBRARY).map((key) => `
          <button type="button" class="icon-picker-btn ${key === selectedIcon ? 'active' : ''}" data-icon-key="${key}" title="${CATEGORY_ICON_LABELS[key] || key}" aria-label="${CATEGORY_ICON_LABELS[key] || key}">
            ${renderCategoryIcon(key)}
          </button>
        `).join('')}
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-save-category="true">บันทึกหมวดหมู่</button>
      </div>
    </div>
  `;
  openModal(html);

  document.querySelectorAll('[data-icon-key]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedIcon = button.dataset.iconKey;
      document.querySelectorAll('[data-icon-key]').forEach((btn) => btn.classList.toggle('active', btn === button));
    });
  });

  document.querySelectorAll('[data-new-category-type]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-new-category-type]').forEach((btn) => btn.classList.toggle('active', btn === button));
    });
  });

  const saveBtn = document.querySelector('[data-save-category]');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('newCategoryName');
      const name = (nameInput?.value || '').trim();
      if (!name) {
        nameInput?.focus();
        return;
      }

      const type = document.querySelector('[data-new-category-type].active')?.dataset.newCategoryType || 'expense';
      const limit = safeNumber(document.getElementById('newCategoryLimit')?.value) * 100;
      const maxSortOrder = mock.categories.reduce((max, item) => Math.max(max, item.sortOrder || 0), 0);
      const nextColor = CATEGORY_COLOR_PALETTE[mock.categories.length % CATEGORY_COLOR_PALETTE.length];

      mock.categories.push({
        id: Date.now(),
        name,
        icon: selectedIcon,
        used: 0,
        limit: limit || 100000,
        percentage: 0,
        type,
        isEssential: false,
        sortOrder: maxSortOrder + 1,
        color: nextColor,
      });

      closeModal();
      renderCategoriesPage();
      showSuccessModal('เพิ่มหมวดหมู่สำเร็จ');
    });
  }
}

function openCategoryDetail(categoryId) {
  const category = mock.categories.find((item) => item.id === Number(categoryId));
  if (!category) return;

  const history = mock.monthlyHistory || [];
  const usedAmount = safeNumber(category.used);
  const limitAmount = safeNumber(category.limit);

  const html = `
    <div class="modal-card wide">
      <div class="modal-head">
        <h3>${category.name}</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="segmented-control">
        <button type="button" class="segmented active" data-category-tab="overview">ภาพรวม</button>
        <button type="button" class="segmented" data-category-tab="history">ประวัติ</button>
      </div>
      <div class="category-detail-card">
        <div class="summary-row"><span>งบที่ตั้ง</span><strong>${formatMoney(limitAmount)}</strong></div>
        <div class="summary-row"><span>ใช้ไปแล้ว</span><strong>${formatMoney(usedAmount)}</strong></div>
        <div class="summary-row"><span>สัดส่วน</span><strong>${Math.round((usedAmount / (limitAmount || 1)) * 100 || 0)}%</strong></div>
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
        data: [Math.max(1, usedAmount), Math.max(1, limitAmount - usedAmount)],
        backgroundColor: ['#14170f', '#eaf5df'],
        borderWidth: 0,
      }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  // ใช้ mock.monthlyHistory จริง (3 เดือนล่าสุด) แทนข้อมูลสมมติ 6 เดือนแบบเดิม
  const historyLabels = history.length ? history.map((item) => item.label) : ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'];
  const historyUsed = history.length ? history.map((item) => safeNumber(item.usage[category.id])) : [120000, 140000, 110000, 170000, 150000, usedAmount];
  const historyBudget = historyLabels.map(() => limitAmount || 90000);

  createChart('categoryHistoryChart', {
    type: 'line',
    data: {
      labels: historyLabels,
      datasets: [{
        // เส้น "ยอดใช้" เป็นเส้นทึบ (ข้อมูลจริง), "งบประมาณ" เป็นเส้นประ (เส้นอ้างอิงเป้าหมาย) ตามธรรมเนียมกราฟงบ
        label: 'ยอดใช้',
        data: historyUsed,
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.12)',
        fill: false,
        borderWidth: 2,
      }, {
        label: 'งบประมาณ',
        data: historyBudget,
        borderColor: '#a86400',
        backgroundColor: 'transparent',
        borderDash: [6, 6],
        fill: false,
        borderWidth: 2,
        pointRadius: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: getComputedStyle(document.body).getPropertyValue('--text').trim() } } },
      scales: {
        x: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--muted').trim() }, grid: { display: false } },
        y: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--muted').trim() }, grid: { color: 'rgba(16,20,11,0.06)' } },
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

    const clearDeepLinkBtn = event.target.closest('[data-clear-deep-link]');
    if (clearDeepLinkBtn) {
      transactionState.categoryFilter = null;
      transactionState.monthFilter = null;
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
          <div class="modal-head"><h3>${plan.name}</h3><button class="close-btn" data-close-modal="true" type="button">${renderIcon('x')}</button></div>
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
          <div class="modal-head"><h3>แก้ไขแผน</h3><button class="close-btn" data-close-modal="true" type="button">${renderIcon('x')}</button></div>
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

  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', openAddCategoryModal);
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

function bindHeroActions() {
  const heroAddBtn = document.querySelector('[data-hero-action="add"]');
  if (heroAddBtn) {
    heroAddBtn.addEventListener('click', openAddTransactionModal);
  }

  const heroFigureToggle = document.getElementById('heroFigureToggle');
  if (heroFigureToggle) {
    heroFigureToggle.addEventListener('click', () => {
      dashboardState.heroView = dashboardState.heroView === 'remaining' ? 'safe' : 'remaining';
      renderDashboard();
    });
  }
}

function getRemainingThisMonth() {
  const history = mock.monthlyHistory || [];
  const currentMonth = history[history.length - 1];
  if (!currentMonth) return 0;
  const expenseCategories = mock.categories.filter((item) => item.type === 'expense');
  const totalLimit = expenseCategories.reduce((sum, item) => sum + safeNumber(item.limit), 0);
  const totalUsed = expenseCategories.reduce((sum, item) => sum + safeNumber(currentMonth.usage[item.id]), 0);
  return totalLimit - totalUsed;
}

function bindSettingsActions() {
  const rotateButton = document.getElementById('rotateTokenBtn');
  if (rotateButton) {
    rotateButton.addEventListener('click', () => {
      showSuccessModal('token ใหม่ถูกสร้างเรียบร้อยแล้ว');
    });
  }
}

function applyTransactionDeepLinkFilter() {
  const params = new URLSearchParams(window.location.search);
  const categoryId = Number(params.get('category'));
  if (!categoryId) return;

  const category = mock.categories.find((item) => item.id === categoryId);
  if (!category) return;

  transactionState.categoryFilter = category.name;
  transactionState.monthFilter = params.get('month') || null;

  transactionState.activeTab = category.type;
  document.querySelectorAll('.tab[data-filter]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.filter === category.type);
  });
}

function initializePage() {
  bindTransactionControls();
  bindSettingsActions();
  bindHeroActions();

  const pageName = document.body.dataset.page;
  if (pageName === 'dashboard') renderDashboard();
  if (pageName === 'transactions') {
    applyTransactionDeepLinkFilter();
    renderTransactionsPage();
  }
  if (pageName === 'categories') renderCategoriesPage();
  if (pageName === 'analyze') renderAnalyzePage();
}

document.addEventListener('DOMContentLoaded', initializePage);