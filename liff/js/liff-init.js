// ไฟล์นี้ทำหน้าที่อะไร: เริ่มต้น LIFF, ขอ ID token, ดึงข้อมูลจริงจาก backend แล้ววาดหน้าใหม่
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G6
//
// ต้องโหลด "หลัง" app.js เสมอ เพราะไฟล์นี้เรียก initializePage() ที่ app.js ประกาศไว้
//
// วิธีทำงาน: app.js อ่าน window.mockData ตอนไฟล์ถูก parse แล้วเก็บ "reference" ไว้ในตัวแปร mock
// ไฟล์นี้จึงต้องแก้ค่าข้างใน object เดิม (mutate) ห้าม reassign window.mockData เป็น object ใหม่
// ไม่งั้น app.js จะยังชี้ไปที่ก้อนเก่าอยู่
//
// ⚠️ ความซื่อสัตย์ของตัวเลข: เมื่อสลับมาใช้ข้อมูลจริง ค่าที่ backend ยังคำนวณไม่ได้
// (safeToSpend, ความมั่นใจ, แผนออม, งบรายเดือน) จะถูกตั้งเป็น null ไม่ใช่ปล่อยเลขจำลองค้างไว้
// เพราะหน้าจอที่ผสมเลขจริงกับเลขปลอมอันตรายกว่าหน้าจอที่บอกว่า "ยังไม่มีข้อมูล"

