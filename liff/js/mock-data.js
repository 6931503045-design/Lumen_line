// ไฟล์นี้ทำหน้าที่อะไร: mock data สำหรับหน้า LIFF เพื่อให้ UI ดูสมจริงก่อนต่อ backend จริง
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// TODO: เปลี่ยนไปใช้ API จริงจาก backend และแยก data ตาม user_id
// ⚖️ กฎเหล็ก G6

window.mockData = {
  user: {
    name: 'แพรวา ศรีสุข',
    avatar: 'PS',
    subtitle: 'นักศึกษาชั้นปีที่ 3 · ม.แม่ฟ้าหลวง',
  },
  summary: {
    balance: 485075,
    income: 950000,
    expense: 715000,
    safeToSpend: 24500,
    confidence: 'high',
    safeToSpendConfidence: 'medium',
    progress: 62,
    daysOfData: 18,
    monthlyBudgetLimit: 800000,
    monthlyBudgetUsed: 620000,
  },
  transactions: [
    { id: 1, title: 'เงินโอนจากที่บ้าน', amount: 600000, type: 'income', category: 'เงินจากที่บ้าน', time: '08:15', date: 'วันนี้', dateKey: '2026-09-17', parsedBy: 'manual' },
    { id: 2, title: 'ชานมไข่มุก', amount: -6500, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '10:40', date: 'วันนี้', dateKey: '2026-09-17', parsedBy: 'ai' },
    { id: 3, title: 'ค่ารถสองแถวไปมหาลัย', amount: -2500, type: 'expense', category: 'ค่าเดินทาง', time: '07:30', date: 'วันนี้', dateKey: '2026-09-17', parsedBy: 'regex' },
    { id: 4, title: 'ค่าจ้างติวน้อง', amount: 150000, type: 'income', category: 'รายได้พิเศษ', time: '16:00', date: 'เมื่อวาน', dateKey: '2026-09-16', parsedBy: 'manual' },
    { id: 5, title: 'ข้าวราดแกงโรงอาหาร', amount: -4500, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '12:10', date: 'เมื่อวาน', dateKey: '2026-09-16', parsedBy: 'ai' },
    { id: 6, title: 'ค่าหอพักประจำเดือน', amount: -220000, type: 'expense', category: 'ค่าหอพัก', time: '09:00', date: 'เมื่อวาน', dateKey: '2026-09-16', parsedBy: 'regex' },
    { id: 7, title: 'ค่าปริ้นรายงาน', amount: -8500, type: 'expense', category: 'การศึกษา', time: '14:20', date: '3 วันก่อน', dateKey: '2026-09-14', parsedBy: 'ai' },
    { id: 8, title: 'กาแฟกับเพื่อนหลังเลิกเรียน', amount: -9000, type: 'expense', category: 'บันเทิง/สังสรรค์', time: '18:30', date: '3 วันก่อน', dateKey: '2026-09-14', parsedBy: 'manual' },
    { id: 9, title: 'ทุนการศึกษาเรียนดี', amount: 200000, type: 'income', category: 'ทุนการศึกษา', time: '10:00', date: '1 สัปดาห์ก่อน', dateKey: '2026-09-10', parsedBy: 'manual' },
    { id: 10, title: 'ซื้อสมุด-ปากกา', amount: -6000, type: 'expense', category: 'ของใช้ส่วนตัว', time: '15:45', date: '1 สัปดาห์ก่อน', dateKey: '2026-09-10', parsedBy: 'regex' },
    // รายการเดือนก่อนๆ — ให้ตัวกรอง "หมวดหมู่ + เดือน" ที่ลิงก์มาจาก widget งบประมาณรายเดือนในหน้าสรุปมีข้อมูลให้เห็นจริง
    { id: 11, title: 'ข้าวมันไก่ร้านประจำ', amount: -3500, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '12:00', date: '15 ก.ค. 2026', dateKey: '2026-07-15', parsedBy: 'ai' },
    { id: 12, title: 'ค่าหอพักประจำเดือน', amount: -220000, type: 'expense', category: 'ค่าหอพัก', time: '09:00', date: '5 ก.ค. 2026', dateKey: '2026-07-05', parsedBy: 'regex' },
    { id: 13, title: 'ค่ารถโดยสารไปมหาลัย', amount: -2000, type: 'expense', category: 'ค่าเดินทาง', time: '07:45', date: '10 ก.ค. 2026', dateKey: '2026-07-10', parsedBy: 'regex' },
    { id: 14, title: 'ซื้อของใช้เข้าหอ', amount: -9000, type: 'expense', category: 'ของใช้ส่วนตัว', time: '17:30', date: '8 ก.ค. 2026', dateKey: '2026-07-08', parsedBy: 'manual' },
    { id: 15, title: 'ซื้อหนังสือเปิดเทอม', amount: -35000, type: 'expense', category: 'การศึกษา', time: '13:20', date: '2 ก.ค. 2026', dateKey: '2026-07-02', parsedBy: 'ai' },
    { id: 16, title: 'ดูหนังกับเพื่อน', amount: -10000, type: 'expense', category: 'บันเทิง/สังสรรค์', time: '19:00', date: '20 ก.ค. 2026', dateKey: '2026-07-20', parsedBy: 'manual' },
    { id: 17, title: 'เงินโอนจากที่บ้าน', amount: 600000, type: 'income', category: 'เงินจากที่บ้าน', time: '08:00', date: '1 ก.ค. 2026', dateKey: '2026-07-01', parsedBy: 'manual' },
    { id: 18, title: 'ค่าจ้างติวน้อง', amount: 200000, type: 'income', category: 'รายได้พิเศษ', time: '16:00', date: '25 ก.ค. 2026', dateKey: '2026-07-25', parsedBy: 'manual' },
    { id: 19, title: 'ก๋วยเตี๋ยวหน้าหอ', amount: -4000, type: 'expense', category: 'อาหารและเครื่องดื่ม', time: '12:30', date: '14 ส.ค. 2026', dateKey: '2026-08-14', parsedBy: 'ai' },
    { id: 20, title: 'ค่าหอพักประจำเดือน', amount: -220000, type: 'expense', category: 'ค่าหอพัก', time: '09:00', date: '5 ส.ค. 2026', dateKey: '2026-08-05', parsedBy: 'regex' },
    { id: 21, title: 'ค่ารถสองแถวไปมหาลัย', amount: -2200, type: 'expense', category: 'ค่าเดินทาง', time: '07:40', date: '9 ส.ค. 2026', dateKey: '2026-08-09', parsedBy: 'regex' },
    { id: 22, title: 'ซื้อของใช้ส่วนตัว', amount: -11000, type: 'expense', category: 'ของใช้ส่วนตัว', time: '18:00', date: '11 ส.ค. 2026', dateKey: '2026-08-11', parsedBy: 'manual' },
    { id: 23, title: 'ค่าปริ้นเอกสาร', amount: -5000, type: 'expense', category: 'การศึกษา', time: '14:00', date: '19 ส.ค. 2026', dateKey: '2026-08-19', parsedBy: 'ai' },
    { id: 24, title: 'สังสรรค์วันเกิดเพื่อน', amount: -14000, type: 'expense', category: 'บันเทิง/สังสรรค์', time: '19:30', date: '22 ส.ค. 2026', dateKey: '2026-08-22', parsedBy: 'manual' },
    { id: 25, title: 'เงินโอนจากที่บ้าน', amount: 600000, type: 'income', category: 'เงินจากที่บ้าน', time: '08:00', date: '1 ส.ค. 2026', dateKey: '2026-08-01', parsedBy: 'manual' },
    { id: 26, title: 'ค่าจ้างติวน้อง', amount: 300000, type: 'income', category: 'รายได้พิเศษ', time: '16:00', date: '27 ส.ค. 2026', dateKey: '2026-08-27', parsedBy: 'manual' },
  ],
  categories: [
    { id: 1, name: 'อาหารและเครื่องดื่ม', icon: 'utensils', used: 320000, limit: 400000, percentage: 80, type: 'expense', isEssential: true, sortOrder: 1, color: '#2a78d6' },
    { id: 2, name: 'ค่าหอพัก', icon: 'home', used: 220000, limit: 220000, percentage: 100, type: 'expense', isEssential: true, sortOrder: 2, color: '#eb6834' },
    { id: 3, name: 'ค่าเดินทาง', icon: 'bus', used: 45000, limit: 60000, percentage: 75, type: 'expense', isEssential: true, sortOrder: 3, color: '#1baf7a' },
    { id: 4, name: 'ของใช้ส่วนตัว', icon: 'shopping-bag', used: 25000, limit: 40000, percentage: 63, type: 'expense', isEssential: false, sortOrder: 4, color: '#eda100' },
    { id: 5, name: 'การศึกษา', icon: 'graduation-cap', used: 20000, limit: 50000, percentage: 40, type: 'expense', isEssential: true, sortOrder: 5, color: '#e87ba4' },
    { id: 6, name: 'บันเทิง/สังสรรค์', icon: 'clapperboard', used: 30000, limit: 50000, percentage: 60, type: 'expense', isEssential: false, sortOrder: 6, color: '#008300' },
    { id: 7, name: 'เงินจากที่บ้าน', icon: 'banknote', used: 600000, limit: 600000, percentage: 100, type: 'income', isEssential: true, sortOrder: 7, color: '#2a78d6' },
    { id: 8, name: 'รายได้พิเศษ', icon: 'briefcase', used: 350000, limit: 400000, percentage: 88, type: 'income', isEssential: false, sortOrder: 8, color: '#eb6834' },
  ],
  // ประวัติยอดใช้จ่าย/รายรับรายเดือน แยกตาม categoryId — ใช้สำหรับปุ่มเปลี่ยนเดือนใน widget งบประมาณรายเดือน (index.html)
  // limit ของแต่ละหมวดอ้างอิงจาก categories ด้านบน (ไม่ผูกกับเดือน สมมติว่างบที่ตั้งไม่เปลี่ยนรายเดือน มีแค่ยอดใช้จริงที่เปลี่ยน)
  monthlyHistory: [
    {
      key: '2026-07',
      label: 'ก.ค. 2026',
      usage: { 1: 280000, 2: 220000, 3: 40000, 4: 18000, 5: 35000, 6: 20000, 7: 600000, 8: 200000 },
    },
    {
      key: '2026-08',
      label: 'ส.ค. 2026',
      usage: { 1: 300000, 2: 220000, 3: 42000, 4: 22000, 5: 10000, 6: 28000, 7: 600000, 8: 300000 },
    },
    {
      key: '2026-09',
      label: 'ก.ย. 2026 (เดือนนี้)',
      usage: { 1: 320000, 2: 220000, 3: 45000, 4: 25000, 5: 20000, 6: 30000, 7: 600000, 8: 350000 },
    },
  ],
  plans: [
    { id: 1, name: 'ออมซื้อโน้ตบุ๊คใหม่', target: 2500000, saved: 1400000, progress: 56, confidence: 'high', status: 'normal', dueMonth: 'ธ.ค. 2026', monthly_save: 300000, active: true },
    { id: 2, name: 'กองทุนฉุกเฉินนักศึกษา', target: 1500000, saved: 780000, progress: 52, confidence: 'medium', status: 'off_track', dueMonth: 'ม.ค. 2027', monthly_save: 150000, active: true },
    { id: 3, name: 'ทริปทัศนศึกษากับเพื่อน', target: 800000, saved: 650000, progress: 81, confidence: 'high', status: 'completed', dueMonth: 'พ.ย. 2026', monthly_save: 80000, active: true },
  ],
  donutData: {
    labels: ['อาหาร', 'หอพัก', 'เดินทาง', 'ของใช้/ช้อปปิ้ง', 'อื่น ๆ'],
    values: [42, 29, 6, 13, 10],
    colors: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
  },
  lineData: {
    labels: ['เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'],
    income: [880000, 900000, 850000, 920000, 940000, 950000],
    expense: [700000, 680000, 750000, 690000, 705000, 715000],
  },
};
