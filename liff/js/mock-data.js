// ไฟล์นี้ทำหน้าที่อะไร: mock data สำหรับหน้า LIFF เพื่อให้ UI ดูสมจริงก่อนต่อ backend จริง
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// TODO: เปลี่ยนไปใช้ API จริงจาก backend และแยก data ตาม user_id
// ⚖️ กฎเหล็ก G6

window.mockData = {
  user: {
    name: 'อเล็กซานเดอร์ ซิมส์',
    avatar: 'AS',
  },
  summary: {
    balance: 25089032,
    income: 4200000,
    expense: 2755000,
    safeToSpend: 1835000,
    confidence: 'high',
    safeToSpendConfidence: 'high',
    progress: 72,
    daysOfData: 14,
    monthlyBudgetLimit: 300000,
    monthlyBudgetUsed: 185000,
  },
  transactions: [
    { id: 1, title: 'เงินเดือน', amount: 420000, type: 'income', category: 'เงินเดือน', time: '09:00', date: 'วันนี้', dateKey: '2026-09-13', parsedBy: 'manual' },
    { id: 2, title: 'กาแฟสตาร์บัคส์', amount: -6450, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '10:30', date: 'วันนี้', dateKey: '2026-09-13', parsedBy: 'ai' },
    { id: 3, title: 'ค่า Uber', amount: -3580, type: 'expense', category: 'การเดินทาง', time: '12:15', date: 'วันนี้', dateKey: '2026-09-13', parsedBy: 'regex' },
    { id: 4, title: 'ค่าจ้างฟรีแลนซ์', amount: 250000, type: 'income', category: 'รายได้เสริม', time: '15:45', date: 'เมื่อวาน', dateKey: '2026-09-12', parsedBy: 'manual' },
    { id: 5, title: 'ซื้อของชำ', amount: -15350, type: 'expense', category: 'ของใช้ประจำวัน', time: '18:20', date: 'เมื่อวาน', dateKey: '2026-09-12', parsedBy: 'manual' },
    { id: 6, title: 'ค่าเช่า', amount: -18500, type: 'expense', category: 'ค่าอยู่อาศัย', time: '08:00', date: 'เมื่อวาน', dateKey: '2026-09-12', parsedBy: 'regex' },
    { id: 7, title: 'โบนัสประจำปี', amount: 150000, type: 'income', category: 'โบนัส', time: '09:10', date: '3 วันก่อน', dateKey: '2026-09-10', parsedBy: 'ai' },
    { id: 8, title: 'ซื้อหนังสือ', amount: -890, type: 'expense', category: 'การศึกษา', time: '12:40', date: '3 วันก่อน', dateKey: '2026-09-10', parsedBy: 'ai' },
    { id: 9, title: 'บัตรกำนัล', amount: -1200, type: 'expense', category: 'ของขวัญ', time: '21:15', date: '1 สัปดาห์ก่อน', dateKey: '2026-09-06', parsedBy: 'regex' },
    { id: 10, title: 'โอนเงินจากแม่', amount: 5000, type: 'income', category: 'เงินช่วยเหลือ', time: '07:30', date: '1 สัปดาห์ก่อน', dateKey: '2026-09-06', parsedBy: 'manual' },
  ],
  categories: [
    { id: 1, name: 'อาหารและเครื่องดื่ม', icon: '🍽️', used: 68000, limit: 90000, percentage: 76, type: 'expense', isEssential: true, sortOrder: 1 },
    { id: 2, name: 'การเดินทาง', icon: '🚕', used: 42000, limit: 60000, percentage: 70, type: 'expense', isEssential: true, sortOrder: 2 },
    { id: 3, name: 'ของใช้ประจำวัน', icon: '🛍️', used: 89000, limit: 120000, percentage: 74, type: 'expense', isEssential: false, sortOrder: 3 },
    { id: 4, name: 'ค่าอยู่อาศัย', icon: '🏠', used: 185000, limit: 220000, percentage: 84, type: 'expense', isEssential: true, sortOrder: 4 },
    { id: 5, name: 'เงินเดือน', icon: '💰', used: 420000, limit: 420000, percentage: 100, type: 'income', isEssential: true, sortOrder: 5 },
    { id: 6, name: 'รายได้เสริม', icon: '💼', used: 250000, limit: 320000, percentage: 78, type: 'income', isEssential: false, sortOrder: 6 },
  ],
  plans: [
    { id: 1, name: 'แผนท่องเที่ยว', target: 250000, saved: 170000, progress: 68, confidence: 'high', status: 'normal', dueMonth: 'มี.ค. 2026', monthly_save: 15000, active: true },
    { id: 2, name: 'กองทุนฉุกเฉิน', target: 600000, saved: 312000, progress: 52, confidence: 'medium', status: 'off_track', dueMonth: 'เม.ย. 2026', monthly_save: 18000, active: true },
    { id: 3, name: 'ซื้อคอมพิวเตอร์', target: 450000, saved: 365000, progress: 81, confidence: 'high', status: 'completed', dueMonth: 'ก.พ. 2026', monthly_save: 12000, active: true },
  ],
  donutData: {
    labels: ['อาหาร', 'ที่พัก', 'เดินทาง', 'ช้อปปิ้ง', 'อื่น ๆ'],
    values: [32, 28, 18, 15, 7],
    colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#f3e8ff'],
  },
  lineData: {
    labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'],
    income: [32000, 35000, 31000, 39000, 41000, 43000],
    expense: [22000, 24000, 26000, 25000, 29000, 28000],
  },
};
