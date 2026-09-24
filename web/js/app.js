// ชุดไอคอนหมวดหมู่ (Lucide) ที่ผู้ใช้เลือกได้ตอนสร้าง/แก้หมวดหมู่ — ครอบคลุมหมวดทั่วไปที่สุด
// หมวดไหนไม่มีไอคอนที่ตรง (หรือชื่อ key ไม่ตรงกับ key ในนี้เลย เช่น data เก่า/พิมพ์ผิด) จะ fallback ไปที่ "tag" อัตโนมัติ
// ป้องกันเคส "หมวดหมู่ไม่มีไอคอน" ไม่ให้เกิดขึ้นได้เลย ไม่ว่าผู้ใช้จะตั้งชื่อหมวดว่าอะไรก็ตาม
/**
 * ไอคอน -> อีโมจิ (ใช้ตอนบันทึกหมวดใหม่)
 *
 * ตาราง categories เก็บได้แค่ช่อง emoji ไม่มีช่องเก็บชื่อไอคอน
 * ถ้าไม่แปลง ไอคอนที่ผู้ใช้เลือกจะหายทันทีที่รีเฟรช แล้วกลายเป็นไอคอนกลางหมด
 * — ผู้ใช้จะคิดว่า "เลือกไอคอนไม่ได้" ทั้งที่บันทึกไปแล้วแต่แปลกลับไม่ได้
 * ขาเข้าอยู่ที่ boot.js (EMOJI_TO_ICON) ต้องแก้คู่กันเสมอ
 */
const ICON_TO_EMOJI = {
  utensils: '🍜', home: '🏠', bus: '🚗', car: '🚙', fuel: '⛽',
  'shopping-bag': '🛍️', shirt: '👕', 'graduation-cap': '📚', 'book-open': '📖',
  clapperboard: '🎮', coffee: '☕', 'heart-pulse': '💊', dumbbell: '🏋️',
  'paw-print': '🐾', plane: '✈️', gift: '🎁', users: '👥', smartphone: '📱',
  banknote: '💰', briefcase: '💵', 'piggy-bank': '🐖', tag: '📦',
};

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

/**
 * หนีอักขระ HTML ก่อนยัดข้อความของผู้ใช้ลง innerHTML
 *
 * 🔴 จำเป็นจริง ไม่ใช่กันไว้เฉยๆ: ชื่อรายการจากอีเมลธนาคารมาจากหัวข้ออีเมล
 * ซึ่งมีเครื่องหมาย " และ & ได้ตามปกติ ถ้าไม่หนี:
 *   - ใน value="..." เครื่องหมาย " จะปิด attribute กลางทาง ช่องกรอกโชว์ข้อความขาดครึ่ง
 *   - < > จะถูกอ่านเป็นแท็ก ทำให้การ์ดเพี้ยนหรือฝัง HTML ที่เราไม่ได้เขียนเข้ามาได้
 * หนีเครื่องหมายคำพูดทั้งสองแบบ จึงใช้ได้ทั้งใน attribute และใน text node
 */
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

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
  'trash-2': '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  'arrow-left-right': '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  'more-vertical': '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'trending-up': '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  'trending-down': '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
  'bar-chart-3': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  'layout-grid': '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
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

function getMonthBounds(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}

const defaultMonthBounds = getMonthBounds(new Date());

const transactionState = {
  activeTab: 'all',
  searchValue: '',
  rangeStart: defaultMonthBounds.start,
  rangeEnd: defaultMonthBounds.end,
  multiSelect: false,
  selectedIds: [],
  visibleIds: [],
  categoryFilter: null,
  monthFilter: null,
};

const categoryState = {
  activeTab: 'all',
  sortMode: false,
  draftOrder: [],
  searchValue: '',
};

const dashboardState = {
  budgetBreakdownOpen: false,
  heroPeriod: 'daily', // ช่วงเวลาที่การ์ดบนสุดโชว์: daily | weekly | monthly
  activeType: 'expense',
  activeMonthKey: (mock.monthlyHistory && mock.monthlyHistory[mock.monthlyHistory.length - 1]?.key) || null,
};

const pageState = {
  planWizard: { step: 1, name: '', amount: '', months: '', mode: 'balanced', emergency: false },
};

/**
 * เทียบ id แบบไม่สนชนิด — ข้อมูลตัวอย่างใช้ id เป็นตัวเลข แต่ API จริงใช้ UUID ที่เป็นข้อความ
 * ถ้าใช้ Number() แปลงเหมือนเดิม UUID จะกลายเป็น NaN แล้วหาอะไรไม่เจอเลยสักอย่าง
 */
