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
    showPreviewBanner();
  }

  function showPreviewBanner() {
    const main = document.querySelector('.page-content');
    if (!main) return;
    const banner = document.createElement('div');
    banner.className = 'an-sim-verdict warn';
    banner.style.marginBottom = 'var(--space-3)';
    banner.innerHTML = 'กำลังดูตัวอย่างหน้าตาเว็บ ยังไม่ได้ต่อกับเซิร์ฟเวอร์ ตัวเลขทั้งหมดเป็นข้อมูลสมมติ'
      + '<br><small style="font-weight:400">ถ้าต้องการข้อมูลจริง ให้รัน <code>npm run dev</code> แล้วเปิดที่ localhost:3000</small>';
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

  // ---------- โหลดข้อมูลรวม (ใช้ร่วมกันทุกหน้า) ----------

  /** ข้อมูลที่ API ยังไม่มีให้ — หน้าเว็บต้องแสดงว่า "ยังไม่มีข้อมูล" ไม่ใช่โชว์ ฿0 */
  const UNAVAILABLE = new Set();

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

    // API ยังไม่มีตัวเลขพวกนี้ให้ (ดู docs/UI_CONTRACT.md — ห้ามเดา)
    UNAVAILABLE.clear();
    UNAVAILABLE.add('forecastBalance');
    UNAVAILABLE.add('daysOfData');

    Object.assign(window.mockData, {
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

    const rotate = document.getElementById('rotateTokenBtn');
    if (rotate) {
      rotate.addEventListener('click', async () => {
        rotate.disabled = true;
        try {
          const result = await api.rotateEmailToken();
          if (emailEl && result.address) emailEl.textContent = result.address;
          showSuccessModal('สร้างที่อยู่อีเมลใหม่แล้ว');
        } catch (err) {
          showSuccessModal(`สร้างใหม่ไม่สำเร็จ: ${err.message}`);
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
      showSuccessModal(`ไม่สำเร็จ: ${(err && err.message) || 'เกิดข้อผิดพลาด'}`);
      return null;
    }
  }

  /** ให้ผู้ใช้เลือก 1 ใน 3 ทางเลือกที่ backend คำนวณมา แล้วยืนยัน (S5.3) */
  function showPlanOptions(result) {
    const options = result.options || [];
    if (!options.length) {
      showSuccessModal(result.requestedMonthsNote || 'ตอนนี้ยังออมไม่ไหว ลองลดเป้าหมายหรือยืดเวลาออกไป');
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
    deleteTransaction: (id) => runWrite(() => api.deleteTransaction(id), 'ลบรายการแล้ว'),
    setBudget: (categoryId, limitSatang) => runWrite(() => api.saveBudget(categoryId, limitSatang), 'ตั้งงบสำเร็จ'),
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
        showSuccessModal(`สร้างแผนไม่สำเร็จ: ${(err && err.message) || 'เกิดข้อผิดพลาด'}`);
      }
    },
  };

  // ---------- ปุ่มที่ยังไม่มี endpoint รองรับ ----------
  // ดักไว้ตั้งแต่ชั้น capture ไม่ให้ handler ของ app.js ทำงาน เพราะมันจะแก้แค่ข้อมูลในเครื่อง
  // แล้วผู้ใช้จะเข้าใจผิดว่าบันทึกแล้ว พอรีเฟรชก็หายไปเฉยๆ
  const UNSUPPORTED = [
    ['#addCategoryBtn', 'ยังเพิ่มหมวดหมู่จากหน้าเว็บไม่ได้ — หมวดใหม่จะถูกสร้างให้เองเมื่อพิมพ์ชื่อหมวดตอนเพิ่มรายการ'],
    ['[data-category-delete]', 'ยังลบหมวดหมู่จากหน้าเว็บไม่ได้ (ยังไม่มี API)'],
    ['#toggleCategorySortBtn', 'ยังจัดเรียงหมวดหมู่ไม่ได้ (ยังไม่มี API)'],
    ['[data-toggle-essential]', 'ยังเปลี่ยน "หมวดจำเป็น" จากหน้าเว็บไม่ได้ (ยังไม่มี API)'],
    ['[data-plan-edit]', 'ยังแก้ไขแผนไม่ได้ — ยกเลิกแล้วสร้างใหม่แทนได้'],
    ['[data-plan-history]', 'ยังดูประวัติการโอนเข้าแผนไม่ได้ (ยังไม่มี API)'],
    ['#emergencyToggle', 'ยังตั้งกองทุนฉุกเฉินไม่ได้ (ยังไม่มีฟิลด์นี้ใน API)'],
  ];

  document.addEventListener('click', (event) => {
    // โหมดตัวอย่างไม่ต้องดัก ปล่อยให้ app.js สาธิตด้วยข้อมูลสมมติได้ตามปกติ
    if (previewMode) return;
    for (const [selector, message] of UNSUPPORTED) {
      if (event.target.closest(selector)) {
        event.stopPropagation();
        event.preventDefault();
        closeModal();
        showSuccessModal(message);
        return;
      }
    }
  }, true);

  // ---------- เริ่มทำงาน ----------

  async function start() {
    let me;
    try {
      me = await api.fetchMe();
    } catch (err) {
      const status = err && err.status;
      if (status === 401) {
        // มี backend แต่ยังไม่ได้เข้าสู่ระบบ
        showLogin();
      } else if (status === undefined || status === 404) {
        // ไม่มี backend ให้เรียกเลย (เปิดจากเซิร์ฟเวอร์ไฟล์ธรรมดา หรือเน็ตหลุด)
        // ปล่อยให้ app.js แสดงข้อมูลตัวอย่างที่วาดไว้แล้วต่อไป แค่ติดป้ายบอก
        enterPreviewMode();
      } else {
        showError((err && err.message) || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
      }
      return;
    }

    applyProfile(me);

    if (!WIRED_PAGES.has(document.body.dataset.page)) {
      showSampleBanner();
      return;
    }

    try {
      if (document.body.dataset.page === 'settings') await loadSettings();
      else await refresh();
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
