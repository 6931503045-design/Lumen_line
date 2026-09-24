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

  // บอก app.js ว่าอย่าผูก handler แบบ mock ซ้อนเข้ามา (ต้องตั้งก่อน DOMContentLoaded
  // เพราะตอนนั้นยังไม่รู้ว่ามี backend ไหม — ถ้าไม่มีจะถอนคืนใน enterPreviewMode())
  window.__jodtangApiWired = true;

  /** true = ไม่มี backend ให้เรียก กำลังโชว์ข้อมูลตัวอย่างอย่างเดียว */
  let previewMode = false;

  /** หน้าที่ต่อ API เสร็จแล้ว — หน้าที่ยังไม่อยู่ในนี้จะขึ้นแถบบอกว่าเป็นข้อมูลตัวอย่าง */
  const WIRED_PAGES = new Set(['dashboard', 'transactions', 'categories', 'analyze', 'settings']);

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

  /**
   * อีโมจิ -> ไอคอน สำหรับหมวดที่ผู้ใช้สร้างเอง ซึ่งชื่อไม่ตรงกับตารางข้างบนแน่นอน
   * ต้องตรงกับ ICON_TO_EMOJI ใน app.js เสมอ (ทางกลับของกันและกัน)
   */
  const EMOJI_TO_ICON = {
    '🍜': 'utensils', '🏠': 'home', '🚗': 'bus', '🚙': 'car', '⛽': 'fuel',
    '🛍️': 'shopping-bag', '👕': 'shirt', '📚': 'graduation-cap', '📖': 'book-open',
    '🎮': 'clapperboard', '☕': 'coffee', '💊': 'heart-pulse', '🏋️': 'dumbbell',
    '🐾': 'paw-print', '✈️': 'plane', '🎁': 'gift', '👥': 'users', '📱': 'smartphone',
    '💰': 'banknote', '💵': 'briefcase', '🐖': 'piggy-bank', '📦': 'tag',
    '↩️': 'banknote',
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

  /** กันข้อความจากผู้ใช้/หลังบ้านไม่ให้กลายเป็น HTML ตอนเอาไปต่อสตริง */
  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** บาทที่ผู้ใช้พิมพ์ -> สตางค์ (integer) — backend รับเฉพาะสตางค์ตามกฎ G3 */
  function bahtToSatang(value) {
    const baht = Number(String(value ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(baht)) return null;
    return Math.round(baht * 100);
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
          <button class="secondary-btn full" type="button" id="previewAnywayBtn" style="margin-top:10px">ดูตัวอย่างหน้าจอก่อน</button>
        </section>
      </main>
    `);

    // 🔴 สำคัญต่อการตรวจงาน (Milestone 3): ถ้าไม่มีปุ่มนี้ คนที่เปิดลิงก์โดยไม่มีบัญชี LINE
    // จะเห็นแค่กำแพงล็อกอิน คลิกดูหน้าจอไม่ได้สักหน้า ทั้งที่เกณฑ์ขอให้ "เปิดดูได้ในเบราว์เซอร์"
    // enterPreviewMode() มีอยู่แล้วสำหรับกรณีไม่มี backend — ใช้ตัวเดิมซ้ำได้เลย
    // โหลดหน้าใหม่พร้อม ?preview=1 แทนการคืน DOM เดิม เพราะ replaceShell() เขียนทับ
    // .app-shell ไปแล้ว การใส่ HTML เดิมกลับจะได้ element ชุดใหม่ที่ไม่มี listener ของ app.js
    const previewBtn = document.getElementById('previewAnywayBtn');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('preview', '1');
        window.location.href = url.toString();
      });
    }
  }

  function showOffline() {
    replaceShell(`
      <main class="page-content">
        <section class="an-card">
          <h3>เชื่อมต่อไม่ได้</h3>
          <p class="an-detail-lead">ตอนนี้ติดต่อเซิร์ฟเวอร์ไม่ได้ อาจเป็นเพราะสัญญาณอินเทอร์เน็ตหลุด<br>ข้อมูลการเงินของคุณยังอยู่ครบ แค่ตอนนี้ดึงมาแสดงไม่ได้</p>
          <button class="primary-btn full" type="button" onclick="location.reload()">ลองใหม่อีกครั้ง</button>
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

  /**
   * เปิดหน้าเว็บจากเซิร์ฟเวอร์ไฟล์ธรรมดา (Live Server, python -m http.server, GitHub Pages)
   * จะไม่มี /api/* ให้เรียก — กรณีนี้ต้องให้ดู UI ด้วยข้อมูลตัวอย่างต่อไปได้ ไม่ใช่ปิดหน้าทิ้ง
   * แต่ต้องบอกให้ชัดว่าไม่ใช่ข้อมูลจริง
   */
  function enterPreviewMode() {
    previewMode = true;
    // คืนค่าให้ app.js ทำงานแบบเดิมทุกอย่าง: ไม่มี backend ให้บันทึก การแก้ข้อมูลในเครื่องจึงเป็นทางเดียว
    window.__jodtangApiWired = false;
    delete window.jodtangPersist;
    if (typeof bindSettingsActions === 'function') bindSettingsActions();
    // หน้าถูกวาดไปแล้วตอนที่ยังไม่รู้ว่ามี backend (flag ยังเป็น true อยู่ทำให้ getLimitToday ใช้วันที่จริง)
    // วาดใหม่หลังคืน flag เพื่อให้เพดานใช้วันที่ของข้อมูลตัวอย่าง
    renderCurrentPage();
    showPreviewBanner();
  }

  function showPreviewBanner() {
    const main = document.querySelector('.page-content');
    if (!main) return;
    const banner = document.createElement('div');
    banner.className = 'an-sim-verdict warn';
    banner.style.marginBottom = 'var(--space-3)';
    banner.innerHTML = 'กำลังดูตัวอย่างหน้าตาเว็บ ตัวเลขทั้งหมดเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลของคุณ'
      + '<br><small style="font-weight:400">หน้านี้เปิดจากที่ที่ไม่มีระบบหลังบ้าน ถ้าต้องการข้อมูลจริงให้เข้าผ่านลิงก์ของแอป</small>';
    main.prepend(banner);
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
        // ชื่อหมวดตั้งต้นก่อน แล้วค่อยถอยไปใช้อีโมจิที่ผู้ใช้เลือกตอนสร้างหมวดเอง
        icon: CATEGORY_ICONS[cat.name] || EMOJI_TO_ICON[cat.emoji] || 'tag',
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

  // ---------- โหลดข้อมูลรวม (ใช้ร่วมกันทุกหน้า) ----------

  async function loadAll() {
    const [summary, budgets, categories, transactions, plans] = await Promise.all([
      api.fetchSummary(),
      api.fetchBudgets(),
      api.fetchCategories(),
      api.fetchTransactions(),
      api.fetchPlans(),
    ]);

    const thisMonthKey = monthKeyOf(budgets.month);
    const safe = summary.safeToSpend;

    const history = summary.monthlyTrend.map((m) => ({
      key: m.month,
      label: m.month === thisMonthKey ? `${m.label} (เดือนนี้)` : m.label,
      usage: {},
    }));
    const current = history.find((m) => m.key === thisMonthKey);
    if (current) {
      budgets.items.forEach((item) => { current.usage[item.categoryId] = item.spentSatang; });
      loadedMonths.clear();
      loadedMonths.add(thisMonthKey);
    }

    // โดนัท: สัดส่วนรายจ่ายตามหมวดของเดือนนี้ — เปอร์เซ็นต์คิดจากยอดที่ API ส่งมาเพื่อแสดงผลเท่านั้น
    const expenseTotal = summary.expenseByCategory.reduce((sum, e) => sum + e.amountSatang, 0);
    const donut = {
      labels: summary.expenseByCategory.map((e) => e.name),
      values: summary.expenseByCategory.map((e) => (expenseTotal ? Math.round((e.amountSatang / expenseTotal) * 100) : 0)),
      colors: summary.expenseByCategory.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
      amounts: summary.expenseByCategory.map((e) => e.amountSatang),
    };

    Object.assign(window.mockData, {
      summary: {
        balance: summary.netBalanceSatang,
        income: summary.monthIncomeSatang,
        expense: summary.monthExpenseSatang,
        transactionCount: summary.transactionCount,
        // ชื่อตัวเลขที่ backend บอกเองว่ายังคำนวณให้ไม่ได้ — หน้าเว็บต้องขึ้นว่า "ยังไม่มีข้อมูล" ไม่ใช่ ฿0
        unavailable: Array.isArray(summary.unavailable) ? summary.unavailable : [],
        safeToSpend: safe.perDaySatang,
        overspent: safe.overspentSatang,
        monthRemaining: safe.monthRemainingSatang,
        daysLeft: safe.daysLeft,
        monthlyBudgetLimit: budgets.totalLimitSatang,
        monthlyBudgetUsed: budgets.totalSpentSatang,
        safeToSpendConfidence: (plans.capacity && plans.capacity.confidence) || 'medium',
        // กำลังออมต่อเดือนมาจาก service ฝั่ง backend ห้ามหน้าเว็บเดาเอง (G1)
        savingCapacity: plans.capacity ? plans.capacity.disposableSatang : null,
        forecastBalance: null,
        daysOfData: null,
      },
      transactions: mapTransactions(transactions),
      categories: mapCategories(categories, budgets, summary.expenseByCategory),
      monthlyHistory: history,
      plans: mapPlans(plans),
      donutData: donut,
      lineData: {
        labels: summary.monthlyTrend.map((m) => m.label),
        income: summary.monthlyTrend.map((m) => m.incomeSatang),
        expense: summary.monthlyTrend.map((m) => m.expenseSatang),
      },
      budgetsAvailable: budgets.available,
    });
  }

  /** วาดหน้าใหม่หลังข้อมูลเปลี่ยน */
  function renderCurrentPage() {
    const page = document.body.dataset.page;
    if (page === 'dashboard') renderDashboard();
    if (page === 'transactions') renderTransactionsPage();
    if (page === 'categories') renderCategoriesPage();
    if (page === 'analyze') renderAnalyzePage();
    if (page === 'settings') renderSpendingLimitSettings();
  }

  async function refresh() {
    await loadAll();
    renderCurrentPage();
  }

  // ---------- หน้าตั้งค่า ----------

  async function loadSettings() {
    const settings = await api.fetchSettings();
    const emailEl = document.getElementById('ingestEmail');
    const ingest = settings.emailIngest || {};
    if (emailEl) {
      emailEl.textContent = ingest.available && ingest.address ? ingest.address : 'ระบบอีเมลยังไม่เปิดใช้งาน';
    }

    if (ingest.unparsedCount > 0) {
      const box = document.querySelector('.an-email-box');
      if (box) {
        const note = document.createElement('p');
        note.className = 'ai-disclaimer';
        note.style.margin = 'var(--space-2) 0 0';
        note.textContent = `มีอีเมล ${ingest.unparsedCount} ฉบับที่ระบบอ่านยอดไม่ออก`;
        box.after(note);
      }
    }

    // สวิตช์: backend มีแค่ aiEnabled แบบอ่านอย่างเดียว (ค่าระดับระบบ) ส่วนสรุปรายวันยังไม่มี endpoint
    // จึงแสดงสถานะจริงแล้วล็อกไว้ ดีกว่าปล่อยให้กดได้แต่ไม่มีผลอะไร
    const lock = (key, isOn, note) => {
      const toggle = document.querySelector(`[data-setting="${key}"]`);
      if (!toggle) return;
      toggle.classList.toggle('on', Boolean(isOn));
      toggle.setAttribute('aria-checked', String(Boolean(isOn)));
      toggle.disabled = true;
      toggle.style.opacity = '0.5';
      toggle.style.cursor = 'not-allowed';
      const text = toggle.closest('.an-setting-row')?.querySelector('.an-action-text small');
      if (text) text.textContent = note;
    };
    lock('aiAssistant', settings.aiEnabled, settings.aiEnabled ? 'ระบบเปิดใช้งานอยู่ (ตั้งค่าที่เซิร์ฟเวอร์)' : 'ระบบปิดใช้งานอยู่ (ตั้งค่าที่เซิร์ฟเวอร์)');
    lock('dailySummary', false, 'ยังไม่มี API สำหรับเปิด/ปิดรายคน');

    const logout = document.getElementById('logoutBtn');
    if (logout) {
      logout.hidden = false;
      logout.addEventListener('click', () => {
        openModal(`
          <div class="modal-card small an-detail">
            <div class="modal-head">
              <h3>ออกจากระบบ?</h3>
              <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
            </div>
            <p class="an-detail-lead">ข้อมูลของคุณยังอยู่ครบ เข้าสู่ระบบด้วย LINE เดิมเมื่อไรก็กลับมาดูได้</p>
            <div class="an-detail-actions two">
              <button class="secondary-btn" type="button" data-close-modal="true">ยกเลิก</button>
              <button class="primary-btn danger" type="button" id="confirmLogoutBtn">ออกจากระบบ</button>
            </div>
          </div>
        `);
        const confirmBtn = document.getElementById('confirmLogoutBtn');
        if (confirmBtn) confirmBtn.addEventListener('click', () => api.logout());
      });
    }

    const rotate = document.getElementById('rotateTokenBtn');
    if (rotate) {
      rotate.addEventListener('click', async () => {
        rotate.disabled = true;
        try {
          const result = await api.rotateEmailToken();
          if (emailEl && result.address) emailEl.textContent = result.address;
          showSuccessModal('สร้างที่อยู่อีเมลใหม่แล้ว');
        } catch (err) {
          showAlertModal(err.message, 'สร้างที่อยู่ใหม่ไม่สำเร็จ');
        } finally {
          rotate.disabled = false;
        }
      });
    }
  }

  // ---------- บันทึกข้อมูลผ่าน API ----------
  // app.js เรียกผ่าน window.jodtangPersist แทนการแก้ข้อมูลในเครื่อง แล้วโหลดใหม่ทั้งชุด
  // เพื่อให้ทุกยอดบนหน้าเป็นตัวเลขที่ backend คำนวณ ไม่ใช่ที่หน้าเว็บเดาต่อเอง (G1)

  async function runWrite(action, successText) {
    try {
      const result = await action();
      closeModal();
      await refresh();
      if (successText) showSuccessModal(typeof successText === 'function' ? successText(result) : successText);
      return result;
    } catch (err) {
      closeModal();
      showAlertModal((err && err.message) || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', 'บันทึกไม่สำเร็จ');
      return null;
    }
  }

  /** ให้ผู้ใช้เลือก 1 ใน 3 ทางเลือกที่ backend คำนวณมา แล้วยืนยัน (S5.3) */
  function showPlanOptions(result) {
    const options = result.options || [];
    if (!options.length) {
      showAlertModal(result.requestedMonthsNote || 'ตอนนี้ยังออมไม่ไหว ลองลดเป้าหมายหรือยืดเวลาออกไป', 'สร้างแผนไม่ได้');
      return;
    }
    openModal(`
      <div class="modal-card small an-detail">
        <div class="modal-head">
          <h3>เลือกแบบที่ไหว</h3>
          <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
        </div>
        ${result.requestedMonthsNote ? `<p class="an-detail-lead">${result.requestedMonthsNote}</p>` : ''}
        <div class="an-action-list">
          ${options.map((opt) => `
            <button type="button" class="an-action" data-confirm-plan="${opt.planId}">
              <span class="an-action-icon">${opt.emoji || '💰'}</span>
              <span class="an-action-text">
                <strong>${opt.title}</strong>
                <small>เดือนละ ${formatMoney(opt.monthlySaveSatang)} · ${opt.months} เดือน · ครบ ${bangkok(opt.targetDate, { day: 'numeric', month: 'short', year: 'numeric' })}</small>
              </span>
              ${renderConfidenceBadge(opt.confidence)}
            </button>
          `).join('')}
        </div>
        <p class="an-detail-tip">${renderIcon('sparkles')}<span>ตัวเลขทั้งหมดคำนวณจากกำลังออมจริงของคุณ</span></p>
      </div>
    `);
    document.querySelectorAll('[data-confirm-plan]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runWrite(() => api.confirmPlan(btn.dataset.confirmPlan), 'สร้างแผนสำเร็จ');
      });
    });
  }

  window.jodtangPersist = {
    createTransaction: (body) => runWrite(() => api.createTransaction(body), (res) => {
      if (res && res.budgetAlert) {
        const a = res.budgetAlert;
        return `บันทึกแล้ว · ${a.categoryName} ใช้ไป ${a.percentUsed}% ของงบแล้ว`;
      }
      return 'เพิ่มรายการสำเร็จ';
    }),
    updateTransaction: (id, patch) => runWrite(() => api.updateTransaction(id, patch), 'อัปเดตรายการสำเร็จ'),
    deleteTransaction: async (id) => {
      // สัญญาแนะนำให้ทำปุ่ม "เลิกทำ" ค้างไว้แทนการถามยืนยันก่อนลบทุกครั้ง
      // backend ลบแบบ soft delete จึงกู้คืนได้จริงด้วย /restore
      const result = await runWrite(() => api.deleteTransaction(id), null);
      if (!result) return;
      openModal(`
        <div class="modal-card success-modal">
          <div class="success-icon">${renderIcon('check')}</div>
          <h3>ลบรายการแล้ว</h3>
          <p>ถ้าลบผิด กดเลิกทำได้ทันที</p>
          <div class="modal-actions split">
            <button class="secondary-btn" type="button" id="undoDeleteBtn">เลิกทำ</button>
            <button class="primary-btn" type="button" data-close-modal="true">เรียบร้อย</button>
          </div>
        </div>
      `);
      const undo = document.getElementById('undoDeleteBtn');
      if (undo) {
        undo.addEventListener('click', () => {
          runWrite(() => api.restoreTransaction(id), 'กู้คืนรายการแล้ว');
        });
      }
    },
    // ---------- หมวดหมู่ ----------
    // เดิมปุ่มเพิ่ม/ลบหมวดแก้แต่ mock.categories ในหน่วยความจำแล้วขึ้นว่า "สำเร็จ"
    // ผู้ใช้รีเฟรชทีเดียวหายหมด ซึ่งแย่กว่าไม่มีปุ่มเลย
    createCategory: (body) => runWrite(() => api.createCategory(body), 'เพิ่มหมวดหมู่สำเร็จ'),
    updateCategory: (categoryId, patch) => runWrite(() => api.updateCategory(categoryId, patch), 'แก้หมวดหมู่สำเร็จ'),
    // backend ตอบ 409 พร้อมบอกจำนวนรายการที่ยังผูกอยู่ ถ้าลบไม่ได้ — runWrite โชว์ข้อความนั้นให้เอง
    deleteCategory: (categoryId) => runWrite(() => api.deleteCategory(categoryId), 'ลบหมวดหมู่สำเร็จ'),

    setBudget: (categoryId, limitSatang) => runWrite(() => api.saveBudget(categoryId, limitSatang), 'ตั้งงบสำเร็จ'),
    clearBudget: (categoryId) => runWrite(() => api.deleteBudget(categoryId), 'ยกเลิกงบหมวดนี้แล้ว'),
    transferToPlan: (planId, amountSatang) => runWrite(
      () => api.transferToPlan(planId, amountSatang),
      (res) => (res && res.justCompleted ? 'ยินดีด้วย ออมครบเป้าแล้ว' : 'โอนเงินเข้าแผนสำเร็จ')
    ),
    cancelPlan: (planId) => runWrite(() => api.cancelPlan(planId), 'ยกเลิกแผนแล้ว'),
    createPlan: async (body) => {
      try {
        const result = await api.createPlan(body.title, body.targetSatang, body.months);
        closeModal();
        showPlanOptions(result);
      } catch (err) {
        closeModal();
        showAlertModal((err && err.message) || 'เกิดข้อผิดพลาด', 'สร้างแผนไม่สำเร็จ');
      }
    },
  };

  // ---------- กำลังออมจริง ----------
  // app.js เดาเงินออมต่อเดือนเองใน wizard (เป้าหมาย × 0.12 ฯลฯ) ซึ่งเป็นแค่ตัวอย่างหน้าจอ
  // ตัวเลขที่ผูกพันจริงมาจาก /api/plans ตอนกดสร้าง (showPlanOptions) ตรงนี้จึงเติม
  // "กำลังออมจริง" ที่ backend คำนวณให้ ผู้ใช้จะได้ไม่ตั้งเป้าที่ตัวเองไปไม่ถึงตั้งแต่ต้น (G1)

  let planCapacity = null;

  function fillPlanCapacityHint() {
    const box = document.getElementById('planCapacityHint');
    if (!box || !planCapacity) return;
    const monthly = planCapacity.monthlyCapacitySatang;
    if (typeof monthly !== 'number') return;
    box.textContent = monthly > 0
      ? `ตอนนี้คุณออมไหวราวเดือนละ ${formatMoney(monthly)}`
      : 'ตอนนี้รายจ่ายยังกินรายรับหมด ลองลดงบสักหมวดก่อนตั้งแผน';
    box.hidden = false;
  }

  function installPlanCapacity() {
    const openOriginal = window.openPlanWizard;
    const stepOriginal = window.renderPlanWizardStep;
    if (typeof openOriginal !== 'function' || typeof stepOriginal !== 'function') return;

    window.openPlanWizard = function wrappedOpenPlanWizard(preset) {
      const result = openOriginal(preset);
      // ดึงครั้งเดียวต่อการเปิด wizard แล้วเติมเมื่อได้คำตอบ ไม่บล็อกการเปิดหน้าต่าง
      api.fetchPlanCapacity()
        .then((capacity) => { planCapacity = capacity; fillPlanCapacityHint(); })
        .catch(() => { planCapacity = null; });
      return result;
    };

    // ทุกครั้งที่ย้อนกลับมา step 1 ช่องนี้ถูกสร้างใหม่ ต้องเติมซ้ำ
    window.renderPlanWizardStep = function wrappedRenderPlanWizardStep() {
      const result = stepOriginal();
      fillPlanCapacityHint();
      return result;
    };
  }

  // ---------- รายการประจำ ----------
  // เงินเดือน/ค่าหอ/ค่าเน็ต ที่ backend บันทึกให้เองทุกรอบ อยู่ในหน้าตั้งค่า
  // ส่วนนี้ไม่ผ่าน window.mockData เพราะ app.js ไม่มีหน้าจอสำหรับมันมาก่อน จึงวาดเองทั้งก้อน

  const FREQUENCY_LABEL = {
    daily: 'ทุกวัน', weekly: 'ทุกสัปดาห์', monthly: 'ทุกเดือน', yearly: 'ทุกปี',
  };

  function renderRecurringList(items) {
    const box = document.getElementById('recurringList');
    if (!box) return;
    if (!items.length) {
      box.innerHTML = '<p class="an-note">ยังไม่มีรายการประจำ — ใส่เงินเดือนกับค่าหอไว้ ระบบจะบันทึกให้เองทุกรอบ</p>';
      return;
    }
    box.innerHTML = items.map((rule) => `
      <div class="setting-item">
        <div>
          <strong>${escapeHtml(rule.label)}</strong>
          <span>${FREQUENCY_LABEL[rule.frequency] || escapeHtml(rule.frequency)} · ${formatMoney(rule.amountSatang)}${rule.nextRun ? ` · รอบถัดไป ${escapeHtml(rule.nextRun)}` : ''}</span>
        </div>
        <span class="pill ${rule.type === 'income' ? '' : 'muted'}">${rule.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</span>
        <button class="secondary-btn small" type="button" data-recurring-delete="${rule.id}">ลบ</button>
      </div>
    `).join('');
  }

  async function refreshRecurring() {
    const box = document.getElementById('recurringList');
    const panel = document.getElementById('recurringPanel');
    if (!box) return;
    try {
      const data = await api.fetchRecurring();
      renderRecurringList(data.items || []);
    } catch (err) {
      if (err && err.status === 404) {
        // backend รุ่นนี้ยังไม่มี /recurring — ซ่อนทั้งส่วนไปเลย ดีกว่าโชว์กล่องที่กดแล้วพัง
        if (panel) panel.hidden = true;
        return;
      }
      box.innerHTML = `<p class="an-note">โหลดรายการประจำไม่สำเร็จ${err && err.message ? `: ${escapeHtml(err.message)}` : ''}</p>`;
    }
    if (panel) panel.hidden = false;
  }

  function openRecurringModal() {
    openModal(`
      <div class="modal-card small">
        <div class="modal-head">
          <h3>เพิ่มรายการประจำ</h3>
          <button class="close-btn" type="button" data-close-modal="true">${renderIcon('x')}</button>
        </div>
        <div class="form-grid">
          <label class="form-field">
            <span>ชื่อรายการ</span>
            <input id="recurringLabel" placeholder="เช่น เงินเดือน, ค่าหอ" />
          </label>
          <label class="form-field">
            <span>จำนวนเงิน (บาท)</span>
            <input id="recurringAmount" type="number" inputmode="decimal" min="1" step="0.01" placeholder="3500" />
          </label>
          <label class="form-field">
            <span>ประเภท</span>
            <div class="segmented-control">
              <button type="button" class="segmented active" data-recurring-type="expense">รายจ่าย</button>
              <button type="button" class="segmented" data-recurring-type="income">รายรับ</button>
            </div>
          </label>
          <label class="form-field">
            <span>ความถี่</span>
            <select id="recurringFrequency">
              <option value="monthly">ทุกเดือน</option>
              <option value="weekly">ทุกสัปดาห์</option>
              <option value="daily">ทุกวัน</option>
              <option value="yearly">ทุกปี</option>
            </select>
          </label>
          <label class="form-field">
            <span>เริ่มรอบแรกวันไหน</span>
            <input id="recurringStart" type="date" />
          </label>
        </div>
        <p id="recurringError" class="field-error" hidden></p>
        <div class="modal-actions">
          <button class="primary-btn full" type="button" id="recurringSubmit">บันทึก</button>
        </div>
      </div>
    `);

    // ค่าตั้งต้นคือวันนี้ตามเวลาไทย ไม่ใช่เวลาเครื่องผู้ใช้
    const startInput = document.getElementById('recurringStart');
    if (startInput) startInput.value = dateKeyOf(new Date());

    let selectedType = 'expense';
    document.querySelectorAll('[data-recurring-type]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedType = button.dataset.recurringType;
        document.querySelectorAll('[data-recurring-type]').forEach((other) => {
          other.classList.toggle('active', other === button);
        });
      });
    });

    const submitBtn = document.getElementById('recurringSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const errorBox = document.getElementById('recurringError');
        const showError = (message) => {
          if (!errorBox) return;
          errorBox.textContent = message;
          errorBox.hidden = false;
        };
        const label = (document.getElementById('recurringLabel').value || '').trim();
        const amountSatang = bahtToSatang(document.getElementById('recurringAmount').value);
        const frequency = document.getElementById('recurringFrequency').value || 'monthly';
        const startDate = document.getElementById('recurringStart').value || undefined;

        if (!label) return showError('ใส่ชื่อรายการก่อน');
        if (amountSatang === null || amountSatang <= 0) return showError('ใส่จำนวนเงินเป็นตัวเลขมากกว่า 0');

        submitBtn.disabled = true;
        if (errorBox) errorBox.hidden = true;
        try {
          await api.createRecurring({ label, type: selectedType, amountSatang, frequency, startDate });
          closeModal();
          await refreshRecurring();
          showSuccessModal('เพิ่มรายการประจำแล้ว');
        } catch (err) {
          submitBtn.disabled = false;
          showError((err && err.message) || 'บันทึกไม่สำเร็จ');
        }
      });
    }
  }

  function installRecurringHandlers() {
    // ส่วนนี้ซ่อนไว้ใน HTML เพราะโหมดตัวอย่าง (ไม่มี backend) กดแล้วจะไม่เกิดอะไรขึ้น
    // ใครเป็นคนเปิด: refreshRecurring() หลังรู้แล้วว่า backend รองรับ endpoint นี้จริง
    const addBtn = document.getElementById('createRecurringBtn');
    if (addBtn) addBtn.addEventListener('click', openRecurringModal);

    document.addEventListener('click', async (event) => {
      const deleteBtn = event.target.closest('[data-recurring-delete]');
      if (!deleteBtn) return;
      deleteBtn.disabled = true;
      try {
        await api.deleteRecurring(deleteBtn.dataset.recurringDelete);
        await refreshRecurring();
      } catch (err) {
        deleteBtn.disabled = false;
        showAlertModal((err && err.message) || 'ลบไม่สำเร็จ', 'ลบรายการประจำไม่สำเร็จ');
      }
    });
  }

  // ---------- ปุ่มที่ยังไม่มี endpoint รองรับ ----------
  // เดิมปล่อยให้กดได้แล้วค่อยขึ้นข้อความปฏิเสธ ซึ่งน่าหงุดหงิดกว่าไม่ต้องแสดงตั้งแต่แรก
  // ตอนนี้ซ่อนทิ้งไปเลยเมื่อต่อ API แล้ว (โหมดตัวอย่างยังโชว์ครบเพื่อใช้สาธิตดีไซน์)
  const UNSUPPORTED_SELECTORS = [
    '#addCategoryBtn',
    '#toggleCategorySortBtn',
    '[data-category-delete]',
    '[data-toggle-essential]',
    '[data-plan-edit]',
    '[data-plan-history]',
    '#emergencyToggle',
  ];

  /** ซ่อนของที่ยังใช้ไม่ได้ เรียกซ้ำได้ทุกครั้งที่หน้าถูกวาดใหม่ */
  function hideUnsupported() {
    if (previewMode) return;
    document.querySelectorAll(UNSUPPORTED_SELECTORS.join(', ')).forEach((el) => {
      // สวิตช์ "หมวดจำเป็น" อยู่ในแถวที่มีข้อความอธิบาย ต้องซ่อนทั้งแถวไม่ให้เหลือข้อความลอยๆ
      const row = el.closest('.setting-item, .an-action, .settings-row');
      (row || el).hidden = true;
    });
  }

  // DOM ของหลายจุดถูกสร้างใหม่ตลอด (เมนู ⋮, รายการหมวด) เลยต้องคอยซ่อนซ้ำหลังทุกการวาด
  const unsupportedObserver = new MutationObserver(() => hideUnsupported());


  // ---------- เริ่มทำงาน ----------

  async function start() {
    // ?preview=1 = ผู้ใช้กด "ดูตัวอย่างหน้าจอก่อน" จากหน้าล็อกอิน — ข้ามการเรียก API ไปเลย
    // ใช้ทางเดียวกับตอนไม่มี backend (404) ซึ่งทำงานอยู่แล้ว
    if (new URLSearchParams(window.location.search).get('preview') === '1') {
      enterPreviewMode();
      return;
    }

    let me;
    try {
      me = await api.fetchMe();
    } catch (err) {
      const status = err && err.status;
      if (status === 401) {
        // มี backend แต่ยังไม่ได้เข้าสู่ระบบ
        showLogin();
      } else if (status === 404) {
        // ไม่มี /api/* ให้เรียกเลย = เปิดจากเซิร์ฟเวอร์ไฟล์ธรรมดาตอนทำดีไซน์
        enterPreviewMode();
      } else if (status === undefined) {
        // fetch ล้มโดยไม่มี status = เน็ตหลุด/เซิร์ฟเวอร์ล่ม
        // 🔴 ห้ามตกไปโหมดตัวอย่างเด็ดขาด ผู้ใช้จริงจะเห็นยอดเงินสมมติของคนอื่นแทนของตัวเอง
        showOffline();
      } else {
        showError((err && err.message) || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      }
      return;
    }

    applyProfile(me);
    installPlanCapacity();
    hideUnsupported();
    unsupportedObserver.observe(document.body, { childList: true, subtree: true });

    if (!WIRED_PAGES.has(document.body.dataset.page)) {
      showSampleBanner();
      return;
    }

    try {
      if (document.body.dataset.page === 'settings') {
        // หน้าตั้งค่าต้องโหลดข้อมูลรวมด้วย เพราะเพดานโหมด "ระบบคำนวณ" ใช้ยอดคงเหลือ/รายการของเดือนนี้
        await Promise.all([loadAll(), loadSettings()]);
        renderSpendingLimitSettings();
        installRecurringHandlers();
        await refreshRecurring();
      } else {
        await refresh();
      }
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
