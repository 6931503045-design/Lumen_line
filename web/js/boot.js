// ไฟล์นี้ทำหน้าที่อะไร: ต่อหน้าเว็บเข้ากับ API จริง — ตรวจล็อกอิน ดึงข้อมูล แล้วแปลงให้ตรงรูปที่ app.js ใช้
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G1, G3, G6
//
// ทำไมต้องมีไฟล์นี้: app.js เขียนไว้ตอนยังใช้ mock ล้วนๆ โดยอ่านจาก window.mockData ทั้งหมด
// การรื้อ app.js ทั้งไฟล์เสี่ยงเกินไป จึงทำชั้นแปลงข้อมูลไว้ที่นี่แทน แล้วเขียนทับ window.mockData
// ในที่เดิม (ไม่ใช่แทนที่ตัวแปร เพราะ app.js จับ reference ไว้ตั้งแต่โหลด) แล้วสั่ง render ใหม่
//
// ⚖️ G1: ไฟล์นี้ "แปลง" ข้อมูลเท่านั้น ห้ามคำนวณเงิน — ทุกยอดมาจาก API ตรงๆ
// ที่คำนวณได้มีแค่เรื่องแสดงผลล้วนๆ (เช่น สีของหมวด, ป้ายวันที่) ตาม docs/UI_CONTRACT.md ข้อ 5