function sameId(a, b) {
  return String(a) === String(b);
}

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
    // หมวดที่ยังไม่ตั้งงบและยังไม่มียอดใช้ ไม่ต้องโชว์เป็นแถว ฿0.00 ให้รก
    .filter((item) => safeNumber(item.limit) > 0 || safeNumber(activeMonth.usage[item.id]) > 0)
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((item) => ({
      ...item,
      used: safeNumber(activeMonth.usage[item.id]),
    }));

  const totalUsed = rows.reduce((sum, item) => sum + item.used, 0);
  const totalLimit = rows.reduce((sum, item) => sum + safeNumber(item.limit), 0);
  const percent = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;

  dashboardBudgetTip.data.clear();
  const typeLabel = activeType === 'income' ? 'รายรับ' : 'รายจ่าย';
  const segmentsHtml = rows
    .map((item) => {
      const sharePercent = totalUsed > 0 ? (item.used / totalUsed) * 100 : 0;
      if (sharePercent <= 0) return '';
      const key = `cat-${item.id}`;
      dashboardBudgetTip.data.set(key, {
        name: item.name,
        color: item.color,
        used: item.used,
        limit: safeNumber(item.limit),
        sharePercent,
        categoryPercent: item.limit ? (item.used / item.limit) * 100 : 0,
        isIncome: activeType === 'income',
        shareLabel: `ของ${typeLabel}เดือนนี้`,
      });
      return `<button type="button" class="stacked-bar-seg" data-overview-seg="${key}" style="width: ${sharePercent}%; background: ${item.color}" aria-label="${escapeHtml(item.name)}"></button>`;
    })
    .join('');

  const legendRows = rows
    .map((item) => {
      const itemPercent = clamp(((item.used || 0) / (item.limit || 1)) * 100);
      return `
        <div class="budget-legend-row" data-budget-category="${item.id}">
          <div class="budget-legend-head">
            <span class="legend-dot" style="background: ${item.color}"></span>
            <span>${escapeHtml(item.name)}</span>
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

    <div class="stacked-bar has-tip" id="dashboardBudgetBar">${segmentsHtml}</div>
    <div class="overview-tip" id="dashboardBudgetTip" hidden></div>

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

  bindBarTip(dashboardBudgetTip);

  // แถบสัดส่วนใช้ popover แทนแล้ว เหลือแถวใน legend ที่กดเปิดรายละเอียด + ลิงก์ไปหน้าประวัติ
  container.querySelectorAll('.budget-legend-row[data-budget-category]').forEach((el) => {
    el.addEventListener('click', () => {
      const category = rows.find((item) => sameId(item.id, el.dataset.budgetCategory));
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
        <h3><span class="legend-dot" style="background: ${category.color}"></span> ${escapeHtml(category.name)}</h3>
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
// แผนเก็บเงินบนหน้าสรุป: แสดงย่อๆ ไม่เกิน 3 แผน (แผนที่หลุดเป้าขึ้นก่อน) แตะแล้วเปิดรายละเอียด ดูทั้งหมดที่หน้าวิเคราะห์
const DASHBOARD_PLAN_LIMIT = 3;

function renderDashboardPlans() {
  const container = document.getElementById('dashboardPlans');
  if (!container) return;

  const rank = (plan) => (plan.status === 'off_track' ? 0 : plan.status === 'completed' ? 2 : 1);
  const plans = mock.plans
    .filter((plan) => plan.active !== false)
    .sort((a, b) => rank(a) - rank(b) || (b.progress || 0) - (a.progress || 0));
  const shown = plans.slice(0, DASHBOARD_PLAN_LIMIT);

  const rows = shown.map((plan) => {
    const status = plan.status === 'off_track'
      ? '<span class="pill warning">หลุดเป้า</span>'
      : plan.status === 'completed' ? '<span class="pill success">ครบแล้ว</span>' : '';
    const percent = Math.round(clamp(plan.progress || 0));
    return `
      <button type="button" class="dash-plan" data-plan-detail="${plan.id}">
        <span class="dash-plan-icon">${renderCategoryIcon('piggy-bank')}</span>
        <span class="dash-plan-main">
          <span class="dash-plan-top"><strong>${escapeHtml(plan.name)}</strong>${status}</span>
          <span class="dash-plan-bar"><i style="width: ${percent}%"></i></span>
        </span>
        <span class="dash-plan-pct">${percent}%</span>
      </button>
    `;
  }).join('');

  container.innerHTML = `
    <div class="panel-head">
      <h3>แผนเก็บเงิน</h3>
      <a href="analyze.html#plans">${plans.length > shown.length ? `ดูทั้งหมด (${plans.length})` : 'ดูทั้งหมด'}</a>
    </div>
    ${shown.length
      ? `<div class="dash-plan-list">${rows}</div>`
      : `<button type="button" class="dash-plan-empty" data-dashboard-create-plan="true">+ สร้างแผนเก็บเงินแรก</button>`}
  `;

  if (!container.dataset.bound) {
    container.dataset.bound = 'true';
    container.addEventListener('click', (event) => {
      if (event.target.closest('[data-dashboard-create-plan]')) openPlanWizard();
    });
  }
}

// ============================================================
// เพดานการใช้จ่ายรายวัน / สัปดาห์ / เดือน (ร่าง SPEC §S5.10 — docs/DRAFT_S5.10_spending_limits.md)
//
// ⚠️ ตอนนี้เป็นฝั่งหน้าเว็บล้วนๆ: ยังไม่มี /api/limits จึงเก็บค่าที่ผู้ใช้ตั้งไว้ใน localStorage ของเบราว์เซอร์นี้
// และคำนวณยอดใช้ไปจากรายการที่โหลดมาแล้ว — ต้องย้ายไปให้ backend ทำเมื่อร่างสเปคผ่านทีมรีวิว
// (G1: ห้ามหน้าเว็บคำนวณเงินเอง) ค่าที่ระบบคำนวณให้ (โหมด system) ใช้ R/D ของ §S5.2 ที่ backend ส่งมาเป็นฐาน
// ไม่ได้คิดสูตรใหม่ แต่เป็น "ค่าประมาณสด" ที่ย้อนคำนวณต้นงวดเอง ไม่ใช่ค่าที่ตรึงไว้ตามสเปค
// ============================================================

const SPENDING_LIMITS_KEY = 'jodtang.spendingLimits';
const SPENDING_LIMIT_PERIODS = ['daily', 'weekly', 'monthly'];
const SPENDING_LIMIT_META = {
  daily: { label: 'รายวัน', heroLabel: 'วันนี้', title: 'เพดานรายวัน', icon: 'calendar' },
  weekly: { label: 'รายสัปดาห์', heroLabel: 'สัปดาห์นี้', title: 'เพดานรายสัปดาห์', icon: 'calendar' },
  monthly: { label: 'รายเดือน', heroLabel: 'เดือนนี้', title: 'เพดานรายเดือน', icon: 'calendar' },
};

function defaultSpendingLimit() {
  return { enabled: false, mode: 'system', limitSatang: null };
}

// รูปแบบของโหมด "ให้ระบบคำนวณ" — ตัวคูณ 0.8 ของ "ประหยัด" เป็นสมมติฐานฝั่งหน้าเว็บล้วนๆ
// (เผื่อเงินไว้เพิ่มอีก 20% จากเพดานปกติ) ยังไม่ได้อยู่ในร่าง SPEC §S5.10 ต้องให้ทีมยืนยันตัวเลขจริงอีกที
const SPENDING_PROFILE_KEY = 'jodtang.spendingLimitProfile';
const SPENDING_PROFILE_META = {
  moderate: { label: 'ปานกลาง', factor: 1, hint: 'ใช้เงินที่เหลือทั้งหมดอย่างสม่ำเสมอ ไม่มีเผื่อพิเศษ' },
  frugal: { label: 'ประหยัด', factor: 0.8, hint: 'เพดานตึงกว่าปกติ 20% เผื่อเป็นเงินสำรองเพิ่ม' },
};

function readSpendingProfile() {
  try {
    const value = window.localStorage.getItem(SPENDING_PROFILE_KEY);
    return value === 'frugal' ? 'frugal' : 'moderate';
  } catch (error) {
    return 'moderate';
  }
}

function saveSpendingProfile(profile) {
  try {
    window.localStorage.setItem(SPENDING_PROFILE_KEY, profile);
  } catch (error) {
    // เก็บไม่ได้ก็ยังเลือกได้ในรอบนี้ แค่ไม่จำข้ามหน้า
  }
}

function readSpendingLimits() {
  let raw = {};
  try {
    raw = JSON.parse(window.localStorage.getItem(SPENDING_LIMITS_KEY) || '{}') || {};
  } catch (error) {
    raw = {};
  }
  const result = {};
  SPENDING_LIMIT_PERIODS.forEach((period) => {
    result[period] = { ...defaultSpendingLimit(), ...(raw[period] || {}) };
  });
  return result;
}

function saveSpendingLimit(period, patch) {
  const all = readSpendingLimits();
  all[period] = { ...all[period], ...patch };
  try {
    window.localStorage.setItem(SPENDING_LIMITS_KEY, JSON.stringify(all));
  } catch (error) {
    // เก็บไม่ได้ (เช่น โหมดส่วนตัว) ก็ยังใช้ได้ในหน้านี้ แค่ไม่จำข้ามหน้า
  }
  return all[period];
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysToKey(key, days) {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** วันนี้: ต่อ API จริงใช้วันที่จริง / โหมดตัวอย่างใช้วันล่าสุดของข้อมูลตัวอย่าง เพื่อให้ตัวเลขนิ่ง */
function getLimitToday() {
  if (window.__jodtangApiWired === true) return toDateKey(new Date());
  const ref = getAnalyzeReference();
  return `${ref.year}-${pad2(ref.month)}-${pad2(ref.day)}`;
}

/** สัปดาห์เริ่มวันอาทิตย์ตามปฏิทินไทย (ทีมตกลงแล้ว) — ต่างจาก getWeekStartIso ฝั่ง backend ที่เริ่มวันจันทร์สำหรับเตือนแผนออม */
function getWeekStartSundayKey(key) {
  return addDaysToKey(key, -parseDateKey(key).getDay());
}

/** ยอดรายจ่ายจริงในช่วงวันที่ (รวมปลายทั้งสองข้าง) — type='expense' เท่านั้น โอนเข้าแผนไม่นับ (G7) */
function getSpentInRange(startKey, endKey) {
  return mock.transactions
    .filter((item) => item.type === 'expense' && item.dateKey && item.dateKey >= startKey && item.dateKey <= endKey)
    .reduce((sum, item) => sum + Math.abs(safeNumber(item.amount)), 0);
}

/**
 * เพดาน + ยอดใช้ + สถานะของช่วงเวลาหนึ่ง
 * available=false เมื่อคำนวณให้แม่นยำไม่ได้ (โหมด system ของสัปดาห์ที่คาบสองเดือน ต้องมี R/D ของเดือนหน้าซึ่งมีแต่ backend)
 * ห้ามเดาตัวเลขมาแทน — แสดงว่า "คำนวณไม่ได้" ดีกว่าโชว์เลขผิด
 */
function getSpendingLimitInfo(period) {
  const setting = readSpendingLimits()[period];
  const today = getLimitToday();
  const info = { period, enabled: setting.enabled, mode: setting.mode, available: true, ceiling: 0, used: 0, remaining: 0, percent: 0, tone: 'success', note: '' };
  if (!setting.enabled) return info;

  const remainingMonth = getRemainingThisMonth();
  // D ตาม §S5.2 = วันที่เหลือในเดือนรวมวันนี้
  const daysLeft = typeof mock.summary.daysLeft === 'number' ? mock.summary.daysLeft : getAnalyzeReference().daysLeft + 1;
  const daysLeftSafe = Math.max(1, daysLeft);

  if (period === 'daily') {
    info.used = getSpentInRange(today, today);
  } else if (period === 'weekly') {
    info.used = getSpentInRange(getWeekStartSundayKey(today), today);
  } else {
    info.used = safeNumber(mock.summary.expense);
  }

  if (setting.mode === 'manual' && safeNumber(setting.limitSatang) > 0) {
    info.ceiling = safeNumber(setting.limitSatang);
  } else if (period === 'daily') {
    // ย้อนกลับไปต้นวัน: เอายอดที่ใช้วันนี้บวกกลับเข้า R ก่อนหาร D
    info.ceiling = Math.max(0, Math.floor((remainingMonth + info.used) / daysLeftSafe));
  } else if (period === 'weekly') {
    const weekStart = getWeekStartSundayKey(today);
    const weekEnd = addDaysToKey(weekStart, 6);
    if (weekStart.slice(0, 7) !== weekEnd.slice(0, 7)) {
      info.available = false;
      info.note = 'สัปดาห์นี้คาบสองเดือน ระบบยังคำนวณเพดานให้แม่นยำไม่ได้ ลองตั้งเองแทนได้';
      return info;
    }
    const elapsed = Math.round((parseDateKey(today) - parseDateKey(weekStart)) / 86400000);
    info.ceiling = Math.max(0, Math.floor(((remainingMonth + info.used) / (daysLeftSafe + elapsed)) * 7));
  } else {
    // §S5.10.2: เพดานรายเดือน = ใช้ไปแล้ว + R
    info.ceiling = Math.max(0, info.used + remainingMonth);
  }

  // โหมด manual เป็นตัวเลขที่ผู้ใช้กรอกเองแล้ว ไม่ต้องคูณตามรูปแบบ — คูณเฉพาะเพดานที่ระบบคำนวณให้
  if (setting.mode !== 'manual') {
    info.profile = readSpendingProfile();
    info.ceiling = Math.max(0, Math.floor(info.ceiling * SPENDING_PROFILE_META[info.profile].factor));
  }

  info.remaining = info.ceiling - info.used;
  info.percent = info.ceiling > 0 ? Math.round((info.used / info.ceiling) * 100) : (info.used > 0 ? 100 : 0);
  info.tone = info.percent >= 100 ? 'danger' : info.percent >= 80 ? 'warning' : 'success';
  info.note = info.remaining < 0
    ? `เกินเพดานไปแล้ว ${formatMoney(Math.abs(info.remaining))}`
    : info.percent >= 80 ? `ใกล้ถึงเพดานแล้ว (${info.percent}%)` : '';
  if (setting.mode === 'system') {
    info.note = [info.note, 'ระบบคำนวณจากเงินที่เหลือของเดือนนี้ ค่าอาจขยับเมื่อรายรับเปลี่ยน'].filter(Boolean).join(' · ');
  }
  return info;
}

/** ผู้ใช้ยังไม่มีข้อมูลเลย — ห้ามโชว์ ฿0 ลอยๆ เพราะอ่านได้ว่า "ฉันมีเงินศูนย์บาท" (UI_CONTRACT ข้อ unavailable) */
function hasNoDataYet() {
  return safeNumber(mock.summary.transactionCount) === 0
    && safeNumber(mock.summary.income) === 0
    && safeNumber(mock.summary.expense) === 0;
}

function renderHeroPeriod() {
  const period = dashboardState.heroPeriod;
  const meta = SPENDING_LIMIT_META[period];
  const periodLabel = document.getElementById('heroPeriodLabel');
  const figureLabel = document.getElementById('heroFigureLabel');
  const figure = document.getElementById('heroSafeToSpend');
  const limitBox = document.getElementById('heroLimit');
  const setupLink = document.getElementById('heroLimitSetup');
  const safeLine = document.getElementById('heroSafeLine');
  if (!figureLabel || !figure) return;

  if (periodLabel) periodLabel.textContent = meta.heroLabel;
  const info = getSpendingLimitInfo(period);
  const overspent = safeNumber(mock.summary.overspent);
  const noData = hasNoDataYet();

  if (limitBox) limitBox.hidden = true;
  if (setupLink) setupLink.hidden = info.enabled;
  if (safeLine) safeLine.hidden = true;

  // ⚖️ SPEC P0 ข้อ 4: safe-to-spend ต้องเห็นได้บนหน้าสรุปเสมอ ห้ามถูกเพดานที่ผู้ใช้ตั้งเองบังจนหาย
  // และถ้าเพดานที่ตั้งเองสูงกว่าที่ระบบคำนวณว่าปลอดภัย ต้องเตือน ไม่ใช่เชียร์ให้ใช้ตามเพดาน
  function renderSafeLine() {
    if (!safeLine) return;
    if (noData) {
      safeLine.hidden = false;
      safeLine.className = 'hero-safe-line';
      safeLine.innerHTML = 'ยังไม่มีข้อมูลพอคำนวณ — เริ่มจากพิมพ์รายการแรกในแชท LINE';
      return;
    }
    if (overspent > 0) {
      safeLine.hidden = false;
      safeLine.className = 'hero-safe-line warn';
      safeLine.innerHTML = `เดือนนี้ใช้เกินไปแล้ว <strong>${formatMoney(overspent)}</strong>`;
      return;
    }
    if (period !== 'daily' || !info.enabled) return;
    const safe = safeNumber(mock.summary.safeToSpend);
    safeLine.hidden = false;
    if (info.ceiling > safe) {
      safeLine.className = 'hero-safe-line warn';
      safeLine.innerHTML = `เพดานที่ตั้งไว้สูงกว่าที่ระบบคำนวณว่าปลอดภัย — วันนี้ควรใช้ไม่เกิน <strong>${formatMoney(safe)}</strong>`;
    } else {
      safeLine.className = 'hero-safe-line';
      safeLine.innerHTML = `ระบบคำนวณว่าวันนี้ใช้ได้อย่างปลอดภัย <strong>${formatMoney(safe)}</strong>`;
    }
  }

  if (!info.enabled) {
    if (period === 'daily') {
      if (noData) {
        figureLabel.textContent = 'ใช้ได้อย่างปลอดภัยวันนี้';
        figure.textContent = 'ยังไม่มีข้อมูล';
      } else if (overspent > 0) {
        // สัญญาข้อ safeToSpend: เกินแล้วต้องบอกว่าเกินเท่าไหร่ ห้ามโชว์ ฿0 เฉยๆ
        figureLabel.textContent = 'เดือนนี้ใช้เกินงบไปแล้ว';
        figure.textContent = formatMoney(overspent);
      } else {
        figureLabel.textContent = 'ใช้ได้อย่างปลอดภัยวันนี้';
        figure.textContent = formatMoney(mock.summary.safeToSpend);
      }
    } else if (period === 'monthly') {
      figureLabel.textContent = 'เงินที่เหลือในเดือนนี้';
      figure.textContent = noData ? 'ยังไม่มีข้อมูล' : formatMoney(getRemainingThisMonth());
    } else {
      figureLabel.textContent = 'เพดานรายสัปดาห์';
      figure.textContent = 'ยังไม่ได้ตั้ง';
    }
    renderSafeLine();
    return;
  }

  if (!info.available) {
    figureLabel.textContent = meta.title;
    figure.textContent = 'คำนวณไม่ได้';
    if (limitBox) {
      limitBox.hidden = false;
      const bar = document.getElementById('heroLimitBar');
      if (bar) bar.style.width = '0%';
      document.getElementById('heroLimitUsed').textContent = '—';
      document.getElementById('heroLimitCeiling').textContent = '—';
      document.getElementById('heroLimitNote').textContent = info.note;
    }
    renderSafeLine();
    return;
  }

  figureLabel.textContent = info.remaining >= 0 ? `เหลือใช้ได้ในเพดาน${meta.label}` : `เกินเพดาน${meta.label}`;
  figure.textContent = formatMoney(Math.abs(info.remaining));
  if (limitBox) {
    limitBox.hidden = false;
    limitBox.dataset.tone = info.tone;
    const bar = document.getElementById('heroLimitBar');
    if (bar) bar.style.width = `${clamp(info.percent)}%`;
    document.getElementById('heroLimitUsed').textContent = formatMoney(info.used);
    document.getElementById('heroLimitCeilingLabel').textContent = meta.title;
    document.getElementById('heroLimitCeiling').textContent = formatMoney(info.ceiling);
    document.getElementById('heroLimitNote').textContent = info.note;
  }
  renderSafeLine();
}

function openHeroPeriodModal() {
  const rows = SPENDING_LIMIT_PERIODS.map((period) => {
    const info = getSpendingLimitInfo(period);
    const meta = SPENDING_LIMIT_META[period];
    const state = info.enabled ? (info.available ? `เพดาน ${formatMoney(info.ceiling)}` : 'เปิดอยู่') : 'ยังไม่ได้ตั้งเพดาน';
    return `
      <button class="settings-row ${period === dashboardState.heroPeriod ? 'active-row' : ''}" type="button" data-hero-period="${period}">
        <span>${meta.heroLabel}<small style="display:block;color:var(--muted);font-size:0.74rem">${state}</small></span>
        <strong>›</strong>
      </button>
    `;
  }).join('');

  openModal(`
    <div class="modal-card small">
      <div class="modal-head">
        <h3>ดูตามช่วงเวลา</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="settings-list">${rows}</div>
    </div>
  `);

  document.querySelectorAll('[data-hero-period]').forEach((button) => {
    button.addEventListener('click', () => {
      dashboardState.heroPeriod = button.dataset.heroPeriod;
      closeModal();
      renderHeroPeriod();
    });
  });
}

// ---------- ตั้งค่าเพดาน (หน้าตั้งค่า) ----------

function renderSpendingLimitSettings() {
  const container = document.getElementById('spendingLimitList');
  if (!container) return;

  // ปุ่มเลือกรูปแบบของโหมด "ให้ระบบคำนวณ" — อยู่นอก #spendingLimitList จึงผูก/วาดแยกที่นี่
  const profilePicker = document.getElementById('spendingLimitProfile');
  if (profilePicker) {
    const activeProfile = readSpendingProfile();
    profilePicker.querySelectorAll('[data-limit-profile]').forEach((button) => {
      button.classList.toggle('active', button.dataset.limitProfile === activeProfile);
    });
    if (!profilePicker.dataset.bound) {
      profilePicker.dataset.bound = 'true';
      profilePicker.addEventListener('click', (event) => {
        const button = event.target.closest('[data-limit-profile]');
        if (!button) return;
        saveSpendingProfile(button.dataset.limitProfile);
        refreshSpendingLimitViews();
      });
    }
  }

  container.innerHTML = SPENDING_LIMIT_PERIODS.map((period) => {
    const setting = readSpendingLimits()[period];
    const meta = SPENDING_LIMIT_META[period];
    const info = getSpendingLimitInfo(period);
    let summary = 'ปิดอยู่';
    if (setting.enabled) {
      summary = !info.available ? 'เปิดอยู่ · คำนวณไม่ได้ในสัปดาห์นี้'
        : `เพดานตอนนี้ ${formatMoney(info.ceiling)} · ${setting.mode === 'manual' ? 'ตั้งเอง' : `ระบบคำนวณ · ${SPENDING_PROFILE_META[readSpendingProfile()].label}`}`;
    }
    return `
      <div class="limit-row" data-limit-period="${period}">
        <div class="limit-row-head">
          <span class="an-action-icon">${renderIcon(meta.icon)}</span>
          <div class="an-action-text">
            <strong>${meta.title}</strong>
            <small>${summary}</small>
          </div>
          <button type="button" class="switch ${setting.enabled ? 'on' : ''}" role="switch" aria-checked="${setting.enabled}" aria-label="เปิดเพดาน${meta.label}" data-limit-toggle="${period}"></button>
        </div>
        ${setting.enabled ? `
          <div class="limit-row-body">
            <div class="segmented-control">
              <button type="button" class="segmented ${setting.mode === 'system' ? 'active' : ''}" data-limit-mode="${period}:system">ให้ระบบคำนวณ</button>
              <button type="button" class="segmented ${setting.mode === 'manual' ? 'active' : ''}" data-limit-mode="${period}:manual">ตั้งเอง</button>
            </div>
            ${setting.mode === 'manual' ? `
              <button type="button" class="settings-row" data-limit-amount="${period}">
                <span>จำนวนเงินต่อ${meta.heroLabel === 'วันนี้' ? 'วัน' : meta.heroLabel === 'สัปดาห์นี้' ? 'สัปดาห์' : 'เดือน'}</span>
                <strong>${safeNumber(setting.limitSatang) > 0 ? formatMoney(setting.limitSatang) : 'แตะเพื่อกรอก'}</strong>
              </button>` : ''}
          </div>` : ''}
      </div>
    `;
  }).join('');

  if (container.dataset.bound) return;
  container.dataset.bound = 'true';
  container.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-limit-toggle]');
    if (toggle) {
      const period = toggle.dataset.limitToggle;
      const next = !readSpendingLimits()[period].enabled;
      saveSpendingLimit(period, { enabled: next });
      refreshSpendingLimitViews();
      return;
    }
    const modeBtn = event.target.closest('[data-limit-mode]');
    if (modeBtn) {
      const [period, mode] = modeBtn.dataset.limitMode.split(':');
      saveSpendingLimit(period, { mode });
      refreshSpendingLimitViews();
      if (mode === 'manual' && !(safeNumber(readSpendingLimits()[period].limitSatang) > 0)) {
        promptSpendingLimitAmount(period);
      }
      return;
    }
    const amountBtn = event.target.closest('[data-limit-amount]');
    if (amountBtn) promptSpendingLimitAmount(amountBtn.dataset.limitAmount);
  });
}

function promptSpendingLimitAmount(period) {
  const meta = SPENDING_LIMIT_META[period];
  openAmountInputModal(readSpendingLimits()[period].limitSatang || 0, (amount) => {
    saveSpendingLimit(period, { limitSatang: amount, mode: 'manual' });
    refreshSpendingLimitViews();
  }, meta.title);
}

/** วาดใหม่ทุกที่ที่กำลังแสดงเพดานอยู่บนหน้านี้ (แต่ละฟังก์ชันเช็ค element เองแล้วว่าไม่มีก็ไม่ทำอะไร) */
function refreshSpendingLimitViews() {
  renderSpendingLimitSettings();
  renderHeroPeriod();
}

function renderDashboard() {
  const summary = mock.summary;
  const heroConfidenceBadge = document.getElementById('heroConfidenceBadge');
  const heroSafeToSpend = document.getElementById('heroSafeToSpend');
  const heroFigureLabel = document.getElementById('heroFigureLabel');
  const transactionList = document.getElementById('transactionList');

  renderMonthlyBudgetSummary();
  renderDashboardPlans();

  if (heroConfidenceBadge) {
    heroConfidenceBadge.innerHTML = renderConfidenceBadge(summary.safeToSpendConfidence || 'high');
  }

  renderHeroPeriod();

  if (transactionList) {
    transactionList.innerHTML = mock.transactions
      .slice(0, 4)
      .map((item) => {
        const amount = Number(item.amount || 0);
        // ⚖️ G7: เงินโอนเข้าแผนออมไม่ใช่รายจ่าย แสดงให้เป็นกลาง ไม่ติดลบ ไม่ย้อมสีแดง
        const transfer = isTransfer(item);
        const sign = transfer ? '' : amount >= 0 ? '+' : '-';
        const icon = renderIcon(transfer ? 'arrow-left-right' : item.type === 'income' ? 'wallet' : 'receipt');
        const displayAmount = formatMoney(Math.abs(amount));
        const aiBadge = item.parsedBy === 'ai' ? `<span class="ai-tag">${renderIcon('sparkles')} AI</span>` : '';

        return `
          <li class="transaction-item">
            <div class="transaction-left">
              <div class="transaction-icon">${icon}</div>
              <div class="transaction-text">
                <strong>${escapeHtml(item.title)}${aiBadge}</strong>
                <small>${transfer ? 'โอนเข้าแผนออม' : item.category} • ${item.time}</small>
              </div>
            </div>
            <span class="amount ${transfer ? 'transfer' : item.type}">${sign}${displayAmount}</span>
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
// วาง popover ด้วย position:fixed คำนวณพิกัดจาก viewport ตรงๆ (ไม่ใช้ position:absolute ผูกกับ
// .custom-select) เพราะถ้า trigger อยู่ใน modal ที่มี overflow-y:auto, popover แบบ absolute จะโดน
// clip ทันทีที่ล้นกรอบเนื้อหาเดิมของ modal (ไม่ว่าจะกางขึ้นหรือลงก็โดนตัดเหมือนกัน เพราะ absolute
// ไม่ได้ขยาย content box ของ modal-card ให้กว้างขึ้นตาม) position:fixed หลุดพ้นการ clip ของ ancestor ได้เลย
function positionPopoverDirection(trigger, popover, estimatedHeight) {
  const rect = trigger.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;

  popover.style.position = 'fixed';
  popover.style.left = `${rect.left}px`;
  popover.style.width = `${rect.width}px`;
  if (openUpward) {
    popover.style.top = '';
    popover.style.bottom = `${viewportHeight - rect.top + 6}px`;
  } else {
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.bottom = '';
  }
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
        <span data-select-display>${escapeHtml(selected)}</span>
        ${renderIcon('chevron-down', 'trigger-icon')}
      </button>
      <div class="popover-panel select-popover" hidden data-select-popover>
        ${options.map((option) => `<button type="button" class="select-option ${option === selected ? 'active' : ''}" data-select-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}
      </div>
      <input type="hidden" id="${fieldId}" value="${escapeHtml(selected)}" />
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

function formatRangeLabel(start, end) {
  if (!start || !end) return 'เลือกช่วงวันที่';
  if (start === end) return formatDateDisplay(start);
  return `${formatDateDisplay(start)} — ${formatDateDisplay(end)}`;
}

function buildRangeCalendarHtml(year, month, rangeStart, rangeEnd) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) {
    cells.push('<div class="calendar-empty"></div>');
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const value = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let cls = '';
    if (rangeStart && rangeEnd && value > rangeStart && value < rangeEnd) cls += ' in-range';
    if (rangeStart && value === rangeStart) cls += ' range-start';
    if (rangeEnd && value === rangeEnd) cls += ' range-end';
    cells.push(`<button type="button" class="calendar-day${cls}" data-range-date="${value}">${day}</button>`);
  }
  const monthLabel = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', calendar: 'gregory' }).format(new Date(year, month, 1));
  return { cellsHtml: cells.join(''), monthLabel };
}

// ตัวเลือกช่วงวันที่แบบ 2 คลิก: คลิกแรกตั้งจุดเริ่ม, คลิกที่สองตั้งจุดจบ (ถ้าคลิกวันที่ก่อนจุดเริ่ม จะสลับให้เป็นจุดเริ่มใหม่แทน)
function buildDatePickerModal() {
  let pendingStart = transactionState.rangeStart;
  let pendingEnd = transactionState.rangeEnd;
  let awaitingSecondClick = false;
  let viewDate = pendingStart ? new Date(`${pendingStart}T00:00:00`) : new Date();

  function renderBody() {
    const { cellsHtml, monthLabel } = buildRangeCalendarHtml(viewDate.getFullYear(), viewDate.getMonth(), pendingStart, pendingEnd);
    const body = document.getElementById('dateRangeBody');
    const label = document.getElementById('dateRangeLabel');
    if (label) label.textContent = formatRangeLabel(pendingStart, pendingEnd);
    if (!body) return;
    body.innerHTML = `
      <div class="calendar-nav">
        <div class="calendar-nav-group">
          <button type="button" class="icon-btn small" data-range-prev-year>${renderIcon('chevrons-left')}</button>
          <button type="button" class="icon-btn small" data-range-prev>${renderIcon('chevron-left')}</button>
        </div>
        <strong>${monthLabel}</strong>
        <div class="calendar-nav-group">
          <button type="button" class="icon-btn small" data-range-next>${renderIcon('chevron-right')}</button>
          <button type="button" class="icon-btn small" data-range-next-year>${renderIcon('chevrons-right')}</button>
        </div>
      </div>
      <div class="calendar-weekday-row"><span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span></div>
      <div class="calendar-grid">${cellsHtml}</div>
    `;
    body.querySelector('[data-range-prev-year]').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1); renderBody(); });
    body.querySelector('[data-range-next-year]').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1); renderBody(); });
    body.querySelector('[data-range-prev]').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderBody(); });
    body.querySelector('[data-range-next]').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderBody(); });
    body.querySelectorAll('[data-range-date]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.rangeDate;
        if (!awaitingSecondClick) {
          pendingStart = value;
          pendingEnd = value;
          awaitingSecondClick = true;
        } else if (value < pendingStart) {
          pendingEnd = pendingStart;
          pendingStart = value;
          awaitingSecondClick = false;
        } else {
          pendingEnd = value;
          awaitingSecondClick = false;
        }
        renderBody();
      });
    });
  }

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>เลือกช่วงวันที่</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <p class="range-label" id="dateRangeLabel">${formatRangeLabel(pendingStart, pendingEnd)}</p>
      <div id="dateRangeBody"></div>
      <div class="modal-actions split">
        <button class="secondary-btn" type="button" data-range-this-month="true">เดือนนี้</button>
        <button class="primary-btn" type="button" data-apply-dates="true">ใช้ช่วงนี้</button>
      </div>
    </div>
  `;

  openModal(html);
  renderBody();

  document.querySelector('[data-range-this-month]').addEventListener('click', () => {
    const bounds = getMonthBounds(new Date());
    pendingStart = bounds.start;
    pendingEnd = bounds.end;
    awaitingSecondClick = false;
    viewDate = new Date();
    renderBody();
  });

  const applyBtn = document.querySelector('[data-apply-dates]');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      transactionState.rangeStart = pendingStart;
      transactionState.rangeEnd = pendingEnd;
      closeModal();
      renderTransactionsPage();
    });
  }
}

/** ข้อความใต้การ์ดสรุปตอนที่ยอดรวมของช่วง/หมวดที่เลือกยังคำนวณให้ไม่ได้ */
function showRangeSummaryNote(show) {
  const card = document.querySelector('.an-summary');
  if (!card) return;
  let note = document.getElementById('rangeSummaryNote');
  if (!show) {
    if (note) note.remove();
    return;
  }
  if (!note) {
    note = document.createElement('p');
    note.id = 'rangeSummaryNote';
    note.className = 'hero-limit-note';
    card.append(note);
  }
  note.textContent = 'ยอดรวมแสดงได้เฉพาะทั้งเดือนนี้ ถ้ากรองหมวดหรือเลือกช่วงวันเอง ระบบยังสรุปยอดให้ไม่ได้ (รายการด้านล่างยังกรองถูกต้อง)';
}

function renderTransactionsPage() {
  const incomeSummary = document.getElementById('incomeSummary');
  const expenseSummary = document.getElementById('expenseSummary');
  const transactionTable = document.getElementById('transactionTable');
  const searchInput = document.getElementById('transactionSearch');
  const selectedDateChips = document.getElementById('selectedDateChips');
  const multiSelectBtn = document.getElementById('toggleMultiSelectBtn');
  const batchActionBar = document.getElementById('batchActionBar');
  const summaryPeriodBtn = document.getElementById('summaryPeriodBtn');

  // สรุปรายรับ/รายจ่ายบนสุด สโคปตามช่วงวันที่+หมวดหมู่เดียวกับรายการด้านล่าง (ไม่กรองตามแท็บรายรับ/รายจ่าย
  // เพราะการ์ดนี้ต้องโชว์ทั้งสองยอดพร้อมกันเสมอ)
  const summarySource = mock.transactions.filter((item) => {
    const matchesDate = !transactionState.rangeStart || !transactionState.rangeEnd
      || Boolean(item.dateKey && item.dateKey >= transactionState.rangeStart && item.dateKey <= transactionState.rangeEnd);
    const matchesCategory = !transactionState.categoryFilter || item.category === transactionState.categoryFilter;
    return matchesDate && matchesCategory;
  });
  // ⚖️ G1: ห้ามบวกยอดเงินเองในหน้าเว็บ — ยอดรวมต้องมาจาก API
  // backend มี /api/summary ให้เฉพาะ "เดือนปัจจุบัน" ยังไม่มี endpoint สรุปตามช่วงวันที่ที่ผู้ใช้เลือกเอง
  // ช่วงอื่นจึงแสดงว่ายังไม่มีข้อมูล แทนที่จะบวกจากรายการที่โหลดมา (ซึ่งถูกตัดที่ 200 รายการ จะได้ยอดผิด)
  const defaultRange = getMonthBounds(new Date());
  const isThisMonth = transactionState.rangeStart === defaultRange.start
    && transactionState.rangeEnd === defaultRange.end
    && !transactionState.categoryFilter;
  const apiTotals = mock.summary && typeof mock.summary.income === 'number' ? mock.summary : null;

  if (incomeSummary && expenseSummary) {
    if (apiTotals && isThisMonth) {
      incomeSummary.textContent = formatMoney(apiTotals.income);
      expenseSummary.textContent = formatMoney(apiTotals.expense);
      showRangeSummaryNote(false);
    } else if (apiTotals) {
      // ยังไม่มี endpoint สรุปตามช่วง/หมวด — บอกให้ชัดว่าทำไมตัวเลขหาย ไม่ใช่ปล่อยเป็นขีดลอยๆ
      incomeSummary.textContent = '—';
      expenseSummary.textContent = '—';
      showRangeSummaryNote(true);
    } else {
      // โหมด mock (ยังไม่ต่อ API) คิดเองได้เพราะข้อมูลทั้งหมดอยู่ในเครื่องอยู่แล้ว
      const periodIncome = summarySource.filter((item) => item.type === 'income').reduce((sum, item) => sum + Math.abs(item.amount), 0);
      const periodExpense = summarySource.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Math.abs(item.amount), 0);
      incomeSummary.textContent = formatMoney(periodIncome);
      expenseSummary.textContent = formatMoney(periodExpense);
    }
  }
  if (summaryPeriodBtn) {
    const defaultBounds = getMonthBounds(new Date());
    const isDefaultRange = transactionState.rangeStart === defaultBounds.start && transactionState.rangeEnd === defaultBounds.end;
    summaryPeriodBtn.textContent = isDefaultRange ? 'เดือนนี้' : formatRangeLabel(transactionState.rangeStart, transactionState.rangeEnd);
  }

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
      <button type="button" class="tab category-tab ${!transactionState.categoryFilter ? 'active' : ''}" data-category-chip="">ทุกหมวดหมู่</button>
      ${categoryNames.map((name) => `
        <button type="button" class="tab category-tab ${transactionState.categoryFilter === name ? 'active' : ''}" data-category-chip="${name}">${name}</button>
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

  const openDatePickerBtn = document.getElementById('openDatePickerBtn');
  if (openDatePickerBtn) {
    openDatePickerBtn.innerHTML = `${renderIcon('calendar', 'trigger-icon')} ${formatRangeLabel(transactionState.rangeStart, transactionState.rangeEnd)}`;
  }

  if (selectedDateChips) {
    const defaultBounds = getMonthBounds(new Date());
    const isDefaultRange = transactionState.rangeStart === defaultBounds.start && transactionState.rangeEnd === defaultBounds.end;
    if (isDefaultRange) {
      selectedDateChips.innerHTML = '';
    } else {
      selectedDateChips.innerHTML = `
        <span class="date-chip">
          ${formatRangeLabel(transactionState.rangeStart, transactionState.rangeEnd)}
          <button type="button" data-reset-range="true">×</button>
        </span>
      `;
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
      const matchesDate = !transactionState.rangeStart || !transactionState.rangeEnd
        || Boolean(item.dateKey && item.dateKey >= transactionState.rangeStart && item.dateKey <= transactionState.rangeEnd);
      const matchesCategory = !transactionState.categoryFilter || item.category === transactionState.categoryFilter;
      const matchesMonth = !transactionState.monthFilter || Boolean(item.dateKey && item.dateKey.startsWith(transactionState.monthFilter));
      return matchesTab && matchesSearch && matchesDate && matchesCategory && matchesMonth;
    });

    transactionState.visibleIds = filtered.map((item) => item.id);

    const grouped = filtered.reduce((acc, item) => {
      const key = item.date || 'อื่น ๆ';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const html = Object.entries(grouped)
      .map(([groupName, items]) => {
        // ⚖️ G7: โอนเข้าแผนออม (type='transfer') ไม่ใช่รายรับหรือรายจ่าย ห้ามเอามารวมยอด
        // API ส่งรายการพวกนี้ปนมาใน /api/transactions ด้วย (UI_CONTRACT เตือนไว้ตรงๆ)
        const groupTotal = items
          .filter((item) => !isTransfer(item))
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const groupTotalSign = groupTotal >= 0 ? '+' : '-';
        return `
        <div class="date-group">
          <div class="date-group-header">
            <span>${groupName}</span>
            <span class="date-group-total ${groupTotal >= 0 ? 'income' : 'expense'}">รวม ${groupTotalSign}${formatMoney(Math.abs(groupTotal))}</span>
          </div>
          ${items.map((item) => {
            const amount = Number(item.amount || 0);
            const transfer = isTransfer(item);
            // เงินโอนเข้าแผนไม่ใช่เงินที่หายไปจากกระเป๋า จึงไม่ใส่เครื่องหมายลบและไม่ย้อมสีแบบรายจ่าย
            const sign = transfer ? '' : amount >= 0 ? '+' : '-';
            const icon = renderIcon(transfer ? 'arrow-left-right' : item.type === 'income' ? 'wallet' : 'receipt');
            const aiBadge = item.parsedBy === 'ai' ? `<span class="ai-tag">${renderIcon('sparkles')} AI</span>` : '';
            const displayAmount = formatMoney(Math.abs(amount));
            const selectedClass = transactionState.selectedIds.some((selected) => sameId(selected, item.id)) ? 'row-selected' : '';
            const isChecked = transactionState.selectedIds.some((selected) => sameId(selected, item.id));
            const checkbox = transactionState.multiSelect
              ? `<button type="button" class="row-check ${isChecked ? 'checked' : ''}" role="checkbox" aria-checked="${isChecked}" data-row-check="${item.id}">${isChecked ? renderIcon('check') : ''}</button>`
              : '';

            return `
              <div class="transaction-row ${transactionState.multiSelect ? 'selectable' : ''} ${selectedClass}">
                ${checkbox}
                <div class="transaction-icon">${icon}</div>
                <div class="transaction-text">
                  <strong>${escapeHtml(item.title)}${aiBadge}</strong>
                  <small>${transfer ? 'โอนเข้าแผนออม' : item.category} • ${item.time}</small>
                </div>
                <div class="transaction-actions">
                  <span class="amount ${transfer ? 'transfer' : item.type}">${sign}${displayAmount}</span>
                  <button class="row-more" type="button" data-transaction-menu="${item.id}">${renderIcon('more-vertical')}</button>
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

  const bottomNav = document.querySelector('.bottom-nav');
  if (batchActionBar) {
    const hasSelection = transactionState.selectedIds.length > 0;
    if (bottomNav) bottomNav.hidden = hasSelection;
    if (!hasSelection) {
      batchActionBar.classList.add('hidden');
      batchActionBar.innerHTML = '';
    } else {
      batchActionBar.classList.remove('hidden');
      batchActionBar.innerHTML = `
        <div class="batch-actions">
          <button type="button" data-batch-action="select-all">เลือกทั้งหมด</button>
          <button type="button" data-batch-action="edit">${renderIcon('pencil')} แก้ไข</button>
          <button type="button" data-batch-action="delete">${renderIcon('trash-2')} ลบ (${transactionState.selectedIds.length})</button>
        </div>
      `;
    }
  }
}

// การ์ดภาพรวมด้านบน: "งบประมาณรวมทั้งหมด" = ผลรวมงบของหมวดในประเภทเดียวกัน (รายจ่าย ยกเว้นตอนอยู่แท็บรายรับ)
// ไม่เอารายรับกับรายจ่ายมาบวกรวมกัน เพราะได้ตัวเลขที่ไม่มีความหมาย (ของเดิมโชว์ ฿16,100 ปนกันมั่ว)
function renderCategoryOverview() {
  const totalEl = document.getElementById('categoryOverviewTotal');
  if (!totalEl) return;

  const isIncome = categoryState.activeTab === 'income';
  const items = mock.categories
    .filter((item) => item.type === (isIncome ? 'income' : 'expense'))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const totalLimit = items.reduce((sum, item) => sum + safeNumber(item.limit), 0);
  const totalUsed = items.reduce((sum, item) => sum + safeNumber(item.used), 0);
  const remaining = totalLimit - totalUsed;
  const percent = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;
  const tone = isIncome ? 'success' : (percent > 100 ? 'danger' : percent >= 80 ? 'warning' : 'success');

  document.getElementById('categoryOverviewLabel').textContent = isIncome ? 'เป้ารายรับรวมทั้งหมด' : 'งบประมาณรวมทั้งหมด (รายจ่าย)';
  totalEl.textContent = formatMoney(totalLimit);
  document.getElementById('categoryOverviewUsedLabel').textContent = isIncome ? 'ได้รับแล้ว' : 'ใช้ไปแล้ว';
  document.getElementById('categoryOverviewUsed').textContent = formatMoney(totalUsed);

  const isOver = !isIncome && remaining < 0;
  document.getElementById('categoryOverviewRemainingLabel').textContent = isIncome ? 'เหลืออีก' : (isOver ? 'เกินงบ' : 'คงเหลือ');
  const remainingEl = document.getElementById('categoryOverviewRemaining');
  remainingEl.textContent = formatMoney(Math.abs(remaining));
  remainingEl.classList.toggle('over', isOver);

  const badge = document.getElementById('categoryOverviewBadge');
  if (badge) {
    badge.innerHTML = `<span class="pill ${tone}">${Math.round(percent)}% ${isIncome ? 'ของเป้า' : 'ของงบ'}</span>`;
  }

  // แถบ = งบทั้งหมด, ส่วนสีคือยอดที่ใช้ไปของแต่ละหมวด, ส่วนว่างคือที่เหลือ
  // ทุกส่วนเป็นปุ่มกดได้: hover/แตะ แล้วมี popover รายละเอียดขึ้นมา (ดู showBarTip)
  const bar = document.getElementById('categoryOverviewBar');
  if (bar) {
    categoryOverviewTip.data.clear();
    const denom = Math.max(totalLimit, totalUsed);
    const usedSegments = items
      .map((item) => {
        const used = safeNumber(item.used);
        const share = denom > 0 ? (used / denom) * 100 : 0;
        if (share <= 0) return '';
        const key = `cat-${item.id}`;
        categoryOverviewTip.data.set(key, {
          name: item.name,
          color: item.color,
          used,
          limit: safeNumber(item.limit),
          sharePercent: totalLimit > 0 ? (used / totalLimit) * 100 : 0,
          categoryPercent: item.limit ? (used / item.limit) * 100 : 0,
          isIncome,
          shareLabel: isIncome ? 'ของเป้ารวม' : 'ของงบรวม',
        });
        return `<button type="button" class="stacked-bar-seg" data-overview-seg="${key}" style="width: ${share}%; background: ${item.color}" aria-label="${escapeHtml(item.name)}"></button>`;
      })
      .join('');

    const remainingShare = denom > 0 && remaining > 0 ? (remaining / denom) * 100 : 0;
    let remainingSegment = '';
    if (remainingShare > 0) {
      categoryOverviewTip.data.set('remaining', {
        remaining: true,
        amount: remaining,
        sharePercent: totalLimit > 0 ? (remaining / totalLimit) * 100 : 0,
        isIncome,
        shareLabel: isIncome ? 'ของเป้ารวม' : 'ของงบรวม',
      });
      remainingSegment = `<button type="button" class="stacked-bar-seg remaining" data-overview-seg="remaining" style="width: ${remainingShare}%" aria-label="${isIncome ? 'เหลืออีก' : 'คงเหลือ'}"></button>`;
    }
    bar.innerHTML = usedSegments + remainingSegment;
  }
}

// popover รายละเอียดของแต่ละส่วนในแถบสัดส่วน ใช้ร่วมกันทั้งหน้าหมวดหมู่และหน้าภาพรวม
// ctx.data = ข้อมูลของแต่ละส่วน (คีย์ = data-overview-seg), ctx.hostSelector = การ์ดที่ tip วางตำแหน่งอ้างอิง
const categoryOverviewTip = { barId: 'categoryOverviewBar', tipId: 'categoryOverviewTip', hostSelector: '.hero-dark', data: new Map() };
const analyzeDonutTip = { barId: 'analyzeDonutChart', tipId: 'analyzeDonutTip', hostSelector: '.an-donut', data: new Map(), anchorOf: getDonutTipAnchor };
const dashboardBudgetTip = { barId: 'dashboardBudgetBar', tipId: 'dashboardBudgetTip', hostSelector: '#monthlyBudgetSummary', data: new Map() };

function showBarTip(ctx, segment) {
  const tip = document.getElementById(ctx.tipId);
  const bar = document.getElementById(ctx.barId);
  const host = tip ? tip.closest(ctx.hostSelector) : null;
  const data = ctx.data.get(segment.dataset.overviewSeg);
  if (!tip || !bar || !host || !data) return;

  if (data.tipHtml) {
    tip.innerHTML = data.tipHtml;
  } else if (data.remaining) {
    tip.innerHTML = `
      <span class="overview-tip-title"><i class="legend-dot remaining-dot"></i>${data.isIncome ? 'เหลืออีก (ยังไม่ถึงเป้า)' : 'คงเหลือ'}</span>
      <span class="overview-tip-amount">${formatMoney(data.amount)}</span>
      <span class="overview-tip-meta">${Math.round(data.sharePercent)}% ${data.shareLabel}</span>
    `;
  } else {
    tip.innerHTML = `
      <span class="overview-tip-title"><i class="legend-dot" style="background: ${data.color}"></i>${escapeHtml(data.name)}</span>
      <span class="overview-tip-amount">${formatMoney(data.used)} <small>จาก ${formatMoney(data.limit)}</small></span>
      <span class="overview-tip-meta">${Math.round(data.sharePercent)}% ${data.shareLabel} · ${data.isIncome ? 'ได้รับ' : 'ใช้'} ${Math.round(data.categoryPercent)}% ของหมวดนี้</span>
    `;
  }

  bar.classList.add('has-active');
  bar.querySelectorAll('[data-overview-seg]').forEach((seg) => seg.classList.toggle('active', seg === segment));

  // วัดขนาดก่อนวาง (ต้องแสดงอยู่ถึงจะวัดได้) แล้วจัดให้อยู่เหนือส่วนที่ชี้ ไม่ล้นขอบการ์ด
  tip.hidden = false;
  const hostRect = host.getBoundingClientRect();
  const segRect = segment.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  // โดนัท: ชี้ที่ขอบวงของส่วนนั้น (ครึ่งล่างให้ tip อยู่ด้านล่าง) / แถบ: อยู่เหนือแถบ
  const anchor = ctx.anchorOf ? ctx.anchorOf(segment, data) : null;
  const segCenter = (anchor ? anchor.x : segRect.left + segRect.width / 2) - hostRect.left;
  const left = Math.max(10, Math.min(segCenter - tipRect.width / 2, hostRect.width - tipRect.width - 10));
  tip.style.left = `${left}px`;
  tip.classList.toggle('below', !!(anchor && anchor.below));
  tip.style.top = anchor && anchor.below
    ? `${anchor.y - hostRect.top + 12}px`
    : `${(anchor ? anchor.y : barRect.top) - hostRect.top - tipRect.height - 12}px`;
  tip.style.setProperty('--arrow-x', `${Math.max(14, Math.min(segCenter - left, tipRect.width - 14))}px`);
}

function hideBarTip(ctx) {
  const tip = document.getElementById(ctx.tipId);
  const bar = document.getElementById(ctx.barId);
  if (tip) tip.hidden = true;
  if (bar) {
    bar.classList.remove('has-active');
    bar.querySelectorAll('[data-overview-seg].active').forEach((seg) => seg.classList.remove('active'));
  }
}

// ผูก event ที่ตัวแถบ (delegation) เรียกซ้ำได้ตอน render ใหม่ เพราะแถบถูกสร้างใหม่ทุกครั้ง ส่วน listener ของ document ผูกครั้งเดียว
function bindBarTip(ctx) {
  const bar = document.getElementById(ctx.barId);
  if (!bar) return;

  const segmentOf = (event) => event.target.closest('[data-overview-seg]');
  // เบราว์เซอร์มือถือยิง mouseover/mouseleave จำลองหลังแตะ ทำให้ tip เปิดแล้วปิดทันที จึงข้าม event เมาส์เมื่อเป็นการแตะ
  let isTouch = false;
  bar.addEventListener('pointerdown', (event) => {
    isTouch = event.pointerType === 'touch' || event.pointerType === 'pen';
  });
  bar.addEventListener('mouseover', (event) => {
    const segment = segmentOf(event);
    if (segment && !isTouch) showBarTip(ctx, segment);
  });
  bar.addEventListener('mouseleave', () => {
    if (!isTouch) hideBarTip(ctx);
  });
  bar.addEventListener('focusin', (event) => {
    const segment = segmentOf(event);
    if (segment && !isTouch) showBarTip(ctx, segment);
  });
  bar.addEventListener('focusout', () => {
    if (!isTouch) hideBarTip(ctx);
  });
  // มือถือไม่มี hover: แตะเพื่อเปิด แตะที่อื่นเพื่อปิด
  bar.addEventListener('click', (event) => {
    const segment = segmentOf(event);
    if (segment) {
      event.stopPropagation();
      showBarTip(ctx, segment);
    }
  });

  if (!ctx.docBound) {
    ctx.docBound = true;
    document.addEventListener('click', () => hideBarTip(ctx));
  }
}

function getCategorySortedList() {
  return mock.categories.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function renderCategoriesPage() {
  const categoryList = document.getElementById('categoryList');
  if (!categoryList) return;

  const isSorting = categoryState.sortMode;
  const items = isSorting
    ? categoryState.draftOrder.map((id) => mock.categories.find((item) => item.id === id)).filter(Boolean)
    : getCategorySortedList()
      .filter((item) => categoryState.activeTab === 'all' || item.type === categoryState.activeTab)
      .filter((item) => !categoryState.searchValue || item.name.toLowerCase().includes(categoryState.searchValue.toLowerCase()));

  renderCategoryOverview();

  const filters = document.getElementById('categoryFilters');
  if (filters) filters.hidden = isSorting;

  const sortToggleBtn = document.getElementById('toggleCategorySortBtn');
  if (sortToggleBtn) sortToggleBtn.textContent = isSorting ? 'ยกเลิก' : 'จัดเรียง';

  categoryList.innerHTML = (isSorting ? '<p class="sort-hint">ลากการ์ด หรือกดลูกศรขึ้น/ลง เรียงได้หลายรายการ แล้วกด "ยืนยัน" ตอนเสร็จ</p>' : '') + items
    .map((item, index) => {
      const percent = Math.round(((item.used || 0) / (item.limit || 1)) * 100);
      const iconBadge = `<span class="category-badge" style="background: ${item.color}26; color: ${item.color}">${renderCategoryIcon(item.icon)}</span>`;

      if (isSorting) {
        return `
      <div class="category-item-box sorting" draggable="true" data-category-row="${item.id}" data-category-id="${item.id}">
        <div class="category-top">
          <div class="category-name">
            <span class="drag-handle">${renderIcon('grip-vertical')}</span>
            ${iconBadge}
            <span>${escapeHtml(item.name)}</span>
          </div>
          <div class="sort-controls">
            <button type="button" class="sort-btn" data-sort-move="up" data-sort-id="${item.id}" aria-label="เลื่อนขึ้น" ${index === 0 ? 'disabled' : ''}>${renderIcon('chevron-up')}</button>
            <button type="button" class="sort-btn" data-sort-move="down" data-sort-id="${item.id}" aria-label="เลื่อนลง" ${index === items.length - 1 ? 'disabled' : ''}>${renderIcon('chevron-down')}</button>
          </div>
        </div>
      </div>
    `;
      }

      return `
      <div class="category-item-box" data-category-row="${item.id}" data-category-id="${item.id}">
        <div class="category-top">
          <div class="category-name">
            ${iconBadge}
            <span>${escapeHtml(item.name)}</span>
          </div>
          <div class="category-top-right">
            <span class="pill ${getProgressTone(percent)}">${percent}%</span>
            <button class="row-more" type="button" data-category-menu="${item.id}">${renderIcon('more-vertical')}</button>
          </div>
        </div>
        <div class="progress-bar"><span style="width: ${clamp(percent)}%; background: ${item.color}"></span></div>
        <div class="card-row">
          <span>ใช้ไปแล้ว</span>
          <strong>${formatMoney(item.used)} <span class="budget-breakdown-limit">/ ${formatMoney(item.limit)}</span></strong>
        </div>
      </div>
    `;
    })
    .join('');

  if (!isSorting && items.length === 0) {
    categoryList.innerHTML = '<div class="empty-state">ไม่พบหมวดหมู่ตามเงื่อนไข</div>';
  }

  if (isSorting) {
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
        const targetId = card.dataset.categoryRow;
        reorderCategories(draggedId, targetId);
      });
    });
  }

  // แถบยืนยัน/ยกเลิกการจัดเรียง ลอยแทน bottom-nav (เหมือนแถบ action ตอนเลือกหลายรายการในหน้าประวัติ)
  const sortBar = document.getElementById('categorySortBar');
  if (sortBar) {
    if (isSorting) {
      sortBar.classList.remove('hidden');
      sortBar.innerHTML = `
        <div class="batch-actions">
          <button type="button" data-sort-cancel="true">ยกเลิก</button>
          <button type="button" class="confirm" data-sort-confirm="true">${renderIcon('check')} ยืนยันการเรียงลำดับ</button>
        </div>
      `;
    } else {
      sortBar.classList.add('hidden');
      sortBar.innerHTML = '';
    }
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.hidden = isSorting;
  }
}

function enterCategorySortMode() {
  categoryState.draftOrder = getCategorySortedList().map((item) => item.id);
  categoryState.sortMode = true;
  renderCategoriesPage();
}

function cancelCategorySort() {
  categoryState.sortMode = false;
  categoryState.draftOrder = [];
  renderCategoriesPage();
}

function confirmCategorySort() {
  categoryState.draftOrder.forEach((id, index) => {
    const category = mock.categories.find((item) => item.id === id);
    if (category) category.sortOrder = index + 1;
  });
  categoryState.sortMode = false;
  categoryState.draftOrder = [];
  renderCategoriesPage();
  showSuccessModal('บันทึกการเรียงลำดับสำเร็จ');
}

function moveCategoryInDraft(categoryId, direction) {
  const order = categoryState.draftOrder;
  const index = order.indexOf(categoryId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  renderCategoriesPage();
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
        <div class="goal-card tappable" data-plan-detail="${plan.id}">
          <div class="goal-header">
            <span class="goal-icon">${renderCategoryIcon('piggy-bank')}</span>
            <div class="goal-title">
              <strong>${escapeHtml(plan.name)}</strong>
              ${plan.type === 'emergency' ? '<span class="goal-tag">กองทุนฉุกเฉิน</span>' : ''}
            </div>
            <button class="row-more plan-more" type="button" data-plan-menu="${plan.id}" aria-label="ตัวเลือกแผน">${renderIcon('more-vertical')}</button>
          </div>
          <div class="goal-amount">
            <strong>${formatMoneyShort(plan.saved)}</strong>
            <span>จาก ${formatMoneyShort(plan.target)}</span>
            <em>${Math.round(clamp(plan.progress || 0))}%</em>
          </div>
          <div class="progress-bar"><span style="width: ${clamp(plan.progress || 0)}%"></span></div>
          <div class="card-row">
            <span>${plan.dueMonth}</span>
            ${renderConfidenceBadge(plan.confidence || 'high')}
          </div>
          <div class="plan-actions-row">
            ${statusBadge}
            <button class="secondary-btn small" type="button" data-plan-transfer="${plan.id}">โอนเข้าแผนนี้</button>
          </div>
        </div>
      `;
    }).join('');
}

// ---------- หน้าวิเคราะห์ (analyze.html) ----------
// แท็บ "ภาพรวม": สถานะงบ, แนวโน้ม 6 เดือน, ตัวเลขใช้อย่างปลอดภัย, สัดส่วนหมวด, แผนเก็บเงิน, จำลองก่อนซื้อ
// แท็บ "รายหมวด": เลือกหมวด/เดือน ดูกราฟแท่งย้อนหลัง สถิติ และรายการเทียบเดือน
const analyzeState = {
  tab: 'overview',
  trendIndex: null,
  monthKey: null,
  categoryId: 'all',
};

function getAnalyzeExpenseCategories() {
  return mock.categories
    .filter((item) => item.type === 'expense')
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function getPercentChange(current, previous) {
  if (!previous || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function renderDeltaPill(change) {
  if (change === null) return '<span class="an-delta neutral">—</span>';
  const icon = change < 0 ? 'trending-down' : 'trending-up';
  return `<span class="an-delta">${renderIcon(icon)}${change > 0 ? '+' : ''}${change}%</span>`;
}

function renderAnalyzeStatus() {
  const container = document.getElementById('analyzeStatus');
  if (!container) return;

  const used = safeNumber(mock.summary.monthlyBudgetUsed);
  const limit = safeNumber(mock.summary.monthlyBudgetLimit);
  // ยังไม่ตั้งงบ = ไม่มีอะไรให้เทียบ ห้ามสรุปว่า "ปกติดี" เพราะ 0 ÷ 0 ได้ 0%
  const noBudget = limit <= 0;
  const percent = noBudget ? 0 : Math.round((used / limit) * 100);
  const tone = noBudget ? 'muted' : percent >= 100 ? 'danger' : percent >= 85 ? 'warning' : 'success';
  const toneLabel = noBudget ? 'ยังไม่ได้ตั้งงบ' : tone === 'danger' ? 'เกินงบ' : tone === 'warning' ? 'ใกล้เต็มงบ' : 'ปกติดี';
  const toneText = noBudget
    ? 'ตั้งงบรายหมวดก่อน ระบบถึงจะบอกได้ว่าเดือนนี้ใช้จ่ายเป็นยังไง'
    : tone === 'danger' ? 'เกินงบเดือนนี้แล้ว ควรชะลอการใช้จ่าย' : tone === 'warning' ? 'ใกล้เต็มงบเดือนนี้แล้ว' : 'ยังอยู่ในเกณฑ์ปกติ';

  container.innerHTML = `
    <div class="hero-top">
      <p class="mini-label">สรุปสถานะเดือนนี้</p>
      <span class="pill ${tone}">${toneLabel}</span>
    </div>
    <div class="hero-figure">
      <h2>${noBudget ? 'ยังไม่มีข้อมูล' : `${percent}%`}</h2>
    </div>
    <p class="an-status-text">${noBudget ? toneText : `ใช้จ่ายไปแล้ว ${percent}% ของงบเดือนนี้ ${toneText}`}</p>
    <div class="an-meter"><span style="width: ${clamp(percent)}%"></span></div>
    <div class="overview-stats">
      <div class="overview-stat"><span>ใช้ไปแล้ว</span><strong>${formatMoney(used)}</strong></div>
      <div class="overview-stat"><span>งบทั้งเดือน</span><strong>${noBudget ? 'ยังไม่ได้ตั้ง' : formatMoney(limit)}</strong></div>
    </div>
    <button type="button" class="an-status-more" data-analyze-insight="rate">ดูรายละเอียด ${renderIcon('chevron-right')}</button>
  `;
}

function renderAnalyzeTrend() {
  const container = document.getElementById('analyzeTrend');
  if (!container) return;

  const { labels, income, expense } = mock.lineData;
  if (!labels.length) return;
  if (analyzeState.trendIndex === null || analyzeState.trendIndex >= labels.length) {
    analyzeState.trendIndex = labels.length - 1;
  }
  const index = analyzeState.trendIndex;
  const limit = safeNumber(mock.summary.monthlyBudgetLimit);
  const scaleMax = Math.max(...income, ...expense, limit, 1) / 0.92;
  const limitPercent = (limit / scaleMax) * 100;

  const columns = labels.map((label, i) => `
    <button type="button" class="an-tcol ${i === index ? 'selected' : ''}" data-trend-index="${i}" aria-label="${label}">
      <span class="an-tplot">
        <span class="an-tlimit" style="bottom: ${limitPercent}%"></span>
        <span class="an-tbar income" style="height: ${(income[i] / scaleMax) * 100}%"></span>
        <span class="an-tbar expense" style="height: ${(expense[i] / scaleMax) * 100}%"></span>
      </span>
      <span class="an-tlabel">${label}</span>
    </button>
  `).join('');

  const rows = [
    { key: 'income', title: 'รายรับ', values: income, icon: 'wallet' },
    { key: 'expense', title: 'รายจ่าย', values: expense, icon: 'receipt' },
  ].map((row) => `
    <button type="button" class="an-delta-row" data-trend-detail="${row.key}">
      <span class="an-delta-icon">${renderIcon(row.icon)}</span>
      <div>
        <strong>${row.title} ${labels[index]}</strong>
        <small>${formatMoney(row.values[index])} · เทียบเดือนก่อน</small>
      </div>
      ${renderDeltaPill(index > 0 ? getPercentChange(row.values[index], row.values[index - 1]) : null)}
      ${renderIcon('chevron-right', 'an-row-arrow')}
    </button>
  `).join('');

  container.innerHTML = `
    <div class="an-head">
      <h3>แนวโน้ม ${labels.length} เดือน</h3>
      <span class="an-legend"><i class="an-dot income"></i>รายรับ <i class="an-dot expense"></i>รายจ่าย</span>
    </div>
    <div class="an-trend-chart" style="grid-template-columns: repeat(${labels.length}, minmax(0, 1fr))">${columns}</div>
    <p class="an-limit-note"><span class="an-limit-dash"></span>งบประมาณ ${formatMoneyShort(limit)} ต่อเดือน</p>
    <div class="an-delta-rows">${rows}</div>
  `;
}

// วันที่อ้างอิงของ mock = วันที่ล่าสุดที่มีรายการ (เพื่อให้ตัวเลขนิ่ง ไม่เปลี่ยนตามวันที่จริงของเครื่อง)
function getAnalyzeReference() {
  const latest = mock.transactions.reduce((max, item) => (item.dateKey > max ? item.dateKey : max), '0000-00-00');
  const [year, month, day] = latest.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return { year, month, day, daysInMonth, daysLeft: Math.max(0, daysInMonth - day) };
}

function getAnalyzeInsights() {
  const used = safeNumber(mock.summary.monthlyBudgetUsed);
  const limit = safeNumber(mock.summary.monthlyBudgetLimit);
  const rate = limit > 0 ? Math.round((used / limit) * 100) : 0;
  // null = backend ยังคำนวณให้ไม่ได้ ต่างจาก 0 ที่แปลว่าคาดว่าจะไม่เหลือเงินเลย
  const forecast = mock.summary.forecastBalance === null || mock.summary.forecastBalance === undefined
    ? null
    : safeNumber(mock.summary.forecastBalance);
  const emergencyPlan = getEmergencyPlan();
  return { used, limit, rate, forecast, emergencyPlan };
}

function renderAnalyzeTiles() {
  const container = document.getElementById('analyzeTiles');
  if (!container) return;

  const { rate, forecast, emergencyPlan } = getAnalyzeInsights();
  const tiles = [
    { key: 'rate', icon: 'wallet', value: `${rate}%`, label: 'อัตราการใช้จ่าย' },
    {
      key: 'forecast',
      icon: 'trending-up',
      // backend ยังไม่มีสูตรนี้ ถ้าโชว์ ฿0 ผู้ใช้จะอ่านว่า "คาดว่าจะไม่เหลือเลย" ซึ่งไม่จริง
      value: forecast === null ? 'ยังไม่มีข้อมูล' : `${forecast >= 0 ? '+' : '-'}${formatMoneyShort(Math.abs(forecast))}`,
      label: 'การคาดการณ์',
    },
    { key: 'emergency', icon: 'leaf', value: emergencyPlan ? `${Math.round(emergencyPlan.progress || 0)}%` : 'ยังไม่มี', label: 'กองทุนฉุกเฉิน', prompt: !emergencyPlan },
  ].filter((tile) => !(tile.key === 'emergency' && !emergencyPlan && isEmergencyTileHidden()));
  container.classList.toggle('count-2', tiles.length === 2);
  container.innerHTML = tiles.map((tile) => `
    <button type="button" class="an-tile tappable ${tile.prompt ? 'prompt' : ''}" data-analyze-insight="${tile.key}">
      <span class="an-tile-icon">${renderIcon(tile.icon)}</span>
      <strong>${tile.value}</strong>
      <span>${tile.label}</span>
      ${renderIcon('chevron-right', 'an-tile-arrow')}
    </button>
  `).join('');
}

function openInsightModal({ title, value, pill, progress, lead, rows, extra, tip, action, footer }) {
  openModal(`
    <div class="modal-card small an-detail">
      <div class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="an-detail-hero">
        <strong>${value}</strong>
        ${pill || ''}
      </div>
      ${progress === undefined ? '' : `<div class="progress-bar an-detail-progress"><span style="width: ${clamp(progress)}%"></span></div>`}
      <p class="an-detail-lead">${lead}</p>
      <div class="an-detail-rows">
        ${rows.map((row) => `<div class="summary-row"><span>${row[0]}</span><strong>${row[1]}</strong></div>`).join('')}
      </div>
      ${extra || ''}
      <p class="an-detail-tip">${renderIcon('sparkles')}<span>${tip}</span></p>
      ${footer || ''}
      ${action ? `<div class="modal-actions"><button class="primary-btn full" type="button" id="insightActionBtn">${action.label}</button></div>` : ''}
    </div>
  `);
  if (action) {
    document.getElementById('insightActionBtn').addEventListener('click', action.run);
  }
}

function openInsightDetail(key) {
  const { used, limit, rate, forecast, emergencyPlan } = getAnalyzeInsights();
  const ref = getAnalyzeReference();
  const remaining = limit - used;

  if (key === 'rate') {
    const tone = rate >= 100 ? 'danger' : rate >= 85 ? 'warning' : 'success';
    const toneLabel = tone === 'danger' ? 'เกินงบ' : tone === 'warning' ? 'ใกล้เต็มงบ' : 'ปกติดี';
    const perDay = ref.daysLeft > 0 && remaining > 0 ? formatMoney(Math.round(remaining / ref.daysLeft)) : '—';
    const topCategories = getAnalyzeExpenseCategories()
      .map((item) => ({ item, spent: safeNumber(item.used) }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 3);
    const totalSpent = getAnalyzeExpenseCategories().reduce((sum, item) => sum + safeNumber(item.used), 0) || 1;
    const scale = [
      { label: 'ปกติดี', hint: 'ต่ำกว่า 85%', active: tone === 'success' },
      { label: 'ใกล้เต็มงบ', hint: '85–99%', active: tone === 'warning' },
      { label: 'เกินงบ', hint: '100% ขึ้นไป', active: tone === 'danger' },
    ].map((step) => `<div class="an-scale-step ${step.active ? 'active' : ''}"><strong>${step.label}</strong><small>${step.hint}</small></div>`).join('');

    openInsightModal({
      title: 'อัตราการใช้จ่าย',
      value: `${rate}%`,
      pill: `<span class="pill ${tone}">${toneLabel}</span>`,
      progress: rate,
      lead: 'สัดส่วนที่ใช้ไปแล้วเทียบกับงบประมาณของเดือนนี้ ยิ่งใกล้ 100% แปลว่างบที่ตั้งไว้ใกล้หมดแล้ว',
      rows: [
        ['ใช้ไปแล้ว', formatMoney(used)],
        ['งบทั้งเดือน', formatMoney(limit)],
        [remaining >= 0 ? 'คงเหลือ' : 'เกินงบ', formatMoney(Math.abs(remaining))],
        ['วันที่เหลือในเดือนนี้', `${ref.daysLeft} วัน`],
        ['ใช้ได้เฉลี่ยต่อวัน', perDay],
      ],
      extra: `
        <div class="an-scale">${scale}</div>
        <h4 class="an-detail-sub">หมวดที่ใช้มากที่สุด</h4>
        <div class="an-detail-rows">
          ${topCategories.map(({ item, spent }) => `<div class="summary-row"><span><i class="legend-dot" style="background: ${item.color}"></i> ${escapeHtml(item.name)}</span><strong>${formatMoney(spent)} · ${Math.round((spent / totalSpent) * 100)}%</strong></div>`).join('')}
        </div>
      `,
      tip: tone === 'success'
        ? 'ตอนนี้ยังอยู่ในเกณฑ์ปกติ ถ้าใช้ไม่เกินค่าเฉลี่ยต่อวันด้านบน งบจะพอจนสิ้นเดือน'
        : 'ลองลดรายจ่ายในหมวดที่ไม่จำเป็น เพื่อให้งบพอถึงสิ้นเดือน',
      action: { label: 'ดูงบรายหมวด', run: () => { window.location.href = 'categories.html'; } },
    });
    return;
  }

  if (key === 'forecast') {
    const meta = getConfidenceMeta(mock.summary.safeToSpendConfidence || 'high');
    if (forecast === null) {
      openInsightModal({
        title: 'การคาดการณ์สิ้นเดือน',
        value: 'ยังไม่มีข้อมูล',
        lead: 'ตัวเลขนี้ต้องให้ระบบคำนวณจากพฤติกรรมการใช้จ่ายของคุณ ตอนนี้ยังไม่มีสูตรคำนวณในระบบ จึงยังแสดงให้ไม่ได้',
        rows: [
          ['คงเหลือจากงบตอนนี้', formatMoney(Math.max(0, limit - used))],
          ['วันที่เหลือในเดือนนี้', `${ref.daysLeft} วัน`],
        ],
        tip: 'ระหว่างนี้ดู "อัตราการใช้จ่าย" กับ "ใช้ได้เฉลี่ยต่อวัน" แทนได้',
      });
      return;
    }
    const positive = forecast >= 0;
    openInsightModal({
      title: 'การคาดการณ์สิ้นเดือน',
      value: `${positive ? '+' : '-'}${formatMoney(Math.abs(forecast))}`,
      pill: `<span class="pill ${positive ? 'success' : 'danger'}">${positive ? 'คาดว่าเหลือจากงบ' : 'คาดว่าเกินงบ'}</span>`,
      lead: `ประมาณการว่าเมื่อสิ้นเดือนจะเหลือเงินจากงบประมาณเท่าไร ถ้ายังใช้จ่ายในจังหวะเดิม (${positive ? 'เครื่องหมาย + คือเหลือ' : 'เครื่องหมาย − คือเกินงบ'}) ตัวเลขนี้เป็นค่าประมาณ ไม่ใช่ยอดจริง`,
      rows: [
        ['คงเหลือจากงบตอนนี้', formatMoney(Math.max(0, limit - used))],
        ['วันที่เหลือในเดือนนี้', `${ref.daysLeft} วัน`],
        ['ข้อมูลที่บันทึกแล้ว', `${safeNumber(mock.summary.daysOfData)} วัน`],
        ['ความแม่นยำของการประเมิน', meta.label],
      ],
      tip: safeNumber(mock.summary.daysOfData) < 30
        ? 'ยิ่งบันทึกรายการต่อเนื่องนานขึ้น การคาดการณ์จะยิ่งแม่นยำ ลองบันทึกรายจ่ายให้ครบทุกวัน'
        : 'มีข้อมูลต่อเนื่องเพียงพอแล้ว การคาดการณ์นี้ค่อนข้างเชื่อถือได้',
      action: { label: 'ดูความหมายของความมั่นใจ', run: () => { closeModal(); openConfidenceModal(); } },
    });
    return;
  }

  if (key === 'emergency') {
    if (!emergencyPlan) {
      const suggestion = getEmergencySuggestion();
      openInsightModal({
        title: 'กองทุนฉุกเฉิน',
        value: 'ยังไม่มี',
        lead: 'เงินสำรองไว้ใช้ยามจำเป็น เช่น ป่วย ของพัง หรือรายได้ขาดช่วง ไม่บังคับ แต่ถ้ามีจะช่วยให้อุ่นใจและระบบติดตามความคืบหน้าให้',
        rows: [
          ['ค่าใช้จ่ายจำเป็นต่อเดือน', formatMoney(suggestion.essentialMonthly)],
          ['ที่แนะนำให้สำรอง (3 เดือน)', formatMoney(suggestion.target)],
        ],
        tip: 'ตัวเลขแนะนำนับจากงบของหมวดที่ตั้งว่า "จำเป็น" ปรับเป้าหมายเองได้ตอนสร้าง หรือถ้ามีแผนออมอยู่แล้ว เปิดตัวเลือก "ตั้งเป็นกองทุนฉุกเฉิน" ในหน้าแก้ไขแผนได้เลย',
        footer: `
          <div class="an-detail-actions two">
            <button class="primary-btn" type="button" id="emergencyCreateBtn">สร้างกองทุนฉุกเฉิน</button>
            <button class="secondary-btn" type="button" id="emergencyHideBtn">ไม่ต้องแสดง</button>
          </div>
        `,
      });
      document.getElementById('emergencyCreateBtn').addEventListener('click', () => {
        closeModal();
        openPlanWizard('emergency');
      });
      document.getElementById('emergencyHideBtn').addEventListener('click', () => {
        setEmergencyTileHidden(true);
        closeModal();
        renderAnalyzeTiles();
        showSuccessModal('ซ่อนแล้ว จะกลับมาเองเมื่อคุณตั้งกองทุนฉุกเฉิน');
      });
      return;
    }
    const plan = emergencyPlan;
    const { left, monthsToGo, finish } = getPlanForecast(plan);
    const statusPill = renderPlanStatusPill(plan);
    openInsightModal({
      title: 'กองทุนฉุกเฉิน',
      value: `${Math.round(plan.progress || 0)}%`,
      pill: statusPill,
      progress: plan.progress || 0,
      lead: 'ความคืบหน้าของเงินสำรองยามฉุกเฉิน เช่น ป่วย ของพัง หรือรายได้ขาดช่วง ยิ่งครบเร็วยิ่งอุ่นใจ',
      rows: [
        ['เก็บได้แล้ว', formatMoney(plan.saved)],
        ['เป้าหมาย', formatMoney(plan.target)],
        ['ยังขาดอีก', formatMoney(left)],
        ['กำหนดเป้าหมาย', plan.dueMonth || '—'],
        ['ออมต่อเดือน', plan.monthly_save ? formatMoney(plan.monthly_save) : '—'],
        ['ถ้าออมตามนี้จะครบ', monthsToGo === null ? '—' : monthsToGo === 0 ? 'ครบแล้ว' : `ราว ${monthsToGo} เดือน (${finish})`],
      ],
      tip: plan.status === 'off_track'
        ? 'ตอนนี้ความคืบหน้าช้ากว่าเป้า ลองโอนเพิ่มหรือปรับยอดออมต่อเดือน'
        : 'ทำได้ดี รักษาจังหวะการออมต่อเนื่องไว้',
      action: { label: 'โอนเข้าแผนนี้', run: () => { closeModal(); openPlanTransfer(plan); } },
    });
  }
}

// ---------- กองทุนฉุกเฉิน ----------
// ผู้ใช้เลือกเองตอนสร้าง/แก้ไขแผน (plan.type === 'emergency') ตั้งได้แผนเดียว ไม่บังคับ
const EMERGENCY_HIDE_KEY = 'jodtang.emergencyTileHidden';

function getEmergencyPlan() {
  return mock.plans.find((plan) => plan.active !== false && plan.type === 'emergency') || null;
}

function isEmergencyTileHidden() {
  try {
    return window.localStorage.getItem(EMERGENCY_HIDE_KEY) === '1';
  } catch (error) {
    return false;
  }
}

function setEmergencyTileHidden(hidden) {
  try {
    if (hidden) window.localStorage.setItem(EMERGENCY_HIDE_KEY, '1');
    else window.localStorage.removeItem(EMERGENCY_HIDE_KEY);
  } catch (error) {
    // ใช้ไม่ได้ (เช่น โหมดส่วนตัว) ก็แค่ไม่จำค่านี้
  }
}

// แนะนำเป้ากองทุนฉุกเฉิน = 3 เดือนของงบหมวดที่ "จำเป็น"
function getEmergencySuggestion() {
  const essentialMonthly = mock.categories
    .filter((item) => item.type === 'expense' && item.isEssential)
    .reduce((sum, item) => sum + safeNumber(item.limit), 0);
  return { essentialMonthly, target: essentialMonthly * 3 };
}

function getEmergencyHint(isOn, planId) {
  if (!isOn) return 'เงินสำรองยามจำเป็น เช่น ป่วย ของพัง หรือรายได้ขาดช่วง ตั้งได้แผนเดียว';
  const other = getEmergencyPlan();
  if (other && other.id !== planId) {
    return `ตอนนี้ "${escapeHtml(other.name)}" เป็นกองทุนฉุกเฉินอยู่ ถ้าเปิดตัวเลือกนี้ ระบบจะย้ายมาที่แผนนี้แทน`;
  }
  return 'แผนนี้จะแสดงเป็นกองทุนฉุกเฉินในหน้าวิเคราะห์';
}

function renderEmergencyToggleRow(isOn, planId) {
  return `
    <div class="setting-item an-emergency-row">
      <div>
        <strong>ตั้งเป็นกองทุนฉุกเฉิน</strong>
        <span id="emergencyHint">${getEmergencyHint(isOn, planId)}</span>
      </div>
      <button type="button" class="switch ${isOn ? 'on' : ''}" id="emergencyToggle" data-emergency-plan="${planId || ''}" role="switch" aria-checked="${!!isOn}" aria-label="ตั้งเป็นกองทุนฉุกเฉิน"></button>
    </div>
  `;
}

// ตั้งแผนนี้เป็นกองทุนฉุกเฉิน (ย้ายจากแผนเดิมถ้ามี) หรือยกเลิกสถานะ
function applyEmergencyType(plan, isEmergency) {
  if (isEmergency) {
    mock.plans.forEach((item) => {
      if (item !== plan && item.type === 'emergency') delete item.type;
    });
    plan.type = 'emergency';
    setEmergencyTileHidden(false);
  } else if (plan.type === 'emergency') {
    delete plan.type;
  }
}

function getPlanForecast(plan) {
  const ref = getAnalyzeReference();
  const left = Math.max(0, plan.target - plan.saved);
  const monthsToGo = plan.monthly_save > 0 ? Math.ceil(left / plan.monthly_save) : null;
  const finish = monthsToGo === null ? null : new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', calendar: 'gregory' }).format(new Date(ref.year, ref.month - 1 + monthsToGo, 1));
  return { left, monthsToGo, finish };
}

function renderPlanStatusPill(plan) {
  return plan.status === 'off_track'
    ? '<span class="pill warning">หลุดเป้า</span>'
    : plan.status === 'completed' ? '<span class="pill success">ครบเป้าแล้ว</span>' : '<span class="pill success">ปกติ</span>';
}

function openPlanDetail(plan) {
  const { left, monthsToGo, finish } = getPlanForecast(plan);
  const meta = getConfidenceMeta(plan.confidence || 'high');
  const lead = plan.status === 'completed'
    ? 'เก็บเงินครบตามเป้าหมายของแผนนี้แล้ว'
    : plan.status === 'off_track'
      ? 'ความคืบหน้าช้ากว่าที่ควรเป็นตามกำหนด ลองโอนเพิ่มหรือปรับยอดออมต่อเดือน'
      : 'ความคืบหน้าเป็นไปตามแผน รักษาจังหวะการออมไว้ให้ต่อเนื่อง';

  openInsightModal({
    title: plan.name,
    value: `${Math.round(clamp(plan.progress || 0))}%`,
    pill: renderPlanStatusPill(plan),
    progress: plan.progress || 0,
    lead,
    rows: [
      ['เก็บได้แล้ว', formatMoney(plan.saved)],
      ['เป้าหมาย', formatMoney(plan.target)],
      ['ยังขาดอีก', formatMoney(left)],
      ...(plan.type === 'emergency' ? [['ประเภท', 'กองทุนฉุกเฉิน']] : []),
      ['กำหนดเป้าหมาย', plan.dueMonth || '—'],
      ['ออมต่อเดือน', plan.monthly_save ? formatMoney(plan.monthly_save) : '—'],
      ['ถ้าออมตามนี้จะครบ', plan.status === 'completed' ? 'ครบแล้ว' : monthsToGo === null ? '—' : `ราว ${monthsToGo} เดือน (${finish})`],
      ['ความมั่นใจของแผน', meta.label],
    ],
    tip: plan.status === 'completed'
      ? 'ยินดีด้วย! ถ้าไม่ต้องใช้แผนนี้แล้ว สามารถลบออกได้'
      : 'โอนเงินเข้าแผนเป็นประจำ ระดับความมั่นใจของแผนจะดีขึ้นตามความคืบหน้า',
    footer: `
      <div class="an-detail-actions">
        <button class="primary-btn" type="button" data-plan-transfer="${plan.id}">โอนเข้าแผนนี้</button>
        <button class="secondary-btn" type="button" data-plan-edit="${plan.id}">แก้ไข</button>
        <button class="secondary-btn danger" type="button" data-plan-delete="${plan.id}">ลบ</button>
      </div>
    `,
  });
}

function openPlanMenu(plan) {
  const actions = [
    { attr: 'data-plan-detail', icon: 'info', title: 'ดูรายละเอียด', hint: 'ความคืบหน้า ยอดที่เหลือ และเวลาที่คาดว่าจะครบ' },
    { attr: 'data-plan-history', icon: 'history', title: 'ประวัติการเงิน', hint: 'ดูรายการที่โอนเข้าแผนนี้ทั้งหมด' },
    { attr: 'data-plan-transfer', icon: 'arrow-left-right', title: 'โอนเข้าแผนนี้', hint: 'เพิ่มเงินออมเข้าแผน' },
    { attr: 'data-plan-edit', icon: 'pencil', title: 'แก้ไขแผน', hint: 'ปรับชื่อ เป้าหมาย และยอดออมต่อเดือน' },
    { attr: 'data-plan-delete', icon: 'trash-2', title: 'ลบแผน', hint: 'ยกเลิกแผนนี้', danger: true },
  ];
  openModal(`
    <div class="modal-card small an-detail">
      <div class="modal-head">
        <h3>${escapeHtml(plan.name)}</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="an-action-list">
        ${actions.map((action) => `
          <button type="button" class="an-action ${action.danger ? 'danger' : ''}" ${action.attr}="${plan.id}">
            <span class="an-action-icon">${renderIcon(action.icon)}</span>
            <span class="an-action-text"><strong>${action.title}</strong><small>${action.hint}</small></span>
            ${renderIcon('chevron-right', 'an-row-arrow')}
          </button>
        `).join('')}
      </div>
    </div>
  `);
}

function openPlanHistory(plan) {
  const stamp = (entry) => `${entry.date} ${entry.time || '00:00'}`;
  const entries = (plan.history || []).slice().sort((a, b) => (stamp(a) === stamp(b) ? a.id - b.id : stamp(a) < stamp(b) ? -1 : 1));
  const recorded = entries.reduce((sum, entry) => sum + entry.amount, 0);
  // ยอดที่มีอยู่ก่อนเริ่มบันทึกประวัติ (ถ้ามี) นับเป็นยอดตั้งต้น เพื่อให้ยอดสะสมตรงกับยอดออมจริง
  const opening = Math.max(0, plan.saved - recorded);

  let running = opening;
  const withBalance = entries.map((entry) => {
    running += entry.amount;
    return { ...entry, balance: running };
  }).reverse();

  const formatDay = (dateKey) => {
    const [y, mo, d] = dateKey.split('-').map(Number);
    return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', calendar: 'gregory' }).format(new Date(y, mo - 1, d));
  };
  const formatMonth = (dateKey) => {
    const [y, mo] = dateKey.split('-').map(Number);
    return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', calendar: 'gregory' }).format(new Date(y, mo - 1, 1));
  };

  const groups = [];
  withBalance.forEach((entry) => {
    const key = entry.date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: formatMonth(entry.date), total: 0, items: [] };
      groups.push(group);
    }
    group.total += entry.amount;
    group.items.push(entry);
  });

  const average = entries.length ? Math.round(recorded / entries.length) : 0;
  const latest = withBalance[0];

  const list = groups.length
    ? groups.map((group) => `
        <div class="an-history-group">
          <div class="an-history-month"><span>${group.label}</span><strong>+${formatMoney(group.total)}</strong></div>
          ${group.items.map((entry) => `
            <div class="an-history-row">
              <span class="an-history-icon">${renderIcon('arrow-left-right')}</span>
              <span class="an-history-main"><strong>โอนเข้าแผน</strong><small>${formatDay(entry.date)}${entry.time ? ` · ${entry.time}` : ''}${entry.note ? ` · ${entry.note}` : ''}</small></span>
              <span class="an-history-amount"><strong>+${formatMoney(entry.amount)}</strong><small>สะสม ${formatMoneyShort(entry.balance)}</small></span>
              <button type="button" class="an-history-edit" data-history-edit="${plan.id}:${entry.id}" aria-label="แก้ไขรายการนี้">${renderIcon('pencil')}</button>
            </div>
          `).join('')}
        </div>
      `).join('')
    : '<p class="an-detail-lead an-history-empty">ยังไม่มีรายการโอนเข้าแผนนี้ กด "โอนเข้าแผนนี้" เพื่อเริ่มออม</p>';

  openModal(`
    <div class="modal-card small an-detail">
      <div class="modal-head">
        <h3>ประวัติการเงิน</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <p class="an-history-plan">${escapeHtml(plan.name)}</p>
      <div class="an-detail-hero">
        <strong>${formatMoney(plan.saved)}</strong>
        <span class="pill success">${entries.length} ครั้ง</span>
      </div>
      <p class="an-detail-lead">เงินที่ออมได้แล้วจากเป้า ${formatMoney(plan.target)}${entries.length ? ` · เฉลี่ยครั้งละ ${formatMoney(average)}${latest ? ` · ล่าสุด ${formatDay(latest.date)}` : ''}` : ''}</p>
      <div class="an-history-list">
        ${list}
        ${opening > 0 ? `<div class="an-history-opening"><span>ยอดตั้งต้น (ก่อนเริ่มบันทึกประวัติ)</span><strong>${formatMoney(opening)}</strong></div>` : ''}
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-plan-transfer="${plan.id}">โอนเข้าแผนนี้</button>
      </div>
    </div>
  `);
}

function findHistoryEntry(ref) {
  const [planId, entryId] = String(ref).split(':').map(Number);
  const plan = mock.plans.find((item) => sameId(item.id, planId));
  const entry = plan && (plan.history || []).find((item) => item.id === entryId);
  return plan && entry ? { plan, entry } : null;
}

// แก้ไข/ลบรายการโอนเข้าแผนที่ทำผิด: แก้จำนวน วันที่ เวลา หรือลบทิ้ง ยอดออมและความคืบหน้าของแผนคำนวณใหม่ให้
function openHistoryEntryEdit(plan, entry) {
  const ref = `${plan.id}:${entry.id}`;
  openModal(`
    <div class="modal-card small an-detail">
      <div class="modal-head">
        <h3>แก้ไขรายการโอน</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <p class="an-history-plan">${escapeHtml(plan.name)}</p>
      <div class="form-grid">
        <label class="form-field">
          <span>จำนวนเงิน (บาท)</span>
          <input id="historyAmount" type="number" inputmode="decimal" min="0" step="0.01" value="${entry.amount / 100}" />
        </label>
        <label class="form-field">
          <span>วันที่</span>
          ${renderCustomDateField('historyDate', entry.date)}
        </label>
        <label class="form-field">
          <span>เวลา</span>
          ${renderCustomTimeField('historyTime', entry.time || '09:00')}
        </label>
      </div>
      <div class="an-detail-actions">
        <button class="primary-btn" type="button" data-history-save="${ref}">บันทึก</button>
        <button class="secondary-btn" type="button" data-plan-history="${plan.id}">ยกเลิก</button>
        <button class="secondary-btn danger" type="button" data-history-delete="${ref}">ลบ</button>
      </div>
    </div>
  `);
  bindCustomDateField('historyDate');
  bindCustomTimeField('historyTime');
}

function openHistoryDeleteConfirm(plan, entry) {
  openModal(`
    <div class="modal-card small an-detail">
      <div class="modal-head">
        <h3>ลบรายการโอนนี้?</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <p class="an-detail-lead">รายการโอน <strong>${formatMoney(entry.amount)}</strong> ของแผน "${escapeHtml(plan.name)}" จะถูกลบ และยอดออมของแผนจะลดลงตามจำนวนนี้ (เหลือ ${formatMoney(Math.max(0, plan.saved - entry.amount))})</p>
      <div class="an-detail-actions two">
        <button class="secondary-btn" type="button" data-plan-history="${plan.id}">ยกเลิก</button>
        <button class="primary-btn danger" type="button" data-history-delete-confirm="${plan.id}:${entry.id}">ลบรายการ</button>
      </div>
    </div>
  `);
}

function openPlanDeleteConfirm(plan) {
  openModal(`
    <div class="modal-card small an-detail">
      <div class="modal-head">
        <h3>ลบแผนนี้?</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <p class="an-detail-lead">แผน "<strong>${escapeHtml(plan.name)}</strong>" จะถูกนำออกจากรายการ เงินที่ออมไว้ ${formatMoney(plan.saved)} จะไม่ถูกนับเป็นแผนอีกต่อไป</p>
      <div class="an-detail-actions two">
        <button class="secondary-btn" type="button" data-close-modal="true">ยกเลิก</button>
        <button class="primary-btn danger" type="button" data-plan-delete-confirm="${plan.id}">ลบแผน</button>
      </div>
    </div>
  `);
}

function openTrendDetail(type) {
  const { labels, income, expense } = mock.lineData;
  const index = analyzeState.trendIndex === null ? labels.length - 1 : analyzeState.trendIndex;
  const isIncome = type === 'income';
  const series = isIncome ? income : expense;
  const current = series[index];
  const previous = index > 0 ? series[index - 1] : null;
  const change = getPercentChange(current, previous);
  const average = Math.round(series.reduce((sum, value) => sum + value, 0) / series.length);
  const maxIndex = series.indexOf(Math.max(...series));
  const minIndex = series.indexOf(Math.min(...series));
  const net = income[index] - expense[index];
  const limit = safeNumber(mock.summary.monthlyBudgetLimit);
  const overLimit = current - limit;
  const upTone = isIncome ? 'success' : 'warning';
  const diffText = previous === null ? '—' : `${current - previous >= 0 ? '+' : '-'}${formatMoney(Math.abs(current - previous))}`;

  const rows = [
    [`${isIncome ? 'รายรับ' : 'รายจ่าย'}เดือน ${labels[index]}`, formatMoney(current)],
    ['เดือนก่อน', previous === null ? '—' : formatMoney(previous)],
    ['ส่วนต่างจากเดือนก่อน', diffText],
    [`เฉลี่ย ${labels.length} เดือน`, formatMoney(average)],
    ['เดือนที่สูงสุด', `${labels[maxIndex]} · ${formatMoney(series[maxIndex])}`],
    ['เดือนที่ต่ำสุด', `${labels[minIndex]} · ${formatMoney(series[minIndex])}`],
  ];
  if (isIncome) {
    rows.push([`รายรับ − รายจ่าย (${labels[index]})`, `${net >= 0 ? '+' : '-'}${formatMoney(Math.abs(net))}`]);
  } else {
    rows.push(['งบประมาณต่อเดือน', formatMoney(limit)]);
    rows.push([overLimit > 0 ? 'เกินงบ' : 'ต่ำกว่างบ', formatMoney(Math.abs(overLimit))]);
  }

  openInsightModal({
    title: `${isIncome ? 'รายรับ' : 'รายจ่าย'} ${labels[index]}`,
    value: formatMoney(current),
    pill: change === null ? '' : `<span class="pill ${change > 0 ? upTone : change < 0 ? (isIncome ? 'warning' : 'success') : 'success'}">${change > 0 ? '+' : ''}${change}% จากเดือนก่อน</span>`,
    lead: isIncome
      ? 'เงินที่เข้ามาทั้งหมดในเดือนที่เลือก เลือกเดือนอื่นในกราฟแท่งเพื่อดูเดือนนั้น'
      : 'เงินที่ใช้จ่ายทั้งหมดในเดือนที่เลือก เลือกเดือนอื่นในกราฟแท่งเพื่อดูเดือนนั้น',
    rows,
    tip: isIncome
      ? (net >= 0 ? `เดือนนี้รายรับมากกว่ารายจ่าย เหลือ ${formatMoney(net)} เก็บออมได้` : `เดือนนี้รายจ่ายมากกว่ารายรับ ${formatMoney(Math.abs(net))} ควรระวังการใช้จ่าย`)
      : (overLimit > 0 ? `รายจ่ายเกินงบ ${formatMoney(overLimit)} ลองทบทวนหมวดที่ไม่จำเป็น` : `รายจ่ายอยู่ในงบ เหลือ ${formatMoney(Math.abs(overLimit))}`),
    action: { label: 'ดูรายการในหน้าประวัติ', run: () => { window.location.href = 'transactions.html'; } },
  });
}

// ---------- จำลองผลกระทบก่อนซื้อ ----------
// อิงงบเดือนนี้ที่เหลือ + จำนวนวันที่เหลือ: ดูว่าซื้อแล้ว "ใช้ได้เฉลี่ยวันละเท่าไร" เทียบกับก่อนซื้อ
// (ไม่เอา "เงินที่ใช้ได้วันนี้" มาเทียบราคาโดยตรง เพราะเป็นคนละหน่วยกับราคาก้อนเดียวและทำให้สับสนว่าเกินงบหรือไม่)
function getPurchaseSimulation() {
  const priceInput = document.getElementById('purchasePrice');
  const price = Math.round(Math.max(0, Number(priceInput ? priceInput.value : 0) || 0) * 100);

  // 🔴 แก้บั๊ก: ผู้ใช้ที่ยังไม่เคยตั้งงบสักหมวด totalLimitSatang = 0
  // budgetLeft จึงเป็น 0 แล้วทุกราคาถูกตัดสินว่า "เกินงบเดือนนี้" ทั้งที่ระบบไม่รู้งบเลย
  // คำตอบผิดที่ฟังดูมั่นใจ แย่กว่าการบอกตรงๆ ว่ายังตอบไม่ได้
  const hasBudget = safeNumber(mock.summary.monthlyBudgetLimit) > 0;

  const budgetLeft = safeNumber(mock.summary.monthlyBudgetLimit) - safeNumber(mock.summary.monthlyBudgetUsed);
  const ref = getAnalyzeReference();
  const daysLeft = ref.daysLeft;
  const days = Math.max(1, daysLeft);
  const { income, expense } = mock.lineData;
  // ⚖️ G1: กำลังออมต่อเดือนต้องมาจาก service (/api/plans capacity) ห้ามหน้าเว็บเฉลี่ยเอง
  // ค่าเฉลี่ยด้านล่างเป็นทางสำรองสำหรับโหมด mock เท่านั้น
  const monthlySaving = typeof mock.summary.savingCapacity === 'number'
    ? mock.summary.savingCapacity
    : (income.length
      ? Math.round(income.reduce((sum, value, i) => sum + (value - expense[i]), 0) / income.length)
      : 0);

  const afterBuy = budgetLeft - price;
  const perDayBefore = budgetLeft > 0 ? Math.round(budgetLeft / days) : 0;
  const perDayAfter = afterBuy > 0 ? Math.round(afterBuy / days) : 0;
  const dropPercent = perDayBefore > 0 ? Math.round((1 - perDayAfter / perDayBefore) * 100) : null;
  const overBy = Math.max(0, price - Math.max(0, budgetLeft));
  const monthsToSave = price > 0 && monthlySaving > 0 ? Math.ceil(price / monthlySaving) : null;
  const saveDate = monthsToSave === null ? null : new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', calendar: 'gregory' }).format(new Date(ref.year, ref.month - 1 + monthsToSave, 1));

  // ไม่เกินครึ่งของงบที่เหลือ = ok · เกินครึ่งแต่ยังอยู่ในงบ = warn · เกินงบที่เหลือ = over
  let tone = 'ok';
  let verdict = 'ใส่ราคาที่อยากซื้อ เพื่อดูว่ากระทบงบแค่ไหน';
  if (!hasBudget) {
    // ยังไม่มีงบให้เทียบ = ไม่ตัดสิน บอกไปตรงๆ ว่าต้องตั้งงบก่อน
    tone = '';
    verdict = 'ต้องตั้งงบรายเดือนก่อน ระบบจึงจะบอกได้ว่าการซื้อนี้กระทบงบแค่ไหน';
  } else if (price > 0) {
    if (price > budgetLeft) {
      tone = 'over';
      verdict = `เกินงบเดือนนี้ ${formatMoney(overBy)} ไม่เหลืองบให้ใช้รายวันจนสิ้นเดือน${monthsToSave === null ? '' : ` · ออมก่อนราว ${monthsToSave} เดือนจะไม่กระทบงบ`}`;
    } else if (afterBuy === 0) {
      tone = 'warn';
      verdict = 'ซื้อได้ แต่งบที่เหลือจะหมดพอดี ไม่เหลือให้ใช้รายวันจนสิ้นเดือน';
    } else if (price > budgetLeft * 0.5) {
      tone = 'warn';
      verdict = `ซื้อได้ แต่งบที่เหลือจะลดเกินครึ่ง เหลือใช้เฉลี่ยวันละ ${formatMoneyShort(perDayAfter)} (เดิม ${formatMoneyShort(perDayBefore)})`;
    } else {
      verdict = `ซื้อได้ และงบยังพอใช้ถึงสิ้นเดือน เฉลี่ยวันละ ${formatMoneyShort(perDayAfter)} (เดิม ${formatMoneyShort(perDayBefore)})`;
    }
  }
  return { hasBudget, price, budgetLeft, daysLeft, days, monthlySaving, afterBuy, perDayBefore, perDayAfter, dropPercent, overBy, monthsToSave, saveDate, tone, verdict };
}

function renderPurchaseSimulation() {
  const sim = getPurchaseSimulation();
  const set = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  set('buyNowResult', formatMoney(sim.price));
  if (!sim.hasBudget) {
    set('buyNowNote', 'ยังไม่ได้ตั้งงบ');
    set('saveLaterResult', '—');
    set('saveLaterNote', 'ตั้งงบที่หน้าหมวดหมู่ก่อน');
  } else {
    set('buyNowNote', sim.price === 0
      ? 'ยังไม่ได้ใส่ราคา'
      : sim.afterBuy >= 0
        ? `งบเหลือ ${formatMoney(sim.afterBuy)} · วันละ ${formatMoneyShort(sim.perDayAfter)}`
        : `เกินงบ ${formatMoney(sim.overBy)} · ไม่เหลือให้ใช้รายวัน`);
    set('saveLaterResult', sim.monthsToSave === null ? '—' : `${sim.monthsToSave} เดือน`);
    set('saveLaterNote', sim.price === 0 ? 'ยังไม่ได้ใส่ราคา' : sim.monthsToSave === null ? 'ตอนนี้ยังเก็บเงินไม่ได้' : `ออมเดือนละ ${formatMoney(sim.monthlySaving)} ครบราว ${sim.saveDate}`);
  }
  const verdict = document.getElementById('simVerdict');
  if (verdict) {
    verdict.textContent = sim.verdict;
    verdict.className = `an-sim-verdict ${sim.tone}`;
  }
}

// กด "จำลอง": เปิดหน้าสรุปผลเต็ม (ตัวเลขในการ์ดอัปเดตสดอยู่แล้วตอนพิมพ์ ปุ่มนี้จึงต้องมีผลให้เห็นชัดกว่านั้น)
function openPurchaseResult() {
  const priceInput = document.getElementById('purchasePrice');
  const sim = getPurchaseSimulation();
  renderPurchaseSimulation();
  if (sim.price <= 0) {
    if (priceInput) {
      priceInput.classList.add('invalid');
      priceInput.focus();
    }
    return;
  }

  // ยังไม่ได้ตั้งงบ = ไม่มีอะไรให้เทียบ ต้องหยุดที่นี่
  // ถ้าปล่อยผ่าน toneMap[''] เป็น undefined แล้ว tone.pill โยน TypeError กด "จำลอง" แล้วเงียบ
  if (!sim.hasBudget) {
    openInsightModal({
      title: 'จำลองผลกระทบก่อนซื้อ',
      value: formatMoney(sim.price),
      lead: 'ระบบยังไม่รู้งบรายเดือนของคุณ จึงบอกไม่ได้ว่าการซื้อนี้กระทบแค่ไหน',
      rows: [],
      tip: 'ตั้งงบรายหมวดที่หน้า "หมวดหมู่" แล้วกลับมาลองอีกครั้ง',
    });
    return;
  }

  const toneMap = {
    ok: { pill: 'success', label: 'ซื้อได้' },
    warn: { pill: 'warning', label: 'ซื้อได้ แต่กินงบมาก' },
    over: { pill: 'danger', label: 'เกินงบเดือนนี้' },
  };
  const tone = toneMap[sim.tone];
  const isOver = sim.tone === 'over';
  const noneLeft = sim.afterBuy <= 0;
  const daysText = sim.daysLeft > 0 ? `เหลืออีก ${sim.daysLeft} วัน` : 'วันสุดท้ายของเดือน';

  const compare = `
    <div class="an-compare ${noneLeft && !isOver ? 'warn' : sim.tone}">
      <div class="an-compare-col">
        <small>ก่อนซื้อ</small>
        <strong>${formatMoneyShort(sim.perDayBefore)}</strong>
        <span>ใช้ได้เฉลี่ยต่อวัน</span>
      </div>
      <div class="an-compare-arrow">${renderIcon('chevron-right')}</div>
      <div class="an-compare-col after">
        <small>หลังซื้อ</small>
        <strong>${formatMoneyShort(sim.perDayAfter)}</strong>
        <span>${noneLeft ? 'ไม่เหลือให้ใช้' : 'ใช้ได้เฉลี่ยต่อวัน'}</span>
      </div>
    </div>
    <p class="an-compare-note">${daysText} · ${isOver ? `เกินงบ ${formatMoney(sim.overBy)}` : noneLeft ? 'งบหมดพอดี' : sim.dropPercent === null ? '' : `เฉลี่ยรายวันลดลง ${sim.dropPercent}%`}</p>
  `;

  openInsightModal({
    title: 'ผลจำลองการซื้อ',
    value: formatMoney(sim.price),
    pill: `<span class="pill ${tone.pill}">${tone.label}</span>`,
    lead: sim.verdict,
    extra: compare,
    rows: [
      ['งบเดือนนี้คงเหลือ (ก่อนซื้อ)', formatMoney(Math.max(0, sim.budgetLeft))],
      ['งบคงเหลือหลังซื้อ', isOver ? `<span class="neg">ติดลบ ${formatMoney(sim.overBy)}</span>` : formatMoney(sim.afterBuy)],
      ['ถ้าออมก่อนแล้วค่อยซื้อ', sim.monthsToSave === null ? 'ตอนนี้ยังเก็บเงินไม่ได้' : `ราว ${sim.monthsToSave} เดือน (${sim.saveDate})`],
    ],
    tip: sim.tone === 'ok'
      ? 'ราคานี้ไม่เกินครึ่งของงบที่เหลือ ซื้อได้ และงบยังพอใช้ถึงสิ้นเดือน'
      : sim.tone === 'warn'
        ? 'ซื้อได้ แต่รายจ่ายที่เหลือของเดือนต้องใช้ให้น้อยลง ลองชะลอรายจ่ายที่ไม่จำเป็น'
        : 'ถ้าไม่จำเป็นต้องได้ทันที การออมก่อนจะไม่ทำให้เดือนนี้ติดลบ',
    action: { label: 'อธิบายวิธีคิด', run: openSimulationExplain },
  });
}

function openSimulationExplain() {
  const sim = getPurchaseSimulation();
  const hasPrice = sim.price > 0;
  openInsightModal({
    title: 'วิธีอ่านผลจำลอง',
    value: hasPrice ? formatMoney(sim.price) : '—',
    lead: 'จำลองว่าถ้าซื้อของราคานี้ งบที่เหลือของเดือนนี้จะใช้ได้วันละเท่าไร โดยใช้ตัวเลขจริงจากบัญชี ไม่ได้ตัดเงินหรือบันทึกรายการจริง',
    rows: [
      ['ราคาที่อยากซื้อ', hasPrice ? formatMoney(sim.price) : 'ยังไม่ได้ใส่'],
      ['งบเดือนนี้คงเหลือ', formatMoney(Math.max(0, sim.budgetLeft))],
      ['จำนวนวันที่เหลือในเดือน', `${sim.daysLeft} วัน`],
      ['เก็บได้เฉลี่ยต่อเดือน', sim.monthlySaving > 0 ? formatMoney(sim.monthlySaving) : 'ยังเก็บไม่ได้'],
    ],
    extra: `
      <div class="an-explain">
        <h4>ใช้ได้เฉลี่ยต่อวัน</h4>
        <p>เอางบที่เหลือ ÷ จำนวนวันที่เหลือในเดือน ก่อนซื้อและหลังซื้อ จะเห็นว่าซื้อแล้วต้องประหยัดขึ้นแค่ไหน ถ้าหลังซื้อเงินติดลบ แปลว่าเกินงบ และไม่เหลือให้ใช้รายวัน</p>
        <strong>${hasPrice ? (sim.tone === 'over' ? `หลังซื้อเกินงบ ${formatMoney(sim.overBy)}` : `วันละ ${formatMoneyShort(sim.perDayBefore)} → ${formatMoneyShort(sim.perDayAfter)}`) : 'ใส่ราคาเพื่อดูผล'}</strong>
      </div>
      <div class="an-explain">
        <h4>ออมก่อนแล้วค่อยซื้อ</h4>
        <p>เอาราคา ÷ เงินที่เก็บได้เฉลี่ยต่อเดือน (รายรับ − รายจ่าย เฉลี่ย ${mock.lineData.labels.length} เดือนที่ผ่านมา) แล้วปัดขึ้นเป็นจำนวนเดือน</p>
        <strong>${hasPrice ? (sim.monthsToSave === null ? 'ตอนนี้ยังเก็บเงินไม่ได้ จึงคำนวณไม่ได้' : `ราว ${sim.monthsToSave} เดือน (${sim.saveDate})`) : 'ใส่ราคาเพื่อดูผล'}</strong>
      </div>
      <div class="an-explain">
        <h4>ข้อความสรุป 3 ระดับ</h4>
        <p>ราคาไม่เกินครึ่งของงบที่เหลือ = ซื้อได้ · เกินครึ่งจนถึงหมดพอดี = ซื้อได้ แต่กินงบมาก · เกินงบที่เหลือ = เกินงบเดือนนี้ แนะนำออมก่อน</p>
      </div>
    `,
    tip: 'เป็นการประมาณจากพฤติกรรมที่ผ่านมา ไม่รวมรายรับหรือรายจ่ายพิเศษที่อาจเกิดขึ้นในอนาคต',
  });
}

function openConfidenceModal() {
  const current = mock.summary.safeToSpendConfidence || 'high';
  const levels = [
    { key: 'high', text: 'มีข้อมูลต่อเนื่องและครบถ้วน ตัวเลขค่อนข้างเชื่อถือได้' },
    { key: 'medium', text: 'มีข้อมูลระดับหนึ่ง ตัวเลขใช้อ้างอิงได้ แต่อาจคลาดเคลื่อนเล็กน้อย' },
    { key: 'low', text: 'ข้อมูลยังน้อย เป็นการประเมินเบื้องต้นเท่านั้น' },
  ];
  openModal(`
    <div class="modal-card small an-detail">
      <div class="modal-head">
        <h3>ความมั่นใจของการประเมิน</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <p class="an-detail-lead">บอกว่าตัวเลข "ใช้อย่างปลอดภัยได้" และการคาดการณ์น่าเชื่อถือแค่ไหน ขึ้นอยู่กับปริมาณข้อมูลที่บันทึกไว้ (ตอนนี้ ${safeNumber(mock.summary.daysOfData)} วัน)</p>
      <div class="an-confidence-list">
        ${levels.map((level) => `
          <div class="an-confidence-item ${level.key === current ? 'active' : ''}">
            ${renderConfidenceBadge(level.key)}
            <span>${level.text}</span>
          </div>
        `).join('')}
      </div>
      <p class="an-detail-tip">${renderIcon('sparkles')}<span>บันทึกรายรับรายจ่ายต่อเนื่องทุกวัน ระดับความมั่นใจจะสูงขึ้นเอง</span></p>
    </div>
  `);
}

// โดนัท SVG: แต่ละส่วนเป็นวงแหวนที่ hover/แตะแล้วมี popover เหมือนแถบงบในหน้าอื่น
const DONUT_RADIUS = 78;
const DONUT_STROKE = 28;

function getDonutTipAnchor(segment, data) {
  const svg = segment.ownerSVGElement;
  const rect = svg.getBoundingClientRect();
  const scale = rect.width / 200;
  return { x: rect.left + data.anchor.x * scale, y: rect.top + data.anchor.y * scale, below: data.anchor.below };
}

function renderAnalyzeDonut() {
  const { labels, values, colors } = mock.donutData;
  const chart = document.getElementById('analyzeDonutChart');

  if (chart) {
    const circumference = 2 * Math.PI * DONUT_RADIUS;
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    const gap = values.length > 1 ? 2 : 0;
    const outer = DONUT_RADIUS + DONUT_STROKE / 2;
    let cursor = 0;
    analyzeDonutTip.data.clear();

    const segments = values.map((value, i) => {
      const share = value / total;
      const length = Math.max(0, share * circumference - gap);
      const angle = (cursor + share / 2) * 2 * Math.PI - Math.PI / 2;
      const key = `donut-${i}`;
      // ยอดของแต่ละหมวดมาจาก API ตรงๆ (donutData.amounts) ไม่คูณกลับจากเปอร์เซ็นต์ที่ปัดแล้ว
      const amount = mock.donutData.amounts
        ? safeNumber(mock.donutData.amounts[i])
        : Math.round(safeNumber(mock.summary.expense) * share);
      analyzeDonutTip.data.set(key, {
        tipHtml: `
          <span class="overview-tip-title"><i class="legend-dot" style="background: ${colors[i]}"></i>${labels[i]}</span>
          <span class="overview-tip-amount">${formatMoney(amount)}</span>
          <span class="overview-tip-meta">${Math.round(share * 100)}% ของรายจ่ายเดือนนี้</span>
        `,
        anchor: { x: 100 + outer * Math.cos(angle), y: 100 + outer * Math.sin(angle), below: Math.sin(angle) > 0.2 },
      });
      const circle = `<circle class="an-donut-seg" data-overview-seg="${key}" tabindex="0" role="button" aria-label="${labels[i]} ${Math.round(share * 100)}%" cx="100" cy="100" r="${DONUT_RADIUS}" fill="none" stroke="${colors[i]}" stroke-width="${DONUT_STROKE}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-cursor * circumference}" transform="rotate(-90 100 100)"/>`;
      cursor += share;
      return circle;
    }).join('');

    chart.innerHTML = `
      <svg viewBox="0 0 200 200" role="img" aria-label="สัดส่วนรายจ่ายตามหมวด">${segments}</svg>
      <div class="an-donut-center" id="analyzeDonutCenter"><span>รายจ่ายเดือนนี้</span><strong>${formatMoneyShort(mock.summary.expense)}</strong></div>
    `;
  }

  const legend = document.getElementById('analyzeDonutLegend');
  if (legend) {
    legend.innerHTML = labels.map((label, i) => `
      <button type="button" class="an-legend-row" data-donut-legend="donut-${i}">
        <i class="legend-dot" style="background: ${colors[i]}"></i>
        <span>${label}</span>
        <strong>${values[i]}%</strong>
      </button>
    `).join('');
  }

  const emptyState = document.getElementById('emptyStateAnalyze');
  // daysOfData เป็น null เมื่อ API ยังไม่ส่งค่านี้มา — ระวัง null < 7 ได้ true
  // ไม่รู้จำนวนวัน ไม่เท่ากับ รู้ว่าข้อมูลน้อย จึงไม่ควรขึ้นข้อความเตือน
  const daysOfData = mock.summary.daysOfData;
  if (emptyState) emptyState.hidden = !(typeof daysOfData === 'number' && daysOfData < 7);
}

function renderAnalyzeCategory() {
  const container = document.getElementById('analyzeCategory');
  if (!container) return;

  const history = mock.monthlyHistory || [];
  if (!history.length) return;
  if (!history.some((month) => month.key === analyzeState.monthKey)) {
    analyzeState.monthKey = history[history.length - 1].key;
  }

  const expenseCategories = getAnalyzeExpenseCategories();
  const isAll = analyzeState.categoryId === 'all';
  const category = isAll ? null : expenseCategories.find((item) => item.id === analyzeState.categoryId);
  if (!isAll && !category) analyzeState.categoryId = 'all';

  const valueOf = (month) => (category
    ? safeNumber(month.usage[category.id])
    : expenseCategories.reduce((sum, item) => sum + safeNumber(month.usage[item.id]), 0));
  const limitAmount = category
    ? safeNumber(category.limit)
    : expenseCategories.reduce((sum, item) => sum + safeNumber(item.limit), 0);

  const values = history.map(valueOf);
  const selectedIndex = Math.max(0, history.findIndex((month) => month.key === analyzeState.monthKey));
  const selectedMonth = history[selectedIndex];
  const selectedValue = values[selectedIndex];
  const scaleMax = Math.max(...values, limitAmount, 1) / 0.76;
  const limitPercent = (limitAmount / scaleMax) * 100;
  const previousValue = selectedIndex > 0 ? values[selectedIndex - 1] : null;
  const change = getPercentChange(selectedValue, previousValue);
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const remaining = limitAmount - selectedValue;
  const [yearNumber, monthNumber] = selectedMonth.key.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', calendar: 'gregory' }).format(new Date(yearNumber, monthNumber - 1, 1));

  const chips = [
    `<button type="button" class="an-chip icon-only ${isAll ? 'active' : ''}" data-analyze-chip="all" aria-label="ทุกหมวด">${renderIcon('layout-grid')}</button>`,
    ...expenseCategories.map((item) => {
      const active = category && category.id === item.id;
      return `<button type="button" class="an-chip ${active ? 'active' : ''}" data-analyze-chip="${item.id}"><i class="legend-dot" style="background: ${item.color}"></i>${escapeHtml(item.name)}${active ? renderIcon('x') : ''}</button>`;
    }),
  ].join('');

  const bars = history.map((month, index) => {
    const heightPercent = (values[index] / scaleMax) * 100;
    return `
      <button type="button" class="history-col ${index === selectedIndex ? 'selected' : ''}" data-analyze-month="${month.key}" aria-label="${month.label}">
        <span class="history-plot">
          <span class="history-limit" style="bottom: ${limitPercent}%"></span>
          <span class="history-value" style="bottom: calc(${heightPercent}% + 26px)">${formatMoneyShort(values[index])}</span>
          <span class="history-dash" style="bottom: calc(${heightPercent}% + 4px)"></span>
          <span class="history-bar" style="height: ${heightPercent}%"></span>
        </span>
        <span class="history-label">${month.label.split(' ')[0]}</span>
      </button>
    `;
  }).join('');

  const changeText = change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`;
  const scopeName = category ? category.name : 'รายจ่ายทั้งหมด';
  const shortMonth = selectedMonth.label.split(' ')[0];
  const usedPercent = limitAmount > 0 ? Math.round((selectedValue / limitAmount) * 100) : 0;
  const signed = (value) => `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatMoney(Math.abs(value))}`;
  const monthRows = history.map((month, i) => [month.label.split(' ')[0], formatMoney(values[i])]);

  analyzeState.catInsights = {
    spent: {
      title: `ยอดที่ใช้ · ${scopeName}`,
      value: formatMoney(selectedValue),
      pill: `<span class="pill ${usedPercent >= 100 ? 'danger' : usedPercent >= 85 ? 'warning' : 'success'}">${usedPercent}% ของงบ</span>`,
      progress: usedPercent,
      lead: `ยอดใช้จ่ายรวมของ ${scopeName} ในเดือน ${monthName}`,
      rows: [['ใช้ไป', formatMoney(selectedValue)], ['งบประมาณ', formatMoney(limitAmount)], [remaining >= 0 ? 'เหลือจากงบ' : 'เกินงบ', formatMoney(Math.abs(remaining))]],
      tip: usedPercent >= 100 ? 'ใช้เกินงบที่ตั้งไว้แล้ว ลองปรับงบหรือลดการใช้จ่ายในหมวดนี้' : 'ยังอยู่ในงบที่ตั้งไว้',
    },
    change: {
      title: `เทียบกับเดือนก่อน · ${scopeName}`,
      value: changeText,
      pill: change === null || change === 0 ? '' : `<span class="pill ${change > 0 ? 'warning' : 'success'}">${change > 0 ? 'ใช้เพิ่มขึ้น' : 'ใช้ลดลง'}</span>`,
      lead: 'เปรียบเทียบยอดใช้จ่ายของเดือนที่เลือกกับเดือนก่อนหน้า ถ้าเป็นเดือนแรกในกราฟจะยังไม่มีข้อมูลเทียบ',
      rows: [[`เดือน ${shortMonth}`, formatMoney(selectedValue)], ['เดือนก่อน', previousValue === null ? '—' : formatMoney(previousValue)], ['ส่วนต่าง', previousValue === null ? '—' : signed(selectedValue - previousValue)]],
      tip: change === null ? 'เลือกเดือนถัดไปเพื่อดูการเปรียบเทียบ' : change > 0 ? 'ใช้มากกว่าเดือนก่อน ลองดูว่ามีรายการใหญ่ผิดปกติหรือไม่' : change < 0 ? 'ใช้น้อยกว่าเดือนก่อน ทำได้ดี' : 'ใช้เท่ากับเดือนก่อน',
    },
    remaining: {
      title: `${remaining >= 0 ? 'เหลือจากงบ' : 'เกินงบ'} · ${scopeName}`,
      value: formatMoney(Math.abs(remaining)),
      pill: `<span class="pill ${remaining >= 0 ? 'success' : 'danger'}">${remaining >= 0 ? 'ยังอยู่ในงบ' : 'เกินงบ'}</span>`,
      progress: usedPercent,
      lead: 'ส่วนต่างระหว่างงบประมาณที่ตั้งไว้กับยอดที่ใช้จริงในเดือนที่เลือก',
      rows: [['งบประมาณ', formatMoney(limitAmount)], ['ใช้ไป', formatMoney(selectedValue)], [remaining >= 0 ? 'เหลือ' : 'เกินงบ', formatMoney(Math.abs(remaining))], ['ใช้ไปแล้ว', `${usedPercent}%`]],
      tip: remaining >= 0 ? 'ยังมีงบเหลือให้ใช้ในเดือนนั้น' : 'ควรทบทวนงบของหมวดนี้ให้สมจริงขึ้น',
    },
    average: {
      title: `เฉลี่ยต่อเดือน · ${scopeName}`,
      value: formatMoney(average),
      lead: `ค่าเฉลี่ยของยอดใช้จ่ายย้อนหลัง ${history.length} เดือน ใช้ดูว่าเดือนที่เลือกสูงหรือต่ำกว่าปกติ`,
      rows: [...monthRows, ['เดือนที่เลือกเทียบค่าเฉลี่ย', signed(selectedValue - average)]],
      tip: selectedValue > average ? 'เดือนนี้ใช้สูงกว่าค่าเฉลี่ย' : 'เดือนนี้ใช้ไม่เกินค่าเฉลี่ย',
    },
  };

  const tiles = [
    { key: 'spent', icon: 'wallet', value: formatMoneyShort(selectedValue), label: 'ยอดที่ใช้' },
    { key: 'change', icon: change !== null && change < 0 ? 'trending-down' : 'trending-up', value: changeText, label: 'เทียบเดือนก่อน', tone: change === null || change === 0 ? '' : (change > 0 ? 'up' : 'down') },
    { key: 'remaining', icon: remaining < 0 ? 'triangle-alert' : 'check', value: formatMoneyShort(Math.abs(remaining)), label: remaining >= 0 ? 'เหลือจากงบ' : 'เกินงบ' },
    { key: 'average', icon: 'bar-chart-3', value: formatMoneyShort(average), label: 'เฉลี่ยต่อเดือน' },
  ].map((tile) => `
    <button type="button" class="an-tile tappable" data-cat-insight="${tile.key}">
      <span class="an-tile-icon">${renderIcon(tile.icon)}</span>
      <strong class="${tile.tone || ''}">${tile.value}</strong>
      <span>${tile.label}</span>
      ${renderIcon('chevron-right', 'an-tile-arrow')}
    </button>
  `).join('');

  let listRows;
  if (category) {
    const peakValue = Math.max(...values);
    const peakMonth = history[values.indexOf(peakValue)];
    const diff = previousValue === null ? null : selectedValue - previousValue;
    listRows = `
      <div class="an-list-row static"><span>เทียบกับเดือนก่อน</span><strong>${diff === null ? '—' : `${diff > 0 ? '+' : diff < 0 ? '-' : ''}${formatMoneyShort(Math.abs(diff))}`}</strong></div>
      <div class="an-list-row static"><span>เดือนที่ใช้สูงสุด</span><strong>${peakMonth.label.split(' ')[0]} · ${formatMoneyShort(peakValue)}</strong></div>
      <button type="button" class="an-list-row" data-analyze-goto="${category.id}"><span>ดูรายการเดือนนี้ในหน้าประวัติ</span>${renderIcon('chevron-right')}</button>
    `;
  } else {
    const totalSelected = selectedValue || 1;
    listRows = expenseCategories
      .map((item) => ({ item, used: safeNumber(selectedMonth.usage[item.id]) }))
      .sort((a, b) => b.used - a.used)
      .map(({ item, used }) => {
        const share = Math.round((used / totalSelected) * 100);
        return `
          <button type="button" class="an-list-row rich" data-analyze-cat="${item.id}">
            <span class="category-badge" style="background: ${item.color}26; color: ${item.color}">${renderCategoryIcon(item.icon)}</span>
            <span class="an-list-main">
              <strong>${escapeHtml(item.name)}</strong>
              <span class="an-list-bar"><i style="width: ${share}%; background: ${item.color}"></i></span>
            </span>
            <span class="an-list-amount"><strong>${formatMoneyShort(used)}</strong><small>${share}%</small></span>
            ${renderIcon('chevron-right')}
          </button>
        `;
      }).join('');
  }

  container.innerHTML = `
    <section class="an-card an-cat-card">
      <div class="history-month-nav">
        <button type="button" class="icon-btn small" data-analyze-step="-1" aria-label="เดือนก่อนหน้า" ${selectedIndex === 0 ? 'disabled' : ''}>${renderIcon('chevron-left')}</button>
        <strong>${monthName}</strong>
        <button type="button" class="icon-btn small" data-analyze-step="1" aria-label="เดือนถัดไป" ${selectedIndex === history.length - 1 ? 'disabled' : ''}>${renderIcon('chevron-right')}</button>
      </div>
      <div class="an-chips">${chips}</div>
      <div class="history-chart" style="grid-template-columns: repeat(${history.length}, minmax(0, 1fr))">${bars}</div>
      <p class="history-legend"><span class="history-legend-dash"></span> งบประมาณ ${formatMoneyShort(limitAmount)}</p>
    </section>
    <div class="an-tiles four">${tiles}</div>
    <section class="an-card an-list">
      <div class="an-head"><h3>${category ? category.name : 'รายจ่ายแยกตามหมวด'}</h3></div>
      ${listRows}
    </section>
  `;
}

function setAnalyzeTab(tab) {
  analyzeState.tab = tab;
  document.querySelectorAll('[data-analyze-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.analyzeTab === tab);
  });
  const overview = document.getElementById('analyzePanelOverview');
  const category = document.getElementById('analyzePanelCategory');
  if (overview) overview.hidden = tab !== 'overview';
  if (category) category.hidden = tab !== 'category';
  if (tab === 'category') renderAnalyzeCategory();
}

// render อย่างเดียว เรียกซ้ำได้ (เช่น หลังแก้ไข/โอนเงินเข้าแผน) ส่วนการผูก event อยู่ใน bindAnalyzePage
/** SPEC §S2 + §S5.5 บังคับว่าเนื้อหาเชิงวางแผนต้องมีข้อความนี้กำกับทุกหน้า */
function renderPlanningDisclaimer() {
  if (document.getElementById('planningDisclaimer')) return;
  const main = document.querySelector('.page-content');
  if (!main) return;
  const note = document.createElement('p');
  note.id = 'planningDisclaimer';
  note.className = 'ai-disclaimer';
  note.style.textAlign = 'center';
  note.textContent = 'ℹ️ ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน';
  main.append(note);
}

function renderAnalyzePage() {
  renderPlanningDisclaimer();
  // ต้องวาดการ์ดจำลองซื้อใหม่ด้วย ไม่งั้นค้างตัวเลขจากข้อมูลชุดก่อนตอนโหลดข้อมูลจริงเสร็จ
  renderPurchaseSimulation();
  renderAnalyzeStatus();
  renderAnalyzeTrend();
  renderAnalyzeTiles();
  renderAnalyzeDonut();

  const badgeWrap = document.getElementById('safeToSpendBadgeWrap');
  if (badgeWrap) {
    badgeWrap.innerHTML = `<button type="button" class="an-badge-btn" aria-label="ดูความหมายของความมั่นใจ">${renderConfidenceBadge(mock.summary.safeToSpendConfidence || 'high')}${renderIcon('info')}</button>`;
  }

  renderPlanCards();
  if (analyzeState.tab === 'category') renderAnalyzeCategory();
}

// ผูก event ครั้งเดียวตอนเปิดหน้า (ของที่ render ใหม่ทุกครั้งใช้ delegation)
function bindAnalyzePage() {
  bindBarTip(analyzeDonutTip);

  const overviewPanel = document.getElementById('analyzePanelOverview');
  if (overviewPanel) {
    overviewPanel.addEventListener('click', (event) => {
      const insight = event.target.closest('[data-analyze-insight]');
      if (insight) {
        openInsightDetail(insight.dataset.analyzeInsight);
        return;
      }
      const trendDetail = event.target.closest('[data-trend-detail]');
      if (trendDetail) {
        openTrendDetail(trendDetail.dataset.trendDetail);
        return;
      }
      // แถวใน legend ของโดนัท: เปิด popover ของส่วนนั้น (หยุด bubble เพื่อไม่ให้ตัวปิด popover ของ document ทำงานทับ)
      const legendRow = event.target.closest('[data-donut-legend]');
      if (legendRow) {
        event.stopPropagation();
        const segment = document.querySelector(`[data-overview-seg="${legendRow.dataset.donutLegend}"]`);
        if (segment) showBarTip(analyzeDonutTip, segment);
      }
    });
  }

  const badgeWrap = document.getElementById('safeToSpendBadgeWrap');
  if (badgeWrap) {
    badgeWrap.addEventListener('click', (event) => {
      if (event.target.closest('button')) openConfidenceModal();
    });
  }

  document.querySelectorAll('[data-analyze-tab]').forEach((button) => {
    button.addEventListener('click', () => setAnalyzeTab(button.dataset.analyzeTab));
  });

  const trend = document.getElementById('analyzeTrend');
  if (trend) {
    trend.addEventListener('click', (event) => {
      const column = event.target.closest('[data-trend-index]');
      if (!column) return;
      analyzeState.trendIndex = Number(column.dataset.trendIndex);
      renderAnalyzeTrend();
    });
  }

  const categoryPanel = document.getElementById('analyzeCategory');
  if (categoryPanel) {
    categoryPanel.addEventListener('click', (event) => {
      const insightTile = event.target.closest('[data-cat-insight]');
      if (insightTile) {
        const detail = analyzeState.catInsights && analyzeState.catInsights[insightTile.dataset.catInsight];
        if (detail) openInsightModal(detail);
        return;
      }
      const chip = event.target.closest('[data-analyze-chip]');
      if (chip) {
        const value = chip.dataset.analyzeChip;
        const next = value === 'all' ? 'all' : value;
        analyzeState.categoryId = analyzeState.categoryId === next ? 'all' : next;
        renderAnalyzeCategory();
        return;
      }
      const monthBtn = event.target.closest('[data-analyze-month]');
      if (monthBtn) {
        analyzeState.monthKey = monthBtn.dataset.analyzeMonth;
        renderAnalyzeCategory();
        return;
      }
      const stepBtn = event.target.closest('[data-analyze-step]');
      if (stepBtn) {
        const history = mock.monthlyHistory || [];
        const current = history.findIndex((month) => month.key === analyzeState.monthKey);
        const next = history[current + Number(stepBtn.dataset.analyzeStep)];
        if (next) {
          analyzeState.monthKey = next.key;
          renderAnalyzeCategory();
        }
        return;
      }
      const catRow = event.target.closest('[data-analyze-cat]');
      if (catRow) {
        analyzeState.categoryId = catRow.dataset.analyzeCat;
        renderAnalyzeCategory();
        return;
      }
      const gotoBtn = event.target.closest('[data-analyze-goto]');
      if (gotoBtn) {
        window.location.href = `transactions.html?category=${gotoBtn.dataset.analyzeGoto}&month=${analyzeState.monthKey}`;
      }
    });
  }

  // ผูกที่ตัวการ์ดจำลองครั้งเดียว (ปุ่มจำลอง / ⓘ / ลิงก์อธิบาย) ผลตัวเลขอัปเดตสดตอนพิมพ์ราคา
  const simSection = document.querySelector('.an-sim');
  const priceInput = document.getElementById('purchasePrice');
  if (simSection && priceInput) {
    const infoBtn = document.getElementById('simExplainBtn');
    if (infoBtn) infoBtn.innerHTML = renderIcon('info');
    priceInput.addEventListener('input', () => {
      priceInput.classList.remove('invalid');
      renderPurchaseSimulation();
    });
    priceInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') openPurchaseResult();
    });
    simSection.addEventListener('click', (event) => {
      if (event.target.closest('#simulatePurchaseBtn')) openPurchaseResult();
      else if (event.target.closest('#simExplainBtn, #simExplainLink')) openSimulationExplain();
    });
    renderPurchaseSimulation();
  }

  const createPlanBtn = document.getElementById('createPlanBtn');
  if (createPlanBtn) {
    createPlanBtn.addEventListener('click', () => openPlanWizard());
  }
}

function toLocalDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// คำนวณความคืบหน้าของแผนใหม่จากยอดออม (ใช้หลังโอนเข้า แก้ไข หรือลบรายการในประวัติ)
// สถานะ "หลุดเป้า/ปกติ" ยังเป็นค่าที่ระบบกำหนด จึงเปลี่ยนเฉพาะตอนครบเป้า หรือถอยจากครบเป้ากลับมาเป็นปกติ
function recalcPlanProgress(plan) {
  plan.saved = Math.max(0, plan.saved);
  plan.progress = ((plan.saved / plan.target) * 100) || 0;
  if (plan.saved >= plan.target) {
    plan.status = 'completed';
    plan.confidence = 'high';
  } else if (plan.status === 'completed') {
    plan.status = 'normal';
  }
}

function openPlanTransfer(plan) {
  openAmountInputModal(0, (amount) => {
    if (window.jodtangPersist) {
      window.jodtangPersist.transferToPlan(plan.id, amount);
      return;
    }

    const now = new Date();
    plan.history = plan.history || [];
    plan.history.push({ id: Date.now(), date: toLocalDateKey(now), time: now.toTimeString().slice(0, 5), amount });
    plan.saved += amount;
    recalcPlanProgress(plan);
    renderAnalyzePage();
    renderDashboard();
    showSuccessModal('โอนเงินเข้าแผนสำเร็จ');
  }, `โอนเข้า ${plan.name}`);
}

function openPlanWizard(preset) {
  const wizardState = pageState.planWizard;
  const isEmergency = preset === 'emergency';
  wizardState.step = 1;
  wizardState.name = isEmergency ? 'กองทุนฉุกเฉิน' : '';
  wizardState.amount = isEmergency ? String(Math.round(getEmergencySuggestion().target / 100) || 150000) : '150000';
  wizardState.months = isEmergency ? '12' : '6';
  wizardState.mode = 'balanced';
  wizardState.emergency = isEmergency;

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
      ${renderEmergencyToggleRow(state.emergency, null)}
      <!-- boot.js เติมกำลังออมจริงจาก /api/plans/capacity ลงตรงนี้ โหมดตัวอย่างจะว่างไว้ -->
      <p id="planCapacityHint" class="an-note" hidden></p>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-plan-next="2">ต่อไป</button>
      </div>
    `;
  }

  if (state.step === 2) {
    const planStrategies = [
      { key: 'fast', label: 'เร็ว', icon: 'zap', hint: 'ต้นทุนสูง', save: safeNumber(state.amount) * 100 * 0.18 },
      { key: 'balanced', label: 'สมดุล', icon: 'scale', hint: 'ปลอดภัย', save: safeNumber(state.amount) * 100 * 0.12 },
      { key: 'relaxed', label: 'สบาย', icon: 'leaf', hint: 'ผ่อนคลาย', save: safeNumber(state.amount) * 100 * 0.08 },
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
    const target = safeNumber(state.amount) * 100;
    const monthly = Math.round(target / Math.max(1, safeNumber(state.months || 1)));
    const save = state.mode === 'fast' ? target * 0.18 : state.mode === 'balanced' ? target * 0.12 : target * 0.08;
    body.innerHTML = `
      <div class="plan-summary-card">
        <h4>${state.name || 'ออมซื้อไอเทม'}</h4>
        <div class="summary-row"><span>เป้าหมาย</span><strong>${formatMoney(target)}</strong></div>
        <div class="summary-row"><span>ต่อเดือน</span><strong>${formatMoney(Math.round(monthly))}</strong></div>
        <div class="summary-row"><span>รูปแบบ</span><strong>${renderIcon(getPlanStrategyMeta(state.mode).icon, 'strategy-icon')} ${getPlanStrategyMeta(state.mode).label}</strong></div>
        <div class="summary-row"><span>คาดการณ์ออม</span><strong>${formatMoney(Math.round(save))}</strong></div>
        ${state.emergency ? '<div class="summary-row"><span>ประเภท</span><strong>กองทุนฉุกเฉิน</strong></div>' : ''}
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

  if (window.jodtangPersist) {
    // backend เป็นคนสร้าง 3 ทางเลือกให้ (S5.3) หน้าเว็บห้ามเดายอดออมต่อเดือนเอง (G1)
    window.jodtangPersist.createPlan({
      title: state.name || 'ออมซื้อไอเทม',
      targetSatang: Math.round(safeNumber(state.amount) * 100),
      months: Math.max(1, safeNumber(state.months || 1)),
    });
    return;
  }

  const name = state.name || 'ออมซื้อไอเทม';
  const target = safeNumber(state.amount) * 100;
  const months = Math.max(1, safeNumber(state.months || 1));
  const nextPlan = {
    id: Date.now(),
    name,
    target,
    saved: 0,
    progress: 0,
    confidence: 'medium',
    status: 'normal',
    dueMonth: `ภายใน ${months} เดือน`,
    monthly_save: Math.round(target / months),
    strategy: state.mode,
    active: true,
  };

  mock.plans.push(nextPlan);
  applyEmergencyType(nextPlan, state.emergency);
  closeModal();
  renderAnalyzePage();
  renderDashboard();
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

/**
 * แจ้งว่าทำไม่ได้/ผิดพลาด — คนละตัวกับ showSuccessModal
 * เดิมข้อความปฏิเสธถูกยัดเข้า showSuccessModal ทำให้ขึ้นเครื่องหมายถูกสีเขียวกับหัวข้อ "สำเร็จ"
 * แล้วตามด้วยข้อความว่าทำไม่ได้ ซึ่งขัดกันเองจนผู้ใช้สับสน
 */
function showAlertModal(message, title = 'ยังทำไม่ได้') {
  openModal(`
    <div class="modal-card success-modal alert-modal">
      <div class="success-icon">${renderIcon('info')}</div>
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-close-modal="true">เข้าใจแล้ว</button>
      </div>
    </div>
  `);
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

// กรอกจำนวนเงินเป็นบาท (ช่อง input ธรรมดาเหมือนฟอร์มเพิ่มรายการ) แล้วส่งค่ากลับเป็นหน่วยที่ mock เก็บ (×100)
function openAmountInputModal(amountValue, onComplete, title = 'กรอกจำนวนเงิน') {
  const initial = safeNumber(amountValue) / 100;
  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>${escapeHtml(title)}</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="form-grid">
        <label class="form-field">
          <span>จำนวนเงิน (บาท)</span>
          <input id="amountModalInput" type="number" inputmode="decimal" min="0" step="0.01" value="${initial > 0 ? initial : ''}" placeholder="0" />
        </label>
      </div>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-amount-confirm="true">ยืนยัน</button>
      </div>
    </div>
  `;

  openModal(html);
  const input = document.getElementById('amountModalInput');
  const confirmBtn = document.querySelector('[data-amount-confirm]');

  const submit = () => {
    const amount = Math.round(Number(input.value) * 100);
    if (!(amount > 0)) {
      input.classList.add('invalid');
      input.focus();
      return;
    }
    onComplete(amount);
    closeModal();
  };

  input.addEventListener('input', () => input.classList.remove('invalid'));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });
  confirmBtn.addEventListener('click', submit);
  input.focus();
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

      // ต่อ API แล้ว: ให้ backend เป็นคนบันทึกและคืนยอดใหม่มา (ห้ามแก้ข้อมูลในเครื่องเอง)
      if (window.jodtangPersist) {
        window.jodtangPersist.createTransaction({
          type,
          amountSatang: Math.round(amountValue),
          categoryName: category,
          note: title,
          occurredAt: `${date}T${time}:00+07:00`,
        });
        return;
      }

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
  const transaction = mock.transactions.find((item) => sameId(item.id, transactionId));
  if (!transaction) return;

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>${escapeHtml(transaction.title)}</h3>
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
  const transaction = mock.transactions.find((item) => sameId(item.id, transactionId));
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
          <input id="editTxnTitle" value="${escapeHtml(transaction.title)}" />
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
      const nextItem = mock.transactions.find((item) => sameId(item.id, transactionId));
      if (!nextItem) return;
      const selectedType = document.querySelector('[data-edit-type].active')?.dataset.editType || nextItem.type;
      const nextDate = document.getElementById('editTxnDate')?.value || nextItem.dateKey || new Date().toISOString().slice(0, 10);
      const amountValue = safeNumber(document.getElementById('editTxnAmount')?.value) * 100;

      if (window.jodtangPersist) {
        window.jodtangPersist.updateTransaction(transactionId, {
          type: selectedType,
          amountSatang: Math.round(amountValue),
          categoryName: document.getElementById('editTxnCategory')?.value || undefined,
          note: document.getElementById('editTxnTitle')?.value || undefined,
          occurredAt: `${nextDate}T${getCustomTimeValue('editTxnTime')}:00+07:00`,
        });
        return;
      }

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
  const target = mock.transactions.find((item) => sameId(item.id, transactionId));
  if (!target) return;

  if (window.jodtangPersist) {
    window.jodtangPersist.deleteTransaction(transactionId);
    return;
  }

  mock.transactions = mock.transactions.filter((item) => !sameId(item.id, transactionId));
  transactionState.selectedIds = transactionState.selectedIds.filter((id) => !sameId(id, transactionId));
  closeModal();
  renderDashboard();
  renderTransactionsPage();
  showSuccessModal('ลบรายการสำเร็จ');
}

// ลากวางระหว่างโหมดจัดเรียง: ย้ายใน draft เท่านั้น ยังไม่บันทึกจนกว่าจะกด "ยืนยัน" (และไม่ออกจากโหมดหลังลากครั้งเดียวอีกแล้ว)
function reorderCategories(draggedId, targetId) {
  const order = categoryState.draftOrder;
  const draggedIndex = order.indexOf(draggedId);
  const targetIndex = order.indexOf(targetId);
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return;
  const [moved] = order.splice(draggedIndex, 1);
  order.splice(targetIndex, 0, moved);
  renderCategoriesPage();
}

function setCategoryLimit(categoryId) {
  const category = mock.categories.find((item) => sameId(item.id, categoryId));
  if (!category) return;
  openAmountInputModal(category.limit || 30000, (amount) => {
    if (window.jodtangPersist) {
      window.jodtangPersist.setBudget(category.id, amount);
      return;
    }
    category.limit = amount;
    category.percentage = Math.round(((category.used || 0) / amount) * 100 || 0);
    renderCategoriesPage();
    showSuccessModal('ตั้งงบรายหมวดสำเร็จ');
  }, 'ตั้งงบรายหมวด');
}

// ยกเลิกงบของหมวด — แยกเป็นปุ่มของตัวเอง ไม่ใช้วิธี "กรอก 0 แล้วถือว่ายกเลิก"
// เพราะช่องกรอกจำนวนเงินไม่รับค่า 0 อยู่แล้ว ผู้ใช้จึงไม่มีทางกดไปถึง
function clearCategoryLimit(categoryId) {
  const category = mock.categories.find((item) => sameId(item.id, categoryId));
  if (!category) return;
  if (window.jodtangPersist && window.jodtangPersist.clearBudget) {
    window.jodtangPersist.clearBudget(category.id);
    return;
  }
  category.limit = null;
  category.percentage = null;
  closeModal();
  renderCategoriesPage();
  showSuccessModal('ยกเลิกงบหมวดนี้แล้ว');
}

function openCategoryMenu(categoryId) {
  const category = mock.categories.find((item) => sameId(item.id, categoryId));
  if (!category) return;

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>${escapeHtml(category.name)}</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="settings-list">
        <div class="setting-item">
          <div>
            <strong>หมวดจำเป็น</strong>
            <span>นับเป็นค่าใช้จ่ายที่จำเป็นต้องมี</span>
          </div>
          <button type="button" class="switch ${category.isEssential ? 'on' : ''}" data-toggle-essential="${category.id}" role="switch" aria-checked="${!!category.isEssential}"></button>
        </div>
        <button class="settings-row" type="button" data-category-set-limit="${category.id}"><span>${category.limit ? 'แก้งบ' : 'ตั้งงบ'}</span><strong>›</strong></button>
        ${category.limit ? `<button class="settings-row" type="button" data-category-clear-limit="${category.id}"><span>ยกเลิกงบ</span><strong>›</strong></button>` : ''}
        <button class="settings-row" type="button" data-category-view-detail="${category.id}"><span>ดูรายละเอียด</span><strong>›</strong></button>
        <button class="settings-row danger" type="button" data-category-delete="${category.id}"><span>ลบหมวดหมู่</span><strong>›</strong></button>
      </div>
    </div>
  `;
  openModal(html);

  const switchBtn = document.querySelector('[data-toggle-essential]');
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      if (window.jodtangPersist) {
        window.jodtangPersist.updateCategory(category.id, { isEssential: !category.isEssential });
        return;
      }

      category.isEssential = !category.isEssential;
      switchBtn.classList.toggle('on', category.isEssential);
      switchBtn.setAttribute('aria-checked', String(category.isEssential));
      renderCategoriesPage();
    });
  }

  // ปุ่ม "ตั้งงบ" ใช้ data-category-set-limit ตัวเดียวกับที่ global click handler จับอยู่แล้ว
  // (ดู bindTransactionControls) ไม่ต้องผูก listener ซ้ำที่นี่ ไม่งั้น setCategoryLimit จะถูกเรียก 2 ครั้ง

  const viewDetailBtn = document.querySelector('[data-category-view-detail]');
  if (viewDetailBtn) {
    viewDetailBtn.addEventListener('click', () => {
      closeModal();
      openCategoryDetail(category.id);
    });
  }

  const deleteBtn = document.querySelector('[data-category-delete]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      deleteCategory(category.id);
    });
  }
}

function deleteCategory(categoryId) {
  if (window.jodtangPersist) {
    // backend ปฏิเสธพร้อมบอกจำนวนรายการที่ยังผูกอยู่ ถ้าหมวดนี้ถูกใช้งานอยู่
    window.jodtangPersist.deleteCategory(categoryId);
    return;
  }

  mock.categories = mock.categories.filter((item) => !sameId(item.id, categoryId));
  closeModal();
  renderCategoriesPage();
  showSuccessModal('ลบหมวดหมู่สำเร็จ');
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

// รวมเปลี่ยนหมวดหมู่ + ประเภท ไว้ใน modal เดียว กด "บันทึก" ครั้งเดียวปรับทั้งคู่พร้อมกันได้เลย
function openBatchEditModal() {
  const categoryNames = [...new Set(mock.categories.map((item) => item.name))];
  const firstSelected = mock.transactions.find((item) => transactionState.selectedIds.some((selected) => sameId(selected, item.id)));
  let selectedType = firstSelected?.type || 'expense';

  const html = `
    <div class="modal-card small">
      <div class="modal-head">
        <h3>แก้ไข ${transactionState.selectedIds.length} รายการ</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <label class="form-field">
        <span>ประเภท</span>
        <div class="segmented-control">
          <button type="button" class="segmented ${selectedType === 'expense' ? 'active' : ''}" data-batch-type-option="expense">รายจ่าย</button>
          <button type="button" class="segmented ${selectedType === 'income' ? 'active' : ''}" data-batch-type-option="income">รายรับ</button>
        </div>
      </label>
      <label class="form-field">
        <span>หมวดหมู่</span>
        ${renderCustomSelect('batchCategorySelect', categoryNames, firstSelected?.category || categoryNames[0])}
      </label>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" data-confirm-batch-edit="true">บันทึก</button>
      </div>
    </div>
  `;
  openModal(html);
  bindCustomSelect('batchCategorySelect');

  document.querySelectorAll('[data-batch-type-option]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedType = button.dataset.batchTypeOption;
      document.querySelectorAll('[data-batch-type-option]').forEach((btn) => btn.classList.toggle('active', btn === button));
    });
  });

  document.querySelector('[data-confirm-batch-edit]').addEventListener('click', () => {
    const categoryName = document.getElementById('batchCategorySelect')?.value;
    mock.transactions.forEach((item) => {
      if (!transactionState.selectedIds.some((selected) => sameId(selected, item.id))) return;
      if (categoryName) item.category = categoryName;
      item.type = selectedType;
      item.amount = Math.abs(item.amount) * (selectedType === 'income' ? 1 : -1);
    });
    transactionState.selectedIds = [];
    closeModal();
    renderTransactionsPage();
    renderDashboard();
    showSuccessModal('แก้ไขรายการสำเร็จ');
  });
}

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
      // ⚖️ G3 ปัดเป็นจำนวนเต็มสตางค์ เพราะ 80.05 * 100 ใน JS ได้ 8004.999999999999
      const limit = Math.round(safeNumber(document.getElementById('newCategoryLimit')?.value) * 100);

      if (window.jodtangPersist) {
        // DB เก็บไอคอนเป็นอีโมจิ ไม่ใช่ชื่อไอคอน — ส่งอีโมจิไปถ้าแปลงได้
        window.jodtangPersist.createCategory({
          name,
          type,
          emoji: ICON_TO_EMOJI[selectedIcon] || null,
        });
        return;
      }

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

function formatMoneyShort(value) {
  return `฿${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(Number(value || 0) / 100)}`;
}

// รายละเอียดหมวดหมู่: แท็บ "ภาพรวม" (โดนัท) + แท็บ "ประวัติ" (กราฟแท่งรายเดือน เลือกเดือนได้ พร้อมการ์ดสถิติ)
function openCategoryDetail(categoryId) {
  const category = mock.categories.find((item) => sameId(item.id, categoryId));
  if (!category) return;

  const history = mock.monthlyHistory || [];
  const usedAmount = safeNumber(category.used);
  const limitAmount = safeNumber(category.limit);
  const verb = category.type === 'income' ? 'ได้รับ' : 'ใช้ไป';
  let selectedKey = history.length ? history[history.length - 1].key : null;

  const html = `
    <div class="modal-card wide">
      <div class="modal-head">
        <h3>${escapeHtml(category.name)}</h3>
        <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
      </div>
      <div class="segmented-control lime">
        <button type="button" class="segmented active" data-category-tab="overview">ภาพรวม</button>
        <button type="button" class="segmented" data-category-tab="history">ประวัติ</button>
      </div>
      <div id="categoryTabOverview">
        <div class="category-detail-card">
          <div class="summary-row"><span>งบที่ตั้ง</span><strong>${formatMoney(limitAmount)}</strong></div>
          <div class="summary-row"><span>${verb}แล้ว</span><strong>${formatMoney(usedAmount)}</strong></div>
          <div class="summary-row"><span>สัดส่วน</span><strong>${Math.round((usedAmount / (limitAmount || 1)) * 100 || 0)}%</strong></div>
        </div>
        <div class="chart-wrap small-donut">
          <canvas id="categoryDetailChart"></canvas>
        </div>
      </div>
      <div id="categoryTabHistory" hidden></div>
    </div>
  `;
  openModal(html);

  function renderHistory() {
    const panel = document.getElementById('categoryTabHistory');
    if (!panel || !history.length) return;

    const values = history.map((month) => safeNumber(month.usage[category.id]));
    const selectedIndex = Math.max(0, history.findIndex((month) => month.key === selectedKey));
    const selectedMonth = history[selectedIndex];
    const selectedValue = values[selectedIndex];
    // เผื่อที่ว่างด้านบนไว้ให้ป้ายตัวเลข (แท่งสูงสุดสูงราว 76% ของพื้นที่กราฟ)
    const scaleMax = Math.max(...values, limitAmount, 1) / 0.76;
    const limitPercent = (limitAmount / scaleMax) * 100;

    const previousValue = selectedIndex > 0 ? values[selectedIndex - 1] : null;
    const change = previousValue && previousValue > 0 ? Math.round(((selectedValue - previousValue) / previousValue) * 100) : null;
    const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const remaining = limitAmount - selectedValue;
    const isIncome = category.type === 'income';
    const [yearText, monthText] = selectedMonth.key.split('-').map(Number);
    const monthName = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', calendar: 'gregory' }).format(new Date(yearText, monthText - 1, 1));

    const bars = history.map((month, index) => {
      const value = values[index];
      const heightPercent = (value / scaleMax) * 100;
      return `
        <button type="button" class="history-col ${index === selectedIndex ? 'selected' : ''}" data-history-month="${month.key}" aria-label="${month.label}">
          <span class="history-plot">
            <span class="history-limit" style="bottom: ${limitPercent}%"></span>
            <span class="history-value" style="bottom: calc(${heightPercent}% + 26px)">${formatMoneyShort(value)}</span>
            <span class="history-dash" style="bottom: calc(${heightPercent}% + 4px)"></span>
            <span class="history-bar" style="height: ${heightPercent}%"></span>
          </span>
          <span class="history-label">${month.label.split(' ')[0]}</span>
        </button>
      `;
    }).join('');

    const changeText = change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`;
    const changeClass = change === null || change === 0 ? '' : (change > 0 === !isIncome ? 'up' : 'down');

    panel.innerHTML = `
      <div class="history-month-nav">
        <button type="button" class="icon-btn small" data-history-step="-1" aria-label="เดือนก่อนหน้า" ${selectedIndex === 0 ? 'disabled' : ''}>${renderIcon('chevron-left')}</button>
        <strong>${monthName}</strong>
        <button type="button" class="icon-btn small" data-history-step="1" aria-label="เดือนถัดไป" ${selectedIndex === history.length - 1 ? 'disabled' : ''}>${renderIcon('chevron-right')}</button>
      </div>
      <div class="history-chart" style="grid-template-columns: repeat(${history.length}, minmax(0, 1fr))">${bars}</div>
      <p class="history-legend"><span class="history-legend-dash"></span> ${isIncome ? 'เป้ารายรับ' : 'งบประมาณ'} ${formatMoneyShort(limitAmount)}</p>
      <div class="history-stats">
        <div class="history-stat">${renderIcon('wallet')}<strong>${formatMoneyShort(selectedValue)}</strong><span>ยอดที่${verb}</span></div>
        <div class="history-stat">${renderIcon(change !== null && change < 0 ? 'trending-down' : 'trending-up')}<strong class="${changeClass}">${changeText}</strong><span>เทียบเดือนก่อน</span></div>
        <div class="history-stat">${renderIcon(!isIncome && remaining < 0 ? 'triangle-alert' : 'check')}<strong>${formatMoneyShort(Math.abs(remaining))}</strong><span>${isIncome ? (remaining > 0 ? 'ยังไม่ถึงเป้า' : 'เกินเป้า') : (remaining >= 0 ? 'เหลือจากงบ' : 'เกินงบ')}</span></div>
        <div class="history-stat">${renderIcon('bar-chart-3')}<strong>${formatMoneyShort(average)}</strong><span>เฉลี่ยต่อเดือน</span></div>
      </div>
      <div class="settings-list">
        <button class="settings-row" type="button" data-history-goto="${selectedMonth.key}"><span>ดูรายการเดือนนี้ในหน้าประวัติ</span><strong>›</strong></button>
      </div>
    `;

    panel.querySelectorAll('[data-history-month]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedKey = button.dataset.historyMonth;
        renderHistory();
      });
    });
    panel.querySelectorAll('[data-history-step]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = history[selectedIndex + Number(button.dataset.historyStep)];
        if (next) {
          selectedKey = next.key;
          renderHistory();
        }
      });
    });
    panel.querySelector('[data-history-goto]').addEventListener('click', () => {
      window.location.href = `transactions.html?category=${category.id}&month=${selectedMonth.key}`;
    });
  }

  renderHistory();

  document.querySelectorAll('[data-category-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-category-tab]').forEach((btn) => btn.classList.toggle('active', btn === button));
      document.getElementById('categoryTabOverview').hidden = button.dataset.categoryTab !== 'overview';
      document.getElementById('categoryTabHistory').hidden = button.dataset.categoryTab !== 'history';
    });
  });

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

  const summaryPeriodBtn = document.getElementById('summaryPeriodBtn');
  if (summaryPeriodBtn) {
    summaryPeriodBtn.addEventListener('click', buildDatePickerModal);
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
      const id = rowCheck.dataset.rowCheck;
      const has = transactionState.selectedIds.some((selected) => sameId(selected, id));
      transactionState.selectedIds = has
        ? transactionState.selectedIds.filter((itemId) => !sameId(itemId, id))
        : [...transactionState.selectedIds, id];
      renderTransactionsPage();
      return;
    }

    const resetRangeBtn = event.target.closest('[data-reset-range]');
    if (resetRangeBtn) {
      const bounds = getMonthBounds(new Date());
      transactionState.rangeStart = bounds.start;
      transactionState.rangeEnd = bounds.end;
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
      if (action === 'select-all') {
        const allSelected = transactionState.visibleIds.length > 0
          && transactionState.visibleIds.every((id) => transactionState.selectedIds.some((selected) => sameId(selected, id)));
        transactionState.selectedIds = allSelected ? [] : [...transactionState.visibleIds];
        renderTransactionsPage();
      }
      if (action === 'delete') {
        mock.transactions = mock.transactions.filter((item) => !transactionState.selectedIds.some((selected) => sameId(selected, item.id)));
        transactionState.selectedIds = [];
        renderTransactionsPage();
        renderDashboard();
        showSuccessModal('ลบรายการที่เลือกสำเร็จ');
      }
      if (action === 'edit') {
        openBatchEditModal();
      }
      return;
    }

    const transferBtn = event.target.closest('[data-plan-transfer]');
    if (transferBtn) {
      const planId = transferBtn.dataset.planTransfer;
      const plan = mock.plans.find((item) => sameId(item.id, planId));
      if (!plan) return;
      openPlanTransfer(plan);
      return;
    }

    const planMenu = event.target.closest('[data-plan-menu]');
    if (planMenu) {
      const plan = mock.plans.find((item) => sameId(item.id, planMenu.dataset.planMenu));
      if (plan) openPlanMenu(plan);
      return;
    }

    const planEdit = event.target.closest('[data-plan-edit]');
    if (planEdit) {
      const plan = mock.plans.find((item) => sameId(item.id, planEdit.dataset.planEdit));
      if (!plan) return;
      const html = `
        <div class="modal-card small">
          <div class="modal-head"><h3>แก้ไขแผน</h3><button class="close-btn" data-close-modal="true" type="button">${renderIcon('x')}</button></div>
          <div class="form-grid">
            <label class="form-field floating"><span>ชื่อแผน</span><input id="editPlanName" value="${escapeHtml(plan.name)}" /></label>
            <label class="form-field floating"><span>เป้าหมาย (บาท)</span><input id="editPlanTarget" type="number" min="1" value="${plan.target / 100}" /></label>
            <label class="form-field floating"><span>ออมต่อเดือน (บาท)</span><input id="editPlanSave" type="number" min="0" value="${(plan.monthly_save || 0) / 100}" /></label>
            <label class="form-field floating"><span>วันครบกำหนด</span><input id="editPlanDue" value="${plan.dueMonth || 'มี.ค. 2026'}" /></label>
          </div>
          ${renderEmergencyToggleRow(plan.type === 'emergency', plan.id)}
          <div class="modal-actions"><button class="primary-btn full" type="button" data-plan-save-edits="${plan.id}">บันทึก</button></div>
        </div>
      `;
      openModal(html);
      return;
    }

    const planSaveEdits = event.target.closest('[data-plan-save-edits]');
    if (planSaveEdits) {
      const plan = mock.plans.find((item) => sameId(item.id, planSaveEdits.dataset.planSaveEdits));
      if (!plan) return;
      plan.name = document.getElementById('editPlanName')?.value || plan.name;
      const editedTarget = Math.round(Number(document.getElementById('editPlanTarget')?.value) * 100);
      const editedSave = Math.round(Number(document.getElementById('editPlanSave')?.value) * 100);
      if (editedTarget > 0) plan.target = editedTarget;
      if (Number.isFinite(editedSave) && editedSave >= 0) plan.monthly_save = editedSave;
      plan.dueMonth = document.getElementById('editPlanDue')?.value || plan.dueMonth;
      plan.progress = ((plan.saved / plan.target) * 100) || 0;
      const emergencyToggle = document.getElementById('emergencyToggle');
      if (emergencyToggle) applyEmergencyType(plan, emergencyToggle.classList.contains('on'));
      closeModal();
      renderAnalyzePage();
      renderDashboard();
      showSuccessModal('แก้ไขแผนสำเร็จ');
      return;
    }

    const planDelete = event.target.closest('[data-plan-delete]');
    if (planDelete) {
      const plan = mock.plans.find((item) => sameId(item.id, planDelete.dataset.planDelete));
      if (plan) openPlanDeleteConfirm(plan);
      return;
    }

    const planDeleteConfirm = event.target.closest('[data-plan-delete-confirm]');
    if (planDeleteConfirm) {
      const plan = mock.plans.find((item) => sameId(item.id, planDeleteConfirm.dataset.planDeleteConfirm));
      if (window.jodtangPersist) {
        window.jodtangPersist.cancelPlan(planDeleteConfirm.dataset.planDeleteConfirm);
        return;
      }
      if (plan) plan.active = false;
      closeModal();
      renderAnalyzePage();
      renderDashboard();
      showSuccessModal('ยกเลิกแผนสำเร็จ');
      return;
    }

    const emergencyToggle = event.target.closest('#emergencyToggle');
    if (emergencyToggle) {
      const isOn = !emergencyToggle.classList.contains('on');
      emergencyToggle.classList.toggle('on', isOn);
      emergencyToggle.setAttribute('aria-checked', String(isOn));
      const hint = document.getElementById('emergencyHint');
      if (hint) hint.textContent = getEmergencyHint(isOn, emergencyToggle.dataset.emergencyPlan || null);
      return;
    }

    const historyEdit = event.target.closest('[data-history-edit]');
    if (historyEdit) {
      const found = findHistoryEntry(historyEdit.dataset.historyEdit);
      if (found) openHistoryEntryEdit(found.plan, found.entry);
      return;
    }

    const historySave = event.target.closest('[data-history-save]');
    if (historySave) {
      const found = findHistoryEntry(historySave.dataset.historySave);
      if (!found) return;
      const amountInput = document.getElementById('historyAmount');
      const amount = Math.round(Number(amountInput.value) * 100);
      const date = document.getElementById('historyDate').value;
      if (!(amount > 0) || !date) {
        if (!(amount > 0)) {
          amountInput.classList.add('invalid');
          amountInput.focus();
        }
        return;
      }
      found.plan.saved += amount - found.entry.amount;
      found.entry.amount = amount;
      found.entry.date = date;
      found.entry.time = getCustomTimeValue('historyTime');
      recalcPlanProgress(found.plan);
      renderAnalyzePage();
      renderDashboard();
      openPlanHistory(found.plan);
      return;
    }

    const historyDelete = event.target.closest('[data-history-delete]');
    if (historyDelete) {
      const found = findHistoryEntry(historyDelete.dataset.historyDelete);
      if (found) openHistoryDeleteConfirm(found.plan, found.entry);
      return;
    }

    const historyDeleteConfirm = event.target.closest('[data-history-delete-confirm]');
    if (historyDeleteConfirm) {
      const found = findHistoryEntry(historyDeleteConfirm.dataset.historyDeleteConfirm);
      if (!found) return;
      found.plan.history = found.plan.history.filter((item) => item.id !== found.entry.id);
      found.plan.saved -= found.entry.amount;
      recalcPlanProgress(found.plan);
      renderAnalyzePage();
      renderDashboard();
      openPlanHistory(found.plan);
      return;
    }

    const planHistory = event.target.closest('[data-plan-history]');
    if (planHistory) {
      const plan = mock.plans.find((item) => sameId(item.id, planHistory.dataset.planHistory));
      if (plan) openPlanHistory(plan);
      return;
    }

    const planDetail = event.target.closest('[data-plan-detail]');
    if (planDetail) {
      const plan = mock.plans.find((item) => sameId(item.id, planDetail.dataset.planDetail));
      if (plan) openPlanDetail(plan);
      return;
    }

    const categorySetLimit = event.target.closest('[data-category-set-limit]');
    if (categorySetLimit) {
      setCategoryLimit(categorySetLimit.dataset.categorySetLimit);
      return;
    }

    const categoryClearLimit = event.target.closest('[data-category-clear-limit]');
    if (categoryClearLimit) {
      clearCategoryLimit(categoryClearLimit.dataset.categoryClearLimit);
      return;
    }

    const categoryMenuBtn = event.target.closest('[data-category-menu]');
    if (categoryMenuBtn) {
      openCategoryMenu(categoryMenuBtn.dataset.categoryMenu);
      return;
    }

    const sortMoveBtn = event.target.closest('[data-sort-move]');
    if (sortMoveBtn) {
      moveCategoryInDraft(sortMoveBtn.dataset.sortId, sortMoveBtn.dataset.sortMove);
      return;
    }

    if (event.target.closest('[data-sort-cancel]')) {
      cancelCategorySort();
      return;
    }

    if (event.target.closest('[data-sort-confirm]')) {
      confirmCategorySort();
      return;
    }

    const categoryRow = event.target.closest('[data-category-row]');
    if (categoryRow && !categoryState.sortMode && !event.target.closest('button') && !event.target.closest('input')) {
      openCategoryDetail(categoryRow.dataset.categoryRow);
      return;
    }

    if (event.target.closest('[data-plan-next]')) {
      const nextStep = Number(event.target.closest('[data-plan-next]').dataset.planNext);
      pageState.planWizard.step = nextStep;
      const inputName = document.getElementById('planNameInput');
      const inputAmount = document.getElementById('planAmountInput');
      const inputMonths = document.getElementById('planMonthsInput');
      const invalidInputs = [inputAmount, inputMonths].filter((input) => input && !(Number(input.value) > 0));
      if (invalidInputs.length) {
        invalidInputs.forEach((input) => input.classList.add('invalid'));
        invalidInputs[0].focus();
        return;
      }
      const emergencyToggle = document.getElementById('emergencyToggle');
      if (emergencyToggle) pageState.planWizard.emergency = emergencyToggle.classList.contains('on');
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
      if (categoryState.sortMode) cancelCategorySort();
      else enterCategorySortMode();
    });
  }

  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', openAddCategoryModal);
  }

  const categorySearch = document.getElementById('categorySearch');
  if (categorySearch) {
    categorySearch.addEventListener('input', (event) => {
      categoryState.searchValue = event.target.value;
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

  const heroPeriodBtn = document.getElementById('heroPeriodBtn');
  if (heroPeriodBtn) {
    heroPeriodBtn.addEventListener('click', openHeroPeriodModal);
  }
}

function getRemainingThisMonth() {
  // ⚖️ G1: ยอดคงเหลือของเดือนต้องมาจาก API (§S5.2 monthRemainingSatang) ห้ามหน้าเว็บคำนวณเอง
  // ส่วนด้านล่างเป็นทางสำรองสำหรับตอนรันด้วย mock data ที่ยังไม่มีค่านี้
  if (typeof mock.summary.monthRemaining === 'number') return mock.summary.monthRemaining;

  const history = mock.monthlyHistory || [];
  const currentMonth = history[history.length - 1];
  if (!currentMonth) return 0;
  const expenseCategories = mock.categories.filter((item) => item.type === 'expense');
  const totalLimit = expenseCategories.reduce((sum, item) => sum + safeNumber(item.limit), 0);
  const totalUsed = expenseCategories.reduce((sum, item) => sum + safeNumber(currentMonth.usage[item.id]), 0);
  return totalLimit - totalUsed;
}

const SETTINGS_STORAGE_KEY = 'jodtang.settings';

function readSavedSettings() {
  try {
    return JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}') || {};
  } catch (error) {
    return {};
  }
}

function saveSetting(key, value) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...readSavedSettings(), [key]: value }));
  } catch (error) {
    // เก็บค่าไม่ได้ (เช่น โหมดส่วนตัว) สวิตช์ก็ยังสลับได้ตามปกติ แค่ไม่จำค่า
  }
}

