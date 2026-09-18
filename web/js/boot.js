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

  // ── แผนออมของจริง (S5.3–S5.6) ───────────────────────────────────────────────
  //
  // app.js มี wizard สำหรับข้อมูลจำลองอยู่แล้ว แต่มัน "คิดเลขเอง" ในหน้าเว็บ
  // (target * 0.18 ฯลฯ) ซึ่งขัดกับ §S5 ที่กำหนดว่าทุกตัวเลขของแผนต้องมาจาก
  // plan.service ฝั่ง backend เท่านั้น ที่นี่จึงทับ openPlanWizard และ renderPlanCards
  // ทั้งตัว แล้วให้ทุกตัวเลขมาจาก /api/plans
  //
  // ทับได้เพราะ app.js ประกาศทั้งสองเป็น function declaration ระดับ global
  // ตัวที่เรียก (ปุ่ม + renderAnalyzePage) จึงวิ่งมาที่ตัวใหม่นี้

  /** บาทที่ผู้ใช้พิมพ์ -> สตางค์ (integer) — backend รับเฉพาะสตางค์ตามกฎ G3 */
  function bahtToSatang(value) {
    const baht = Number(String(value ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(baht)) return null;
    return Math.round(baht * 100);
  }

  const CONFIDENCE_LABEL = {
    low: '🔴 ประมาณการเบื้องต้น',
    medium: '🟡 ความมั่นใจปานกลาง',
    high: '🟢 ความมั่นใจสูง',
  };

  function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  /** แถบสรุปกำลังออม — แสดงที่มาของตัวเลขด้วย เพื่อให้ผู้ใช้ตรวจสอบได้ว่ามาจากไหน */
  function renderPlanCapacity(capacity) {
    const box = document.getElementById('planCapacity');
    if (!box) return;
    if (!capacity) {
      box.innerHTML = '';
      return;
    }

    const b = capacity.breakdown;
    const note = capacity.canCreatePlan
      ? ''
      : `<p class="empty-note">${escapeHtml(capacity.reason || 'ยังสร้างแผนใหม่ไม่ได้')}</p>`;

    box.innerHTML = `
      <div class="plan-summary-card">
        <div class="summary-row">
          <span>ออมเพิ่มได้เดือนละ</span>
          <strong>${formatMoney(Math.max(0, capacity.capacitySatang))}</strong>
        </div>
        <div class="summary-row">
          <span>ความมั่นใจของการประเมิน</span>
          <strong>${CONFIDENCE_LABEL[capacity.confidence] || '—'}</strong>
        </div>
        <div class="summary-row"><span>รายรับเฉลี่ยต่อเดือน</span><strong>${formatMoney(b.avgIncomeSatang)}</strong></div>
        <div class="summary-row"><span>− รายจ่ายประจำ</span><strong>${formatMoney(b.recurringTotalSatang)}</strong></div>
        <div class="summary-row"><span>− รายจ่ายจำเป็น</span><strong>${formatMoney(b.avgEssentialSatang)}</strong></div>
        <div class="summary-row"><span>− กันเงินฉุกเฉิน</span><strong>${formatMoney(b.emergencyBufferSatang)}</strong></div>
        ${capacity.committedSatang > 0
          ? `<div class="summary-row"><span>− แผนที่ออมอยู่แล้ว ${capacity.activePlanCount} แผน</span><strong>${formatMoney(capacity.committedSatang)}</strong></div>`
          : ''}
        <p class="ai-disclaimer">ใช้ข้อมูลย้อนหลัง ${capacity.daysOfData} วัน</p>
      </div>
      ${note}
    `;
  }

  /** การ์ดแผน — draft ต้องกดยืนยันก่อนถึงจะเริ่มนับ (S5.4) จึงแยกหน้าตาออกจาก active */
  function renderLivePlanCards(plans) {
    const box = document.getElementById('planCards');
    if (!box) return;

    if (!plans.length) {
      box.innerHTML = '<p class="empty-note">ยังไม่มีแผนออม — กด "สร้างแผนใหม่" เพื่อเริ่ม</p>';
      return;
    }

    box.innerHTML = plans.map((plan) => {
      const isDraft = plan.status === 'draft';
      const statusBadge = plan.status === 'completed'
        ? '<span class="pill success">🎉 ครบเป้าแล้ว</span>'
        : isDraft
          ? '<span class="pill">ยังไม่ยืนยัน</span>'
          : plan.offTrack
            ? '<span class="pill warning">⚠️ หลุดเป้า</span>'
            : '<span class="pill success">ปกติ</span>';

      const actions = isDraft
        ? `<button class="primary-btn small" type="button" data-plan-confirm-id="${plan.planId}">ยืนยันแผนนี้</button>
           <button class="secondary-btn small" type="button" data-plan-cancel-id="${plan.planId}">ทิ้ง</button>`
        : plan.status === 'active'
          ? `<button class="primary-btn small" type="button" data-plan-transfer-id="${plan.planId}">โอนเข้าแผนนี้</button>
             <button class="secondary-btn small" type="button" data-plan-cancel-id="${plan.planId}">ยกเลิกแผน</button>`
          : '';

      return `
        <div class="goal-card">
          <div class="goal-header">
            <strong>${escapeHtml(plan.title)}</strong>
            <span class="confidence-badge ${plan.confidence}">${CONFIDENCE_LABEL[plan.confidence] || ''}</span>
          </div>
          <div class="progress-bar ${plan.offTrack ? 'warning' : ''}">
            <span style="width: ${clamp(plan.percentComplete)}%"></span>
          </div>
          <div class="card-row">
            <span>${formatMoney(plan.savedSatang)} / ${formatMoney(plan.targetSatang)}</span>
            <strong>${formatMoney(plan.monthlySaveSatang)}/เดือน</strong>
          </div>
          <div class="card-row">
            <span>ถึงเป้า ${escapeHtml(plan.targetDate)}</span>
            <span>${formatPercent(plan.percentComplete)}%</span>
          </div>
          <div class="plan-actions-row">${statusBadge}${actions}</div>
        </div>
      `;
    }).join('');
  }

  /** โหลดแผน + กำลังออมใหม่จาก backend แล้ววาดใหม่ทั้งส่วน */
  async function refreshPlans() {
    try {
      const plans = await window.moneyBotApi.fetchPlans();
      window.__livePlans = plans;
      renderPlanCapacity(plans.capacity);
      renderLivePlanCards(plans.items || []);
    } catch (err) {
      console.error('[boot] โหลดแผนไม่สำเร็จ', err);
      const box = document.getElementById('planCards');
      if (box) box.innerHTML = `<p class="empty-note">โหลดแผนไม่สำเร็จ: ${escapeHtml((err && err.message) || '')}</p>`;
    }
  }

  /** ขั้นที่ 2 ของ wizard: เลือก 1 ใน 3 ทางเลือกที่ backend คำนวณมาให้ (S5.4) */
  function renderPlanOptions(result) {
    const body = document.getElementById('planWizardBody');
    if (!body) return;

    const note = result.requestedMonthsNote
      ? `<p class="empty-note">⚠️ ${escapeHtml(result.requestedMonthsNote)}</p>`
      : '';

    body.innerHTML = `
      ${note}
      <div class="goal-stack">
        ${result.options.map((option) => `
          <div class="goal-card">
            <div class="goal-header">
              <strong>${escapeHtml(option.title)}</strong>
            </div>
            <div class="summary-row"><span>ออมเดือนละ</span><strong>${formatMoney(option.monthlySaveSatang)}</strong></div>
            <div class="summary-row"><span>ใช้เวลา</span><strong>${option.months} เดือน</strong></div>
            <div class="summary-row"><span>ถึงเป้า</span><strong>${escapeHtml(option.targetDate)}</strong></div>
            <button class="primary-btn full" type="button" data-plan-pick="${option.planId}">เลือกแผนนี้</button>
          </div>
        `).join('')}
      </div>
      <p class="ai-disclaimer">ℹ️ ข้อมูลเชิงวิเคราะห์ ไม่ใช่คำแนะนำทางการเงิน</p>
    `;

    body.querySelectorAll('[data-plan-pick]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await window.moneyBotApi.confirmPlan(button.dataset.planPick);
          closeModal();
          await refreshPlans();
          showSuccessModal('เริ่มแผนออมแล้ว');
        } catch (err) {
          button.disabled = false;
          showSuccessModal(`ยืนยันแผนไม่สำเร็จ: ${(err && err.message) || 'ไม่ทราบสาเหตุ'}`);
        }
      });
    });
  }

  function planWizardForm(capacity) {
    return `
      <p class="empty-note">ออมเพิ่มได้เดือนละ ${formatMoney(Math.max(0, capacity.capacitySatang))} · ${CONFIDENCE_LABEL[capacity.confidence] || ''}</p>
      <div class="form-grid">
        <label class="form-field">
          <span>อยากได้อะไร</span>
          <input id="livePlanTitle" placeholder="เช่น iPhone, ตั๋วเครื่องบิน" />
        </label>
        <label class="form-field">
          <span>ราคา (บาท)</span>
          <input id="livePlanTarget" type="number" min="1" step="0.01" placeholder="30000" />
        </label>
        <label class="form-field">
          <span>อยากได้ภายในกี่เดือน (ไม่ใส่ก็ได้)</span>
          <input id="livePlanMonths" type="number" min="1" step="1" placeholder="เว้นว่างให้ระบบเสนอให้" />
        </label>
      </div>
      <p id="livePlanError" class="empty-note" hidden></p>
      <div class="modal-actions">
        <button class="primary-btn full" type="button" id="livePlanSubmit">ดูทางเลือก</button>
      </div>
    `;
  }

  /** ทับ wizard ของ app.js — ทุกตัวเลขมาจาก /api/plans ไม่ใช่คำนวณในหน้าเว็บ */
  function installLivePlanHandlers() {
    window.openPlanWizard = async function openLivePlanWizard() {
      openModal(`
        <div class="modal-card wide">
          <div class="modal-head">
            <h3>สร้างแผนออม</h3>
            <button class="close-btn" type="button" data-close-modal="true">✕</button>
          </div>
          <div id="planWizardBody"><p class="empty-note">กำลังคำนวณกำลังออม…</p></div>
        </div>
      `);

      let capacity;
      try {
        capacity = await window.moneyBotApi.fetchPlanCapacity();
      } catch (err) {
        const body = document.getElementById('planWizardBody');
        if (body) body.innerHTML = `<p class="empty-note">คำนวณกำลังออมไม่สำเร็จ: ${escapeHtml((err && err.message) || '')}</p>`;
        return;
      }

      const body = document.getElementById('planWizardBody');
      if (!body) return;

      // ออมไม่ไหวตั้งแต่ต้น — บอกเหตุผลเป็นตัวเลขตาม S5.3 ไม่ใช่ให้กรอกฟอร์มไปเปล่าๆ
      if (!capacity.canCreatePlan) {
        body.innerHTML = `
          <p class="empty-note">${escapeHtml(capacity.reason || 'ยังสร้างแผนใหม่ไม่ได้')}</p>
          <div class="modal-actions">
            <button class="secondary-btn full" type="button" data-close-modal="true">เข้าใจแล้ว</button>
          </div>
        `;
        return;
      }

      body.innerHTML = planWizardForm(capacity);

      document.getElementById('livePlanSubmit')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const errorBox = document.getElementById('livePlanError');
        const showError = (message) => {
          if (!errorBox) return;
          errorBox.textContent = message;
          errorBox.hidden = false;
        };

        const title = (document.getElementById('livePlanTitle')?.value || '').trim();
        const targetSatang = bahtToSatang(document.getElementById('livePlanTarget')?.value);
        const monthsRaw = (document.getElementById('livePlanMonths')?.value || '').trim();

        if (!title) return showError('ใส่ชื่อสิ่งที่อยากได้ก่อนนะครับ');
        if (targetSatang === null || targetSatang <= 0) return showError('ใส่ราคาเป็นตัวเลขมากกว่า 0');
        const months = monthsRaw === '' ? undefined : Number(monthsRaw);
        if (months !== undefined && (!Number.isInteger(months) || months <= 0)) {
          return showError('จำนวนเดือนต้องเป็นจำนวนเต็มบวก');
        }

        button.disabled = true;
        if (errorBox) errorBox.hidden = true;
        try {
          const result = await window.moneyBotApi.createPlan(title, targetSatang, months);
          renderPlanOptions(result);
        } catch (err) {
          button.disabled = false;
          showError((err && err.message) || 'สร้างแผนไม่สำเร็จ');
        }
      });
    };

    // renderAnalyzePage ของ app.js เรียกตัวนี้ — ให้วาดจากข้อมูลจริงที่โหลดไว้แล้ว
    window.renderPlanCards = function renderLivePlanCardsEntry() {
      const plans = window.__livePlans;
      if (!plans) return;
      renderPlanCapacity(plans.capacity);
      renderLivePlanCards(plans.items || []);
    };

    // ปุ่มยืนยัน/ยกเลิกในการ์ดแผนถูกสร้างใหม่ทุกครั้งที่วาด จึงดักที่ระดับ document ครั้งเดียว
    document.addEventListener('click', async (event) => {
      const confirmBtn = event.target.closest('[data-plan-confirm-id]');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        try {
          await window.moneyBotApi.confirmPlan(confirmBtn.dataset.planConfirmId);
          await refreshPlans();
          showSuccessModal('เริ่มแผนออมแล้ว');
        } catch (err) {
          confirmBtn.disabled = false;
          showSuccessModal(`ยืนยันไม่สำเร็จ: ${(err && err.message) || 'ไม่ทราบสาเหตุ'}`);
        }
        return;
      }

      // โอนเข้าแผน — ใช้แป้นตัวเลขเดียวกับตอนตั้งงบ (ทำงานหน่วยสตางค์)
      const transferBtn = event.target.closest('[data-plan-transfer-id]');
      if (transferBtn) {
        const planId = transferBtn.dataset.planTransferId;
        const plan = ((window.__livePlans && window.__livePlans.items) || [])
          .find((item) => item.planId === planId);
        // ตั้งค่าเริ่มต้นเป็นยอดออมต่อเดือนของแผน ซึ่งเป็นจำนวนที่ผู้ใช้ตั้งใจโอนอยู่แล้ว
        buildKeypadInput(plan ? plan.monthlySaveSatang : 0, async (amountSatang) => {
          if (!amountSatang) return;
          try {
            const result = await window.moneyBotApi.transferToPlan(planId, amountSatang);
            await refreshPlans();
            showSuccessModal(
              result.justCompleted
                ? '🎉 ครบเป้าแล้ว! ยินดีด้วยครับ'
                : `โอนเข้าแผนแล้ว — ออมไปทั้งหมด ${formatMoney(result.progress.savedSatang)}`
            );
          } catch (err) {
            showSuccessModal(`โอนไม่สำเร็จ: ${(err && err.message) || 'ไม่ทราบสาเหตุ'}`);
          }
        });
        return;
      }

      const cancelBtn = event.target.closest('[data-plan-cancel-id]');
      if (cancelBtn) {
        cancelBtn.disabled = true;
        try {
          await window.moneyBotApi.cancelPlan(cancelBtn.dataset.planCancelId);
          await refreshPlans();
        } catch (err) {
          cancelBtn.disabled = false;
          showSuccessModal(`ยกเลิกไม่สำเร็จ: ${(err && err.message) || 'ไม่ทราบสาเหตุ'}`);
        }
      }
    });
  }

  // ── รายการประจำ (S5.9) ──────────────────────────────────────────────────────

  const FREQUENCY_LABEL = {
    daily: 'ทุกวัน',
    weekly: 'ทุกสัปดาห์',
    monthly: 'ทุกเดือน',
    yearly: 'ทุกปี',
  };

  function renderRecurringList(items) {
    const box = document.getElementById('recurringList');
    if (!box) return;

    if (!items.length) {
      box.innerHTML = '<p class="empty-note">ยังไม่มีรายการประจำ — เพิ่มเงินเดือนกับค่าหอไว้ ระบบจะบันทึกให้เองทุกเดือน</p>';
      return;
    }

    box.innerHTML = items.map((rule) => `
      <div class="setting-item">
        <div>
          <strong>${rule.type === 'income' ? '💰' : '🧾'} ${escapeHtml(rule.label)}</strong>
          <span>${FREQUENCY_LABEL[rule.frequency] || rule.frequency} · ${formatMoney(rule.amountSatang)}
            · รอบถัดไป ${escapeHtml(rule.nextRun)}</span>
        </div>
        <button class="secondary-btn small" type="button" data-recurring-delete="${rule.id}">ลบ</button>
      </div>
    `).join('');
  }

  async function refreshRecurring() {
    const box = document.getElementById('recurringList');
    if (!box) return;
    try {
      const data = await window.moneyBotApi.fetchRecurring();
      renderRecurringList(data.items || []);
    } catch (err) {
      console.error('[boot] โหลดรายการประจำไม่สำเร็จ', err);
      box.innerHTML = `<p class="empty-note">โหลดไม่สำเร็จ: ${escapeHtml((err && err.message) || '')}</p>`;
    }
  }

  function openRecurringModal() {
    openModal(`
      <div class="modal-card small">
        <div class="modal-head">
          <h3>เพิ่มรายการประจำ</h3>
          <button class="close-btn" type="button" data-close-modal="true">✕</button>
        </div>
        <div class="form-grid">
          <label class="form-field">
            <span>ชื่อรายการ</span>
            <input id="recurringLabel" placeholder="เช่น เงินเดือน, ค่าหอ" />
          </label>
          <label class="form-field">
            <span>จำนวนเงิน (บาท)</span>
            <input id="recurringAmount" type="number" min="1" step="0.01" placeholder="3500" />
          </label>
          <div class="segmented-control">
            <button type="button" class="segmented active" data-recurring-type="expense">รายจ่าย</button>
            <button type="button" class="segmented" data-recurring-type="income">รายรับ</button>
          </div>
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
        <p id="recurringError" class="empty-note" hidden></p>
        <div class="modal-actions">
          <button class="primary-btn full" type="button" id="recurringSubmit">บันทึก</button>
        </div>
      </div>
    `);

    // ค่าเริ่มต้นของวันคือวันนี้ตามเวลาไทย ไม่ใช่เวลาเครื่องผู้ใช้
    const startInput = document.getElementById('recurringStart');
    if (startInput) startInput.value = bangkokDate.format(new Date());

    let selectedType = 'expense';
    document.querySelectorAll('[data-recurring-type]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedType = button.dataset.recurringType;
        document.querySelectorAll('[data-recurring-type]').forEach((other) => {
          other.classList.toggle('active', other === button);
        });
      });
    });

    document.getElementById('recurringSubmit')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const errorBox = document.getElementById('recurringError');
      const showError = (message) => {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.hidden = false;
      };

      const label = (document.getElementById('recurringLabel')?.value || '').trim();
      const amountSatang = bahtToSatang(document.getElementById('recurringAmount')?.value);
      const frequency = document.getElementById('recurringFrequency')?.value || 'monthly';
      const startDate = document.getElementById('recurringStart')?.value || undefined;

      if (!label) return showError('ใส่ชื่อรายการก่อนนะครับ');
      if (amountSatang === null || amountSatang <= 0) return showError('ใส่จำนวนเงินเป็นตัวเลขมากกว่า 0');

      button.disabled = true;
      if (errorBox) errorBox.hidden = true;
      try {
        await window.moneyBotApi.createRecurring({
          label, type: selectedType, amountSatang, frequency, startDate,
        });
        closeModal();
        await refreshRecurring();
        showSuccessModal('เพิ่มรายการประจำแล้ว');
      } catch (err) {
        button.disabled = false;
        showError((err && err.message) || 'บันทึกไม่สำเร็จ');
      }
    });
  }

  function installRecurringHandlers() {
    document.getElementById('createRecurringBtn')?.addEventListener('click', openRecurringModal);

    document.addEventListener('click', async (event) => {
      const deleteBtn = event.target.closest('[data-recurring-delete]');
      if (!deleteBtn) return;
      deleteBtn.disabled = true;
      try {
        await window.moneyBotApi.deleteRecurring(deleteBtn.dataset.recurringDelete);
        await refreshRecurring();
      } catch (err) {
        deleteBtn.disabled = false;
        showSuccessModal(`ลบไม่สำเร็จ: ${(err && err.message) || 'ไม่ทราบสาเหตุ'}`);
      }
    });
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

      // เก็บก้อนแผนไว้ให้ renderPlanCards ที่ถูกทับใช้ ต้องตั้งก่อน initializePage()
      // เพราะ renderAnalyzePage จะเรียก renderPlanCards ทันทีที่หน้าถูกวาด
      window.__livePlans = plans;

      installBudgetWriteHandlers();
      installLivePlanHandlers();
      installRecurringHandlers();

      initializePage();
      await setupSettingsPage();
      await refreshRecurring();

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