(function () {
  const config = window.JODTANG_CONFIG || {};

  // ── แถบบอกสถานะ ────────────────────────────────────────────────────────────
  function showBanner(text, tone) {
    let banner = document.getElementById('dataModeBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'dataModeBanner';
      banner.className = 'data-mode-banner';
      document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.dataset.tone = tone;
    banner.textContent = text;
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
   * ชื่อผู้ใช้ใน HTML เป็นชื่อสมมติที่ hardcode ไว้ตอนทำดีไซน์ ("อเล็กซานเดอร์ ซิมส์")
   * พอสลับมาใช้ข้อมูลจริงต้องเปลี่ยนเป็นชื่อจริง ไม่งั้นผู้ใช้จะเห็นเงินตัวเองใต้ชื่อคนอื่น
   * ชื่อมาจาก liff.getProfile() ไม่ใช่จาก DB เพราะ users.display_name ยังไม่มีใครเขียนค่าลงไป
   */
  async function applyProfile() {
    try {
      const profile = await liff.getProfile();
      // index.html ใช้ .profile-meta h1 ส่วน settings.html ใช้ .profile-row h3
      const nameEl = document.querySelector('.profile-meta h1, .profile-row h3');
      const avatarEl = document.querySelector('.profile-meta .avatar, .profile-row .avatar');

      if (nameEl && profile.displayName) nameEl.textContent = profile.displayName;
      if (avatarEl) {
        if (profile.pictureUrl) {
          avatarEl.textContent = '';
          avatarEl.style.backgroundImage = `url("${profile.pictureUrl}")`;
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
        } else if (profile.displayName) {
          avatarEl.textContent = profile.displayName.trim().charAt(0).toUpperCase();
        }
      }
    } catch (err) {
      // ไม่ได้ profile ไม่ใช่เรื่องคอขาดบาดตาย แต่ห้ามปล่อยชื่อสมมติค้างไว้
      console.warn('[liff-init] ดึง profile ไม่สำเร็จ', err);
      const nameEl = document.querySelector('.profile-meta h1, .profile-row h3');
      const avatarEl = document.querySelector('.profile-meta .avatar, .profile-row .avatar');
      if (nameEl) nameEl.textContent = 'บัญชีของคุณ';
      if (avatarEl) avatarEl.textContent = '👤';
    }
  }

  function applyLiveData(summary, transactions, categories) {
    const data = window.mockData;
    const todayKey = bangkokDate.format(new Date());

    // ยอดที่ backend คำนวณจริงได้
    data.summary.balance = summary.netBalanceSatang;
    data.summary.income = summary.monthIncomeSatang;
    data.summary.expense = summary.monthExpenseSatang;

    // ยอดที่ยังไม่มี service คำนวณ — ตั้ง null ให้หน้าเว็บแสดง "ยังไม่มีข้อมูล"
    data.summary.safeToSpend = null;
    data.summary.confidence = null;
    data.summary.safeToSpendConfidence = null;
    data.summary.progress = null;
    data.summary.daysOfData = null;
    data.summary.monthlyBudgetLimit = null;
    data.summary.monthlyBudgetUsed = null;

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
    data.categories = categories.map((category, index) => ({
      id: category.id,
      name: category.name,
      icon: category.emoji || '📦',
      used: spentByName.get(category.name) || 0,
      limit: null,        // ต้องมี budgets ก่อน
      percentage: null,   // คำนวณไม่ได้ถ้าไม่มี limit
      type: category.type,
      isEssential: category.isEssential,
      sortOrder: index + 1,
    }));

    data.plans = []; // plan.service ยังไม่มี — ไม่มีแผนจริงให้แสดง

    data.donutData = buildDonut(summary.expenseByCategory);
    data.lineData = {
      labels: summary.monthlyTrend.map((point) => point.label),
      // กราฟแสดงเป็น "บาท" ให้แกนอ่านง่าย ส่วนข้อมูลต้นทางเป็นสตางค์
      income: summary.monthlyTrend.map((point) => point.incomeSatang / 100),
      expense: summary.monthlyTrend.map((point) => point.expenseSatang / 100),
    };
  }

  // ── ลำดับการเริ่มต้น ────────────────────────────────────────────────────────
  async function start() {
    if (!config.liffId) {
      showBanner('โหมดตัวอย่าง — ยังไม่ได้ตั้ง liffId ใน js/config.js ข้อมูลทั้งหมดเป็นข้อมูลจำลอง', 'mock');
      return;
    }
    if (typeof liff === 'undefined') {
      showBanner('โหลด LIFF SDK ไม่สำเร็จ — แสดงข้อมูลจำลองแทน', 'error');
      return;
    }

    try {
      await liff.init({ liffId: config.liffId });

      if (!liff.isLoggedIn()) {
        liff.login();
        return; // หน้าจะ redirect ออกไป ไม่ต้องทำอะไรต่อ
      }

      const idToken = liff.getIDToken();
      if (!idToken) {
        showBanner('ไม่ได้รับ ID token จาก LINE — ลองเปิดใหม่จากในแอป LINE', 'error');
        return;
      }

      const [summary, transactions, categories] = await Promise.all([
        window.moneyBotApi.fetchSummary(idToken),
        window.moneyBotApi.fetchTransactions(idToken),
        window.moneyBotApi.fetchCategories(idToken),
      ]);

      await applyProfile();
      applyLiveData(summary, transactions, categories);
      initializePage();

      if (window.mockData.transactions.length === 0) {
        showBanner('ยังไม่มีรายการ — ลองพิมพ์ "กาแฟ 80" คุยกับบอทใน LINE ดูก่อน', 'empty');
      } else {
        showBanner('', 'live');
        document.getElementById('dataModeBanner').remove();
      }
    } catch (err) {
      console.error('[liff-init] โหลดข้อมูลจริงไม่สำเร็จ', err);
      const status = err && err.status;
      if (status === 403) {
        showBanner('ยังไม่ได้แอดเพื่อนบอทใน LINE — แอดก่อนแล้วเปิดหน้านี้ใหม่', 'error');
      } else if (status === 401) {
        showBanner('เซสชันหมดอายุ — ปิดแล้วเปิดหน้านี้ใหม่จากในแอป LINE', 'error');
      } else {
        showBanner(`โหลดข้อมูลจริงไม่สำเร็จ (${(err && err.message) || 'ไม่ทราบสาเหตุ'}) — กำลังแสดงข้อมูลจำลอง`, 'error');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