(function () {
  const api = window.moneyBotApi;
  if (!api) return;

  /** หน้าที่ต่อ API เสร็จแล้ว — หน้าที่ยังไม่อยู่ในนี้จะขึ้นแถบบอกว่าเป็นข้อมูลตัวอย่าง */
  const WIRED_PAGES = new Set(['dashboard']);

  /** สีประจำหมวด — API ไม่ได้ส่งสีมา อันนี้เป็นเรื่องแสดงผลล้วนๆ ไม่ใช่ข้อมูลเงิน */
  const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];

  /** ชื่อหมวด (ตามหมวดตั้งต้นของระบบ) → ไอคอน Lucide ที่ app.js มีอยู่แล้ว */
  const CATEGORY_ICONS = {
    'อาหาร': 'utensils', 'อาหารและเครื่องดื่ม': 'utensils', 'กาแฟ': 'utensils',
    'ค่าหอพัก': 'home', 'ที่พัก': 'home', 'บ้าน': 'home',
    'เดินทาง': 'bus', 'ค่าเดินทาง': 'bus',
    'ช้อปปิ้ง': 'shopping-bag', 'ของใช้ส่วนตัว': 'shopping-bag',
    'การศึกษา': 'graduation-cap', 'เรียน': 'graduation-cap',
    'บันเทิง': 'clapperboard', 'บันเทิง/สังสรรค์': 'clapperboard',
    'เงินเดือน': 'banknote', 'เงินจากที่บ้าน': 'banknote', 'รายได้': 'banknote',
    'รายได้พิเศษ': 'briefcase', 'ทุนการศึกษา': 'graduation-cap',
  };

  const bangkok = (iso, opts) =>
    new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', calendar: 'gregory', ...opts }).format(new Date(iso));

  /** YYYY-MM-DD ตามเวลาไทย (ใช้จัดกลุ่มรายการตามวัน) */
  function dateKeyOf(iso) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(iso));
    return parts;
  }

  /** ป้ายวันแบบอ่านง่าย — เรื่องแสดงผลล้วนๆ */
  function dateLabelOf(dateKey, todayKey) {
    if (dateKey === todayKey) return 'วันนี้';
    const diff = Math.round((new Date(todayKey) - new Date(dateKey)) / 86400000);
    if (diff === 1) return 'เมื่อวาน';
    if (diff > 1 && diff < 7) return `${diff} วันก่อน`;
    const [y, m, d] = dateKey.split('-').map(Number);
    return bangkok(new Date(y, m - 1, d).toISOString(), { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ---------- หน้าจอสถานะ ----------

  function replaceShell(html) {
    const shell = document.querySelector('.app-shell');
    if (shell) shell.innerHTML = html;
  }

  function showLogin() {
    const reason = new URLSearchParams(window.location.search).get('login');
    const notes = {
      'no-account': 'ล็อกอินสำเร็จแล้ว แต่ยังไม่ได้แอดเพื่อนบอทใน LINE — แอดเพื่อนก่อนแล้วเข้ามาใหม่',
      cancelled: 'ยกเลิกการเข้าสู่ระบบไปเมื่อสักครู่',
    };
    const note = notes[reason];
    replaceShell(`
      <main class="page-content">
        <section class="an-card dark" style="text-align:center">
          <h2 style="margin:0 0 8px">JOD tang</h2>
          <p style="color:var(--on-dark-muted);margin:0 0 20px">เข้าสู่ระบบด้วย LINE เพื่อดูข้อมูลการเงินของคุณ</p>
          ${note ? `<p class="an-sim-verdict" style="margin-bottom:20px">${note}</p>` : ''}
          <a class="primary-btn full" style="display:block;text-decoration:none" href="/auth/login">เข้าสู่ระบบด้วย LINE</a>
        </section>
      </main>
    `);
  }

  function showError(message) {
    replaceShell(`
      <main class="page-content">
        <section class="an-card">
          <h3>เปิดหน้านี้ไม่ได้</h3>
          <p class="an-detail-lead">${message}</p>
          <button class="primary-btn full" type="button" onclick="location.reload()">ลองใหม่</button>
        </section>
      </main>
    `);
  }

  /** หน้าที่ยังไม่ได้ต่อ API ต้องบอกให้ชัดว่าตัวเลขที่เห็นไม่ใช่ของจริง */
  function showSampleBanner() {
    const main = document.querySelector('.page-content');
    if (!main) return;
    const banner = document.createElement('div');
    banner.className = 'an-sim-verdict warn';
    banner.style.marginBottom = 'var(--space-3)';
    banner.textContent = 'หน้านี้ยังแสดงข้อมูลตัวอย่าง ยังไม่ได้ต่อกับข้อมูลจริงของคุณ';
    main.prepend(banner);
  }

  function applyProfile(me) {
    const name = me.displayName || 'ผู้ใช้';
    const initials = name.trim().slice(0, 2).toUpperCase();
    document.querySelectorAll('.avatar').forEach((el) => { el.textContent = initials; });
    if (document.body.dataset.page === 'dashboard') {
      const heading = document.querySelector('.profile-meta h1');
      if (heading) heading.textContent = name;
    }
  }

  // ---------- แปลงข้อมูล API → รูปที่ app.js ใช้ ----------

  function mapCategories(categories, budgets, expenseByCategory) {
    const limitOf = new Map(budgets.items.map((b) => [b.categoryId, b.limitSatang]));
    const spentOf = new Map(expenseByCategory.filter((e) => e.categoryId).map((e) => [e.categoryId, e.amountSatang]));
    return categories.map((cat, index) => {
      const limit = limitOf.get(cat.id) ?? 0;
      const used = spentOf.get(cat.id) ?? 0;
      return {
        id: cat.id,
        name: cat.name,
        icon: CATEGORY_ICONS[cat.name] || 'tag',
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        type: cat.type,
        isEssential: Boolean(cat.isEssential),
        sortOrder: index + 1,
        limit,
        used,
        // percentUsed มาจาก API เมื่อมีงบ ถ้าไม่มีงบก็ไม่มีเปอร์เซ็นต์ให้แสดง (ห้ามคิดเอง — G1)
        percentage: budgets.items.find((b) => b.categoryId === cat.id)?.percentUsed ?? 0,
      };
    });
  }

  function mapTransactions(rows) {
    const todayKey = dateKeyOf(new Date().toISOString());
    return rows.map((row) => {
      const dateKey = dateKeyOf(row.occurredAt);
      return {
        id: row.id,
        title: row.title,
        // app.js ใช้ยอดแบบมีเครื่องหมาย ส่วน API ส่งยอดบวกเสมอแล้วบอกทิศทางด้วย type (G3)
        amount: row.type === 'income' ? row.amountSatang : -row.amountSatang,
        type: row.type,
        category: row.category || 'ไม่ระบุหมวด',
        time: bangkok(row.occurredAt, { hour: '2-digit', minute: '2-digit', hour12: false }),
        date: dateLabelOf(dateKey, todayKey),
        dateKey,
        parsedBy: row.parsedBy,
      };
    });
  }

  function mapPlans(plans) {
    return plans.items
      .filter((plan) => plan.status !== 'draft') // draft = ทางเลือกที่ยังไม่ได้เลือก ไม่ใช่แผนจริง
      .map((plan) => ({
        id: plan.planId,
        name: plan.title,
        target: plan.targetSatang,
        saved: plan.savedSatang,
        progress: plan.percentComplete,
        confidence: plan.confidence,
        status: plan.reachedTarget ? 'completed' : plan.offTrack ? 'off_track' : 'normal',
        dueMonth: plan.targetDate
          ? bangkok(plan.targetDate, { month: 'short', year: 'numeric' })
          : '—',
        monthly_save: plan.monthlySaveSatang,
        active: plan.status === 'active' || plan.status === 'completed',
      }));
  }

  /** เดือนที่ยังไม่ได้ดึงงบมา จะไม่มี usage — ใช้เช็คก่อน render */
  const loadedMonths = new Set();

  function monthKeyOf(isoMonth) { return isoMonth.slice(0, 7); }

  async function loadMonthBudgets(monthKey) {
    if (loadedMonths.has(monthKey)) return;
    const budgets = await api.fetchBudgets(monthKey);
    const month = window.mockData.monthlyHistory.find((m) => m.key === monthKey);
    if (month) {
      budgets.items.forEach((item) => { month.usage[item.categoryId] = item.spentSatang; });
    }
    loadedMonths.add(monthKey);
  }

  // ---------- โหลดหน้าสรุป ----------

  async function loadDashboard(plans) {
    const [summary, budgets, categories, transactions] = await Promise.all([
      api.fetchSummary(),
      api.fetchBudgets(),
      api.fetchCategories(),
      api.fetchTransactions(),
    ]);

    const thisMonthKey = monthKeyOf(budgets.month);
    const safe = summary.safeToSpend;

    // 6 เดือนจาก monthlyTrend — usage ของเดือนอื่นเติมทีหลังตอนผู้ใช้กดเปลี่ยนเดือน
    const history = summary.monthlyTrend.map((m) => ({
      key: m.month,
      label: m.month === thisMonthKey ? `${m.label} (เดือนนี้)` : m.label,
      usage: {},
    }));
    const current = history.find((m) => m.key === thisMonthKey);
    if (current) {
      budgets.items.forEach((item) => { current.usage[item.categoryId] = item.spentSatang; });
      loadedMonths.add(thisMonthKey);
    }

    Object.assign(window.mockData, {
      user: { name: '', avatar: '', subtitle: '' },
      summary: {
        balance: summary.netBalanceSatang,
        income: summary.monthIncomeSatang,
        expense: summary.monthExpenseSatang,
        safeToSpend: safe.perDaySatang,
        overspent: safe.overspentSatang,
        monthRemaining: safe.monthRemainingSatang,
        daysLeft: safe.daysLeft,
        monthlyBudgetLimit: budgets.totalLimitSatang,
        monthlyBudgetUsed: budgets.totalSpentSatang,
        safeToSpendConfidence: (plans.capacity && plans.capacity.confidence) || 'medium',
      },
      transactions: mapTransactions(transactions),
      categories: mapCategories(categories, budgets, summary.expenseByCategory),
      monthlyHistory: history,
      plans: mapPlans(plans),
    });

    window.__jodtangBudgetsAvailable = budgets.available;
    renderDashboard();
  }

  // ---------- เริ่มทำงาน ----------

  async function start() {
    let me;
    try {
      me = await api.fetchMe();
    } catch (err) {
      if (err && err.status === 401) showLogin();
      else showError((err && err.message) || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      return;
    }

    applyProfile(me);

    if (!WIRED_PAGES.has(document.body.dataset.page)) {
      showSampleBanner();
      return;
    }

    try {
      const plans = await api.fetchPlans();
      await loadDashboard(plans);
    } catch (err) {
      showError((err && err.message) || 'โหลดข้อมูลไม่สำเร็จ');
    }
  }

  // เปลี่ยนเดือนในวิดเจ็ตงบ: ต้องดึงงบของเดือนนั้นก่อนค่อย render
  // app.js ประกาศ renderMonthlyBudgetSummary แบบ function ที่ระดับบนสุด จึงอยู่บน window
  // การครอบตรงนี้ทำให้ผู้เรียกเดิมใน app.js ได้ตัวที่ครอบแล้วไปด้วย
  const originalRender = window.renderMonthlyBudgetSummary;
  if (typeof originalRender === 'function') {
    window.renderMonthlyBudgetSummary = function wrapped() {
      // dashboardState ประกาศด้วย const ใน app.js จึงไม่อยู่บน window แต่อยู่ใน global scope
      const key = typeof dashboardState !== 'undefined' ? dashboardState.activeMonthKey : null;
      if (key && !loadedMonths.has(key)) {
        loadMonthBudgets(key).then(() => originalRender()).catch(() => originalRender());
        return;
      }
      return originalRender();
    };
  }

  // app.js ผูก DOMContentLoaded ไว้ก่อน ตัวนี้จึงทำงานหลัง render ด้วย mock เสร็จแล้ว
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