function bindSettingsActions() {
  // ถ้าต่อ API แล้ว boot.js เป็นคนจัดการหน้าตั้งค่าเอง (ค่าจริงจาก /api/settings)
  // ไม่งั้นจะผูก listener ซ้อนกันสองชั้นแล้วกดปุ่มทีเดียวทำงานสองรอบ
  if (window.__jodtangApiWired) return;

  // สวิตช์เปิด/ปิด (ผู้ช่วย AI, สรุปรายวัน) จำค่าไว้ในเบราว์เซอร์
  const saved = readSavedSettings();
  document.querySelectorAll('[data-setting]').forEach((toggle) => {
    const key = toggle.dataset.setting;
    const setState = (isOn) => {
      toggle.classList.toggle('on', isOn);
      toggle.setAttribute('aria-checked', String(isOn));
    };
    if (typeof saved[key] === 'boolean') setState(saved[key]);
    toggle.addEventListener('click', () => {
      const next = !toggle.classList.contains('on');
      setState(next);
      saveSetting(key, next);
    });
  });

  const rotateButton = document.getElementById('rotateTokenBtn');
  if (rotateButton) {
    rotateButton.addEventListener('click', () => {
      const token = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      const emailEl = document.getElementById('ingestEmail');
      if (emailEl) emailEl.textContent = `user+${token}@gmail.com`;
      showSuccessModal('token ใหม่ถูกสร้างเรียบร้อยแล้ว');
    });
  }
}

