// ไฟล์นี้ทำหน้าที่อะไร: mock data สำหรับหน้า LIFF เพื่อให้ UI ดูสมจริงก่อนต่อ backend จริง
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// TODO: เปลี่ยนไปใช้ API จริงจาก backend และแยก data ตาม user_id
// ⚖️ กฎเหล็ก G6

window.mockData = {
  user: {
    name: 'มหาเทพ ฐปนพัชร',
    avatar: 'มห',
    subtitle: 'นักศึกษาชั้นปีที่ 1 · ม.แม่ฟ้าหลวง',
  },
  // รายได้ทั้งหมด ฿5,000/เดือน = เงินจากที่บ้าน ฿4,000 + ค่าติวน้อง ฿1,000 (หน่วยเป็นสตางค์ทั้งไฟล์)
  // งบรายจ่ายรวม ฿4,300/เดือน ที่เหลือราว ฿700 กันไว้ออมตามแผน
  summary: {
    balance: 230000,
    income: 500000,
    expense: 320000,
    safeToSpend: 8500,
    confidence: 'high',
    safeToSpendConfidence: 'medium',
    progress: 62,
    daysOfData: 18,
    monthlyBudgetLimit: 430000,
    monthlyBudgetUsed: 320000,
    forecastBalance: 15000, // ประมาณการเงินที่คาดว่าจะเหลือจากงบเมื่อสิ้นเดือน (+ เหลือ / - เกินงบ) ต้องไม่เกินงบที่เหลือตอนนี้ (฿1,100) — backend จะเป็นคนคำนวณ
  },
  transactions: [
    { id: 1, title: 'เงินโอนจากที่บ้าน', amount: 400000, type: 'income', category: 'เงินจากที่บ้าน', time: '08:15', date: 'วันนี้', dateKey: '2026-09-17', parsedBy: 'manual' },
    { id: 2, title: 'ชานมไข่มุก', amount: -4500, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '10:40', date: 'วันนี้', dateKey: '2026-09-17', parsedBy: 'ai' },
    { id: 3, title: 'ค่ารถสองแถวไปมหาลัย', amount: -2000, type: 'expense', category: 'ค่าเดินทาง', time: '07:30', date: 'วันนี้', dateKey: '2026-09-17', parsedBy: 'regex' },
    { id: 4, title: 'ค่าจ้างติวน้อง', amount: 100000, type: 'income', category: 'รายได้พิเศษ', time: '16:00', date: 'เมื่อวาน', dateKey: '2026-09-16', parsedBy: 'manual' },
    { id: 5, title: 'ข้าวราดแกงโรงอาหาร', amount: -4000, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '12:10', date: 'เมื่อวาน', dateKey: '2026-09-16', parsedBy: 'ai' },
    { id: 6, title: 'ค่าหอพักประจำเดือน', amount: -120000, type: 'expense', category: 'ค่าหอพัก', time: '09:00', date: 'เมื่อวาน', dateKey: '2026-09-16', parsedBy: 'regex' },
    { id: 7, title: 'ค่าปริ้นรายงาน', amount: -3000, type: 'expense', category: 'การศึกษา', time: '14:20', date: '3 วันก่อน', dateKey: '2026-09-14', parsedBy: 'ai' },
    { id: 8, title: 'กาแฟกับเพื่อนหลังเลิกเรียน', amount: -6000, type: 'expense', category: 'บันเทิง/สังสรรค์', time: '18:30', date: '3 วันก่อน', dateKey: '2026-09-14', parsedBy: 'manual' },
    { id: 9, title: 'ข้าวกะเพราหน้ามอ', amount: -4500, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '12:15', date: '1 สัปดาห์ก่อน', dateKey: '2026-09-10', parsedBy: 'ai' },
    { id: 10, title: 'ซื้อสมุด-ปากกา', amount: -4000, type: 'expense', category: 'ของใช้ส่วนตัว', time: '15:45', date: '1 สัปดาห์ก่อน', dateKey: '2026-09-10', parsedBy: 'regex' },
    // รายการเดือนก่อนๆ — ให้ตัวกรอง "หมวดหมู่ + เดือน" ที่ลิงก์มาจาก widget งบประมาณรายเดือนในหน้าสรุปมีข้อมูลให้เห็นจริง
    { id: 11, title: 'ข้าวมันไก่ร้านประจำ', amount: -3500, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '12:00', date: '15 ก.ค. 2026', dateKey: '2026-07-15', parsedBy: 'ai' },
    { id: 12, title: 'ค่าหอพักประจำเดือน', amount: -120000, type: 'expense', category: 'ค่าหอพัก', time: '09:00', date: '5 ก.ค. 2026', dateKey: '2026-07-05', parsedBy: 'regex' },
    { id: 13, title: 'ค่ารถโดยสารไปมหาลัย', amount: -2000, type: 'expense', category: 'ค่าเดินทาง', time: '07:45', date: '10 ก.ค. 2026', dateKey: '2026-07-10', parsedBy: 'regex' },
    { id: 14, title: 'ซื้อของใช้เข้าหอ', amount: -6000, type: 'expense', category: 'ของใช้ส่วนตัว', time: '17:30', date: '8 ก.ค. 2026', dateKey: '2026-07-08', parsedBy: 'manual' },
    { id: 15, title: 'ซื้อชีทเรียนเปิดเทอม', amount: -15000, type: 'expense', category: 'การศึกษา', time: '13:20', date: '2 ก.ค. 2026', dateKey: '2026-07-02', parsedBy: 'ai' },
    { id: 16, title: 'ดูหนังกับเพื่อน', amount: -8000, type: 'expense', category: 'บันเทิง/สังสรรค์', time: '19:00', date: '20 ก.ค. 2026', dateKey: '2026-07-20', parsedBy: 'manual' },
    { id: 17, title: 'เงินโอนจากที่บ้าน', amount: 400000, type: 'income', category: 'เงินจากที่บ้าน', time: '08:00', date: '1 ก.ค. 2026', dateKey: '2026-07-01', parsedBy: 'manual' },
    { id: 18, title: 'ค่าจ้างติวน้อง', amount: 100000, type: 'income', category: 'รายได้พิเศษ', time: '16:00', date: '25 ก.ค. 2026', dateKey: '2026-07-25', parsedBy: 'manual' },
    { id: 19, title: 'ก๋วยเตี๋ยวหน้าหอ', amount: -4000, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '12:30', date: '14 ส.ค. 2026', dateKey: '2026-08-14', parsedBy: 'ai' },
    { id: 20, title: 'ค่าหอพักประจำเดือน', amount: -120000, type: 'expense', category: 'ค่าหอพัก', time: '09:00', date: '5 ส.ค. 2026', dateKey: '2026-08-05', parsedBy: 'regex' },
    { id: 21, title: 'ค่ารถสองแถวไปมหาลัย', amount: -2000, type: 'expense', category: 'ค่าเดินทาง', time: '07:40', date: '9 ส.ค. 2026', dateKey: '2026-08-09', parsedBy: 'regex' },
    { id: 22, title: 'ซื้อของใช้ส่วนตัว', amount: -8000, type: 'expense', category: 'ของใช้ส่วนตัว', time: '18:00', date: '11 ส.ค. 2026', dateKey: '2026-08-11', parsedBy: 'manual' },
    { id: 23, title: 'ค่าปริ้นเอกสาร', amount: -3000, type: 'expense', category: 'การศึกษา', time: '14:00', date: '19 ส.ค. 2026', dateKey: '2026-08-19', parsedBy: 'ai' },
    { id: 24, title: 'สังสรรค์วันเกิดเพื่อน', amount: -10000, type: 'expense', category: 'บันเทิง/สังสรรค์', time: '19:30', date: '22 ส.ค. 2026', dateKey: '2026-08-22', parsedBy: 'manual' },
    { id: 25, title: 'เงินโอนจากที่บ้าน', amount: 400000, type: 'income', category: 'เงินจากที่บ้าน', time: '08:00', date: '1 ส.ค. 2026', dateKey: '2026-08-01', parsedBy: 'manual' },
    { id: 26, title: 'ค่าจ้างติวน้อง', amount: 100000, type: 'income', category: 'รายได้พิเศษ', time: '16:00', date: '27 ส.ค. 2026', dateKey: '2026-08-27', parsedBy: 'manual' },
  ],
  categories: [
    { id: 1, name: 'อาหารและเครื่องดื่ม', icon: 'utensils', used: 135000, limit: 200000, percentage: 68, type: 'expense', isEssential: true, sortOrder: 1, color: '#2a78d6' },
    { id: 2, name: 'ค่าหอพัก', icon: 'home', used: 120000, limit: 120000, percentage: 100, type: 'expense', isEssential: true, sortOrder: 2, color: '#eb6834' },
    { id: 3, name: 'ค่าเดินทาง', icon: 'bus', used: 18000, limit: 30000, percentage: 60, type: 'expense', isEssential: true, sortOrder: 3, color: '#1baf7a' },
    { id: 4, name: 'ของใช้ส่วนตัว', icon: 'shopping-bag', used: 15000, limit: 30000, percentage: 50, type: 'expense', isEssential: false, sortOrder: 4, color: '#eda100' },
    { id: 5, name: 'การศึกษา', icon: 'graduation-cap', used: 12000, limit: 20000, percentage: 60, type: 'expense', isEssential: true, sortOrder: 5, color: '#e87ba4' },
    { id: 6, name: 'บันเทิง/สังสรรค์', icon: 'clapperboard', used: 20000, limit: 30000, percentage: 67, type: 'expense', isEssential: false, sortOrder: 6, color: '#008300' },
    { id: 7, name: 'เงินจากที่บ้าน', icon: 'banknote', used: 400000, limit: 400000, percentage: 100, type: 'income', isEssential: true, sortOrder: 7, color: '#2a78d6' },
    { id: 8, name: 'รายได้พิเศษ', icon: 'briefcase', used: 100000, limit: 100000, percentage: 100, type: 'income', isEssential: false, sortOrder: 8, color: '#eb6834' },
  ],
  // ประวัติยอดใช้จ่าย/รายรับรายเดือน แยกตาม categoryId — ใช้สำหรับปุ่มเปลี่ยนเดือนใน widget งบประมาณรายเดือน (index.html)
  // limit ของแต่ละหมวดอ้างอิงจาก categories ด้านบน (ไม่ผูกกับเดือน สมมติว่างบที่ตั้งไม่เปลี่ยนรายเดือน มีแค่ยอดใช้จริงที่เปลี่ยน)
  monthlyHistory: [
    {
      key: '2026-04',
      label: 'เม.ย. 2026',
      usage: { 1: 180000, 2: 120000, 3: 25000, 4: 28000, 5: 15000, 6: 35000, 7: 400000, 8: 100000 },
    },
    {
      key: '2026-05',
      label: 'พ.ค. 2026',
      usage: { 1: 175000, 2: 120000, 3: 28000, 4: 20000, 5: 10000, 6: 25000, 7: 400000, 8: 100000 },
    },
    {
      key: '2026-06',
      label: 'มิ.ย. 2026',
      usage: { 1: 190000, 2: 120000, 3: 26000, 4: 25000, 5: 12000, 6: 20000, 7: 400000, 8: 100000 },
    },
    {
      key: '2026-07',
      label: 'ก.ค. 2026',
      usage: { 1: 185000, 2: 120000, 3: 27000, 4: 22000, 5: 18000, 6: 24000, 7: 400000, 8: 100000 },
    },
    {
      key: '2026-08',
      label: 'ส.ค. 2026',
      usage: { 1: 195000, 2: 120000, 3: 28000, 4: 26000, 5: 9000, 6: 32000, 7: 400000, 8: 100000 },
    },
    {
      key: '2026-09',
      label: 'ก.ย. 2026 (เดือนนี้)',
      usage: { 1: 135000, 2: 120000, 3: 18000, 4: 15000, 5: 12000, 6: 20000, 7: 400000, 8: 100000 },
    },
  ],
  plans: [
    { id: 1, name: 'ออมซื้อหูฟังไร้สาย', target: 300000, saved: 135000, history: [{ id: 1, date: '2026-04-05', time: '09:15', amount: 20000 }, { id: 2, date: '2026-05-05', time: '12:30', amount: 20000 }, { id: 3, date: '2026-06-05', time: '18:45', amount: 20000 }, { id: 4, date: '2026-07-05', time: '20:10', amount: 20000 }, { id: 5, date: '2026-08-05', time: '08:05', amount: 20000 }, { id: 6, date: '2026-09-10', time: '14:20', amount: 35000 }], progress: 45, confidence: 'high', status: 'normal', dueMonth: 'มิ.ย. 2027', monthly_save: 20000, active: true },
    { id: 2, type: 'emergency', name: 'กองทุนฉุกเฉินนักศึกษา', target: 500000, saved: 150000, history: [{ id: 1, date: '2026-05-02', time: '09:15', amount: 30000 }, { id: 2, date: '2026-06-02', time: '12:30', amount: 30000 }, { id: 3, date: '2026-07-02', time: '18:45', amount: 20000 }, { id: 4, date: '2026-08-02', time: '20:10', amount: 30000 }, { id: 5, date: '2026-09-02', time: '08:05', amount: 30000 }, { id: 6, date: '2026-09-12', time: '14:20', amount: 10000 }], progress: 30, confidence: 'medium', status: 'off_track', dueMonth: 'ม.ค. 2027', monthly_save: 30000, active: true },
    { id: 3, name: 'ทริปทัศนศึกษากับเพื่อน', target: 200000, saved: 200000, history: [{ id: 1, date: '2026-03-08', time: '09:15', amount: 30000 }, { id: 2, date: '2026-04-08', time: '12:30', amount: 30000 }, { id: 3, date: '2026-05-08', time: '18:45', amount: 25000 }, { id: 4, date: '2026-06-08', time: '20:10', amount: 25000 }, { id: 5, date: '2026-07-08', time: '08:05', amount: 30000 }, { id: 6, date: '2026-08-08', time: '14:20', amount: 30000 }, { id: 7, date: '2026-09-08', time: '19:30', amount: 30000 }], progress: 100, confidence: 'high', status: 'completed', dueMonth: 'พ.ย. 2026', monthly_save: 30000, active: true },
  ],
  donutData: {
    labels: ['อาหาร', 'หอพัก', 'เดินทาง', 'ของใช้/ช้อปปิ้ง', 'อื่น ๆ'],
    values: [42, 37, 6, 5, 10],
    colors: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  },
  lineData: {
    labels: ['เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'],
    income: [500000, 500000, 500000, 500000, 500000, 500000],
    expense: [403000, 378000, 393000, 396000, 410000, 320000],
  },
};
