// ไฟล์นี้ทำหน้าที่อะไร: เช็คสถานะล็อกอิน ดึงข้อมูลจริง แล้ววาดหน้าใหม่
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G6
//
// ไฟล์นี้มาแทน js/liff-init.js เดิม — เลิกใช้ LIFF SDK แล้ว
// เดิม: liff.init() -> liff.getIDToken() -> แนบ token ทุก request
// ตอนนี้: เช็ค /api/me ถ้ายังไม่ล็อกอินก็โชว์ปุ่มเข้าสู่ระบบที่พาไป /auth/login
//         พอล็อกอินแล้ว cookie จะถูกแนบไปเองทุก request
//
// ต้องโหลด "หลัง" app.js เสมอ เพราะเรียก initializePage() ที่ app.js ประกาศไว้
//
// วิธีทำงาน: app.js อ่าน window.mockData ตอนไฟล์ถูก parse แล้วเก็บ reference ไว้
// ไฟล์นี้จึงต้องแก้ค่าข้างใน object เดิม (mutate) ห้าม reassign window.mockData เป็นก้อนใหม่
//
// ⚠️ ความซื่อสัตย์ของตัวเลข: ค่าที่ backend ยังคำนวณไม่ได้ (safeToSpend, ความมั่นใจ,
// แผนออม) ถูกตั้งเป็น null ไม่ใช่ปล่อยเลขจำลองค้างไว้ เพราะหน้าจอที่ผสม
// เลขจริงกับเลขปลอมอันตรายกว่าหน้าจอที่บอกว่า "ยังไม่มีข้อมูล"
//
// งบรายหมวดใช้ข้อมูลจริงแล้ว (budget.service ฝั่ง backend) — แต่ยังคง null ไว้เหมือนเดิม
// ในกรณีที่ผู้ใช้ยังไม่เคยตั้งงบสักหมวด เพราะ "ยังไม่ได้ตั้งงบ" กับ "งบ ฿0" คนละเรื่องกัน