/** โอนเข้าแผนออมเป็น type='transfer' ไม่ใช่รายรับหรือรายจ่าย (G7) ใช้แยกตอนกรองและแสดงผล */
function isTransfer(item) {
  return item.type === 'transfer';
}

function applyTransactionDeepLinkFilter() {
  const params = new URLSearchParams(window.location.search);
  // 🔴 แก้บั๊ก: id ของหมวดเป็น uuid ไม่ใช่ตัวเลข Number() จึงคืน NaN แล้วหลุด return ทุกครั้ง
  // ผลคือปุ่ม "ดูรายการในหน้าประวัติ" พามาถึงหน้านี้จริง แต่ตัวกรองไม่เคยถูกใช้ — เงียบ ไม่มี error
  const categoryId = params.get('category');
  if (!categoryId) return;

  const category = mock.categories.find((item) => sameId(item.id, categoryId));
  if (!category) return;

  transactionState.categoryFilter = category.name;
  transactionState.monthFilter = params.get('month') || null;

  if (transactionState.monthFilter) {
    const [year, month] = transactionState.monthFilter.split('-').map(Number);
    const bounds = getMonthBounds(new Date(year, month - 1, 1));
    transactionState.rangeStart = bounds.start;
    transactionState.rangeEnd = bounds.end;
  }

  transactionState.activeTab = category.type;
  document.querySelectorAll('.tab[data-filter]').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.filter === category.type);
  });
}

function initializePage() {
  bindTransactionControls();
  bindSettingsActions();
  bindHeroActions();
  renderSpendingLimitSettings();

  const pageName = document.body.dataset.page;
  if (pageName === 'dashboard') renderDashboard();
  if (pageName === 'transactions') {
    applyTransactionDeepLinkFilter();
    renderTransactionsPage();
  }
  if (pageName === 'categories') {
    bindBarTip(categoryOverviewTip);
    renderCategoriesPage();
  }
  if (pageName === 'analyze') {
    bindAnalyzePage();
    renderAnalyzePage();
    // ลิงก์มาจากหน้าสรุป (analyze.html#plans): เนื้อหาถูกวาดด้วย JS หลังโหลด เลื่อนไปที่แผนหลังวาดเสร็จ
    if (window.location.hash === '#plans') {
      const plansSection = document.getElementById('plans');
      if (plansSection) plansSection.scrollIntoView();
    }
  }
}

document.addEventListener('DOMContentLoaded', initializePage);