(function () {
  // ── แถบบอกสถานะ ────────────────────────────────────────────────────────────
  function showBanner(html, tone) {
    let banner = document.getElementById('dataModeBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dataModeBanner';
      banner.className = 'data-mode-banner';
      document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.dataset.tone = tone;
    banner.innerHTML = html;
  }

  function hideBanner() {
    const banner = document.getElementById('dataModeBanner');
    if (banner) banner.remove();
  }

  // ── แปลงข้อมูลจาก API ให้อยู่ในรูปที่ app.js ใช้ ──────────────────────────────
  const bangkokTime = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const bangkokDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  });

  /** ป้ายวันแบบที่คนอ่านเข้าใจ คำนวณจากส่วนต่างของวัน ไม่ใช่จากชั่วโมง */
  function relativeDayLabel(dateKey, todayKey) {
    const days = Math.round((Date.parse(todayKey) - Date.parse(dateKey)) / 86400000);
    if (days <= 0) return 'วันนี้';
    if (days === 1) return 'เมื่อวาน';
    if (days < 7) return `${days} วันก่อน`;
    if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
    return dateKey;
  }

  const bangkokMonthYear = new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', month: 'short', year: 'numeric',
  });

  /** "2027-06-14" -> "มิ.ย. 2570" — ใช้กับป้ายกำหนดถึงเป้าบนการ์ดแผน */
  function formatThaiMonthYear(isoDate) {
    // เติมเวลาเที่ยงวัน UTC กันวันเลื่อนตอนแปลงเป็นเวลาไทย
    return bangkokMonthYear.format(new Date(`${isoDate}T12:00:00Z`));
  }

  const DONUT_COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#f3e8ff'];

  /** รวมหมวดที่เหลือเป็น "อื่น ๆ" ให้โดนัทไม่มีชิ้นเล็กจนอ่านไม่ออก */
  function buildDonut(expenseByCategory) {
    const total = expenseByCategory.reduce((sum, item) => sum + item.amountSatang, 0);
    if (total <= 0) return { labels: [], values: [], colors: [] };

    const top = expenseByCategory.slice(0, 4);
    const restSatang = expenseByCategory.slice(4).reduce((sum, item) => sum + item.amountSatang, 0);
    const slices = restSatang > 0
      ? [...top, { name: 'อื่น ๆ', amountSatang: restSatang }]
      : top;

    return {
      labels: slices.map((slice) => slice.name),
      values: slices.map((slice) => Math.round((slice.amountSatang / total) * 100)),
      colors: slices.map((_, index) => DONUT_COLORS[index % DONUT_COLORS.length]),
    };
  }

  /**
   * ชื่อกับรูปใน HTML เป็นค่าสมมติที่ hardcode ไว้ตอนทำดีไซน์
   * พอสลับมาใช้ข้อมูลจริงต้องเปลี่ยน ไม่งั้นผู้ใช้จะเห็นเงินตัวเองใต้ชื่อคนอื่น
   * ข้อมูลมาจาก id_token ตอนล็อกอิน (เก็บไว้ใน session) ไม่ใช่จาก DB
   * เพราะ users.display_name ยังไม่มีใครเขียนค่าลงไป
   */
  function applyProfile(me) {
    // index.html ใช้ .profile-meta h1 ส่วน settings.html ใช้ .profile-row h3
    const nameEl = document.querySelector('.profile-meta h1, .profile-row h3');
    const avatarEl = document.querySelector('.profile-meta .avatar, .profile-row .avatar');

    if (nameEl) nameEl.textContent = me.displayName || 'บัญชีของคุณ';

    if (avatarEl) {
      if (me.pictureUrl) {
        avatarEl.textContent = '';
        avatarEl.style.backgroundImage = `url("${me.pictureUrl}")`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
      } else {
        avatarEl.textContent = me.displayName ? me.displayName.trim().charAt(0).toUpperCase() : '👤';
      }
    }
  }

  function applyLiveData(summary, transactions, categories, budgets, plans) {
    const data = window.mockData;
    const todayKey = bangkokDate.format(new Date());

    // ยอดที่ backend คำนวณจริงได้
    data.summary.balance = summary.netBalanceSatang;
    data.summary.income = summary.monthIncomeSatang;
    data.summary.expense = summary.monthExpenseSatang;

    // ยอดที่ยังไม่มี service คำนวณ — ตั้ง null ให้หน้าเว็บแสดง "ยังไม่มีข้อมูล"
    // safeToSpend (S5.2) ยังไม่มี service คำนวณ — คง null ไว้ให้หน้าเว็บบอกว่ายังไม่มีข้อมูล
    data.summary.safeToSpend = null;
    data.summary.safeToSpendConfidence = null;
    // สามค่านี้เติมจริงด้านล่างหลังโหลดแผนแล้ว ตั้ง null ไว้ก่อนเผื่อไม่มีแผนเลย
    data.summary.confidence = null;
    data.summary.progress = null;
    data.summary.daysOfData = null;

    // งบรายเดือน: มีจริงแล้วตั้งแต่ budget.service — แต่ถ้าผู้ใช้ยังไม่เคยตั้งงบสักหมวด
    // ต้องคง null ไว้ให้การ์ดขึ้นว่า "ยังไม่ได้ตั้งงบประมาณ" ไม่ใช่ ฿0.00 ซึ่งอ่านว่า "งบเป็นศูนย์"
    const hasBudget = budgets && budgets.items && budgets.items.length > 0;
    data.summary.monthlyBudgetLimit = hasBudget ? budgets.totalLimitSatang : null;
    data.summary.monthlyBudgetUsed = hasBudget ? budgets.totalSpentSatang : null;

    data.transactions = transactions.map((item) => {
      const occurred = new Date(item.occurredAt);
      const dateKey = bangkokDate.format(occurred);
      return {
        id: item.id,
        title: item.title,
        // app.js คาดว่า amount มีเครื่องหมาย (รายจ่ายติดลบ) ส่วน DB เก็บเลขบวกเสมอตาม G3
        amount: item.type === 'expense' ? -item.amountSatang : item.amountSatang,
        type: item.type,
        category: item.category || 'ไม่ระบุหมวด',
        time: bangkokTime.format(occurred),
        date: relativeDayLabel(dateKey, todayKey),
        dateKey,
        parsedBy: item.parsedBy || 'manual',
      };
    });

    const spentByName = new Map(summary.expenseByCategory.map((item) => [item.name, item.amountSatang]));
    // งบของหมวดไหนบ้าง — ผูกด้วย categoryId ไม่ใช่ชื่อ เพราะชื่อหมวดซ้ำกันข้ามประเภทได้
    const budgetByCategoryId = new Map(
      ((budgets && budgets.items) || []).map((item) => [item.categoryId, item])
    );

    data.categories = categories.map((category, index) => {
      const budget = budgetByCategoryId.get(category.id);
      return {
        id: category.id,
        name: category.name,
        icon: category.emoji || '📦',
        // ยอดใช้เอาจาก budgets ก่อนถ้ามี เพราะ backend คิดจาก category_id ตรงๆ
        // ส่วน expenseByCategory จับคู่ด้วยชื่อซึ่งพลาดได้ถ้ามีหมวดชื่อซ้ำ
        used: budget ? budget.spentSatang : (spentByName.get(category.name) || 0),
        limit: budget ? budget.limitSatang : null,
        percentage: budget ? budget.percentUsed : null,
        budgetLevel: budget ? budget.level : null,
        type: category.type,
        isEssential: category.isEssential,
        sortOrder: index + 1,
      };
    });

    // แผนออมจริงจาก plan.service — แปลงเป็นรูปที่ app.js ใช้
    // draft ไม่เอามาแสดงในรายการแผน เพราะยังไม่ได้ยืนยัน (S5.4) ปนกันแล้วผู้ใช้จะนับผิด
    data.plans = ((plans && plans.items) || [])
      .filter((plan) => plan.status !== 'draft')
      .map((plan) => ({
        id: plan.planId,
        name: plan.title,
        target: plan.targetSatang,
        saved: plan.savedSatang,
        progress: Math.round(plan.percentComplete),
        confidence: plan.confidence,
        status: plan.status === 'completed' ? 'completed' : plan.offTrack ? 'off_track' : 'normal',
        dueMonth: formatThaiMonthYear(plan.targetDate),
        monthly_save: plan.monthlySaveSatang,
        active: plan.status === 'active',
      }));

    // ความคืบหน้ารวมของแผนที่กำลังออมอยู่ — การ์ดบนแดชบอร์ดใช้ค่านี้
    const activePlans = data.plans.filter((plan) => plan.active);
    const totalTarget = activePlans.reduce((sum, plan) => sum + plan.target, 0);
    const totalSaved = activePlans.reduce((sum, plan) => sum + plan.saved, 0);
    data.summary.progress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : null;

    // ระดับความมั่นใจของการประเมิน (S5.5) — ต้องแสดงบนทุกการ์ดแผนและหน้า "เหลือ"
    if (plans && plans.capacity) {
      data.summary.confidence = plans.capacity.confidence;
      data.summary.daysOfData = plans.capacity.daysOfData;
    }

    data.donutData = buildDonut(summary.expenseByCategory);
    data.lineData = {
      labels: summary.monthlyTrend.map((point) => point.label),
      // กราฟแสดงเป็น "บาท" ให้แกนอ่านง่าย ส่วนข้อมูลต้นทางเป็นสตางค์
      income: summary.monthlyTrend.map((point) => point.incomeSatang / 100),
      expense: summary.monthlyTrend.map((point) => point.expenseSatang / 100),
    };
  }

  /**
   * หน้า settings: แสดงที่อยู่ forward จริงของผู้ใช้ และผูกปุ่มสร้าง token ใหม่กับปุ่มออกจากระบบ
   * ที่อยู่ใน HTML เดิมเป็นค่าสมมติ ("user+ab12cd34@gmail.com") ถ้าปล่อยไว้ผู้ใช้จะเอาไป
   * ตั้ง Gmail filter ผิดที่แล้วอีเมลจะไม่เข้าระบบเลยโดยไม่มีใครรู้ว่าทำไม
   */
  async function setupSettingsPage() {
    const emailEl = document.getElementById('ingestEmail');
    const rotateBtn = document.getElementById('rotateTokenBtn');
    const accountPanel = document.getElementById('accountPanel');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!emailEl && !logoutBtn) return; // ไม่ใช่หน้า settings

    if (accountPanel) accountPanel.hidden = false;
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => window.moneyBotApi.logout());
    }

    if (!emailEl) return;

    try {
      const settings = await window.moneyBotApi.fetchSettings();
      if (settings.emailIngest.available && settings.emailIngest.address) {
        emailEl.textContent = settings.emailIngest.address;
      } else {
        // ยังไม่ได้ตั้ง GMAIL_USER ฝั่งเซิร์ฟเวอร์ = ระบบรับอีเมลยังไม่พร้อม บอกตรงๆ
        emailEl.textContent = 'ระบบรับอีเมลยังไม่เปิดใช้งาน';
        if (rotateBtn) rotateBtn.disabled = true;
      }
    } catch (err) {
      console.error('[boot] โหลดค่าตั้งค่าไม่สำเร็จ', err);
      emailEl.textContent = 'โหลดที่อยู่ไม่สำเร็จ';
      if (rotateBtn) rotateBtn.disabled = true;
      return;
    }

    if (rotateBtn) {
      rotateBtn.addEventListener('click', async () => {
        rotateBtn.disabled = true;
        try {
          const result = await window.moneyBotApi.rotateEmailToken();
          emailEl.textContent = result.address || 'สร้างแล้ว';
          showSuccessModal('สร้าง token ใหม่แล้ว — ที่อยู่เดิมใช้ไม่ได้ทันที');
        } catch (err) {
          console.error('[boot] สร้าง token ใหม่ไม่สำเร็จ', err);
          showSuccessModal('สร้าง token ใหม่ไม่สำเร็จ ลองอีกครั้ง');
        } finally {
          rotateBtn.disabled = false;
        }
      });
    }
  }

  // ── เขียนงบจริง แทนพฤติกรรมเดโมของ app.js ───────────────────────────────────
  //
  // app.js เขียน setCategoryLimit() ไว้สำหรับข้อมูลจำลอง: หา category ด้วย Number(id)
  // แล้วแก้ค่าใน memory เฉยๆ พอต่อของจริง id เป็น uuid ทำให้ Number(id) = NaN หาไม่เจอ
  // และต่อให้หาเจอ ค่าที่ตั้งก็หายทันทีที่รีเฟรช เพราะไม่เคยถูกส่งไป backend
  //
  // จึงทับฟังก์ชันนี้ทั้งตัว (app.js ประกาศเป็น function declaration ระดับ global
  // การ assign ทับที่ window จึงเปลี่ยน binding ที่ตัว handler เรียกใช้จริง)
  function installBudgetWriteHandlers() {
    window.setCategoryLimit = async function setCategoryLimitLive(categoryId) {
      const category = window.mockData.categories.find((item) => String(item.id) === String(categoryId));
      if (!category) return;

      if (category.type !== 'expense') {
        showSuccessModal('ตั้งงบได้เฉพาะหมวดรายจ่ายเท่านั้น');
        return;
      }

      // keypad ทำงานหน่วยสตางค์ (แสดงผลหารร้อย) ค่าที่ได้จึงส่งเข้า API ได้ตรงๆ
      buildKeypadInput(category.limit || 0, async (limitSatang) => {
        if (!limitSatang) {
          // กด 0 = ยกเลิกงบหมวดนี้ ตีความแบบนี้เพราะ backend ไม่รับงบ 0 บาทอยู่แล้ว
          await removeBudgetLive(category);
          return;
        }

        try {
          const status = await window.moneyBotApi.saveBudget(category.id, limitSatang);
          category.limit = status.limitSatang;
          category.used = status.spentSatang;
          category.percentage = status.percentUsed;
          category.budgetLevel = status.level;
          await refreshBudgetTotals();
          showSuccessModal('ตั้งงบรายหมวดสำเร็จ');
        } catch (err) {
          console.error('[boot] ตั้งงบไม่สำเร็จ', err);
          showSuccessModal(`ตั้งงบไม่สำเร็จ: ${(err && err.message) || 'ไม่ทราบสาเหตุ'}`);
        }
      });
    };
  }

  async function removeBudgetLive(category) {
    try {
      await window.moneyBotApi.deleteBudget(category.id);
      category.limit = null;
      category.percentage = null;
      category.budgetLevel = null;
      await refreshBudgetTotals();
      showSuccessModal('ยกเลิกงบหมวดนี้แล้ว');
    } catch (err) {
      console.error('[boot] ยกเลิกงบไม่สำเร็จ', err);
      showSuccessModal(`ยกเลิกงบไม่สำเร็จ: ${(err && err.message) || 'ไม่ทราบสาเหตุ'}`);
    }
  }

  /**
   * อ่านยอดรวมงบใหม่จาก backend แล้ววาดหน้าใหม่
   * ตั้งใจไม่บวกลบยอดรวมเองฝั่งหน้าเว็บ เพราะยอดใช้จริงคำนวณจาก transactions ที่ backend
   * ถ้าหน้าเว็บเดายอดเอง จะเพี้ยนทันทีที่มีรายการเข้ามาทางแชทหรืออีเมลระหว่างนั้น
   */
  async function refreshBudgetTotals() {
    try {
      const budgets = await window.moneyBotApi.fetchBudgets();
      const hasBudget = budgets.items.length > 0;
      window.mockData.summary.monthlyBudgetLimit = hasBudget ? budgets.totalLimitSatang : null;
      window.mockData.summary.monthlyBudgetUsed = hasBudget ? budgets.totalSpentSatang : null;
    } catch (err) {
      console.error('[boot] อ่านยอดงบใหม่ไม่สำเร็จ', err);
    }
    renderDashboard();
    renderCategoriesPage();
  }

  // ── ข้อความจากหน้า callback ของ /auth ───────────────────────────────────────
  function bannerFromLoginResult() {
    const reason = new URLSearchParams(window.location.search).get('login');
    if (reason === 'no-account') {
      return {
        tone: 'error',
        html: 'ล็อกอินสำเร็จ แต่ยังไม่พบบัญชี — ต้องแอดเพื่อนบอทใน LINE ก่อนแล้วเปิดหน้านี้ใหม่',
      };
    }
    if (reason === 'cancelled') {
      return { tone: 'mock', html: 'ยกเลิกการเข้าสู่ระบบ — กำลังแสดงข้อมูลตัวอย่าง' };
    }
    return null;
  }

  const LOGIN_LINK = '<a href="/auth/login">เข้าสู่ระบบด้วย LINE</a>';

  // ── ลำดับการเริ่มต้น ────────────────────────────────────────────────────────
  async function start() {
    const fromCallback = bannerFromLoginResult();

    let me;
    try {
      me = await window.moneyBotApi.fetchMe();
    } catch (err) {
      if (err && err.status === 401) {
        // ยังไม่ล็อกอิน: ไม่เด้งไปหน้า login เองเพื่อไม่ให้วนลูปถ้าล็อกอินไม่ผ่าน
        // ปล่อยให้เห็นหน้าตัวอย่างก่อนแล้วให้ผู้ใช้กดเอง
        showBanner(
          fromCallback ? fromCallback.html : `กำลังแสดงข้อมูลตัวอย่าง — ${LOGIN_LINK} เพื่อดูข้อมูลจริงของคุณ`,
          fromCallback ? fromCallback.tone : 'mock'
        );
        return;
      }
      console.error('[boot] เช็คสถานะล็อกอินไม่สำเร็จ', err);
      showBanner('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — กำลังแสดงข้อมูลตัวอย่าง', 'error');
      return;
    }

    try {
      const [summary, transactions, categories, budgets, plans] = await Promise.all([
        window.moneyBotApi.fetchSummary(),
        window.moneyBotApi.fetchTransactions(),
        window.moneyBotApi.fetchCategories(),
        window.moneyBotApi.fetchBudgets(),
        window.moneyBotApi.fetchPlans(),
      ]);

      applyProfile(me);
      applyLiveData(summary, transactions, categories, budgets, plans);
      installBudgetWriteHandlers();
      initializePage();
      await setupSettingsPage();

      if (window.mockData.transactions.length === 0) {
        showBanner('ยังไม่มีรายการ — ลองพิมพ์ "กาแฟ 80" คุยกับบอทใน LINE ดูก่อน', 'empty');
      } else {
        hideBanner();
      }
    } catch (err) {
      console.error('[boot] โหลดข้อมูลจริงไม่สำเร็จ', err);
      const status = err && err.status;
      if (status === 401) {
        showBanner(`เซสชันหมดอายุ — ${LOGIN_LINK} อีกครั้ง`, 'error');
      } else {
        showBanner(
          `โหลดข้อมูลไม่สำเร็จ (${(err && err.message) || 'ไม่ทราบสาเหตุ'}) — กำลังแสดงข้อมูลตัวอย่าง`,
          'error'
        );
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
