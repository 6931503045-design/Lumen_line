// ไฟล์นี้ทำหน้าที่อะไร: helper เรียก backend API จากหน้าเว็บ
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W5
// ⚖️ กฎเหล็ก G6
//
// เดิมไฟล์นี้แนบ LIFF ID token ใน Authorization header ทุก request
// ตอนนี้หน้าเว็บกับ API อยู่โดเมนเดียวกัน จึงใช้ session cookie แทน — เบราว์เซอร์แนบให้เอง
// หน้าเว็บไม่เคยเห็น token ใดๆ เลย (cookie เป็น httpOnly) และไม่เคยส่ง user_id เอง

(function () {
  /** error ที่มี status ติดมาด้วย ให้ผู้เรียกแยกได้ว่า 401 (ยังไม่ล็อกอิน) หรืออย่างอื่น */
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  async function request(path, options) {
    const response = await fetch(`/api${path}`, {
      // สำคัญ: ถ้าไม่ใส่ credentials เบราว์เซอร์อาจไม่แนบ cookie ไปด้วย
      credentials: 'same-origin',
      ...options,
    });

    if (!response.ok) {
      let message = `เรียก ${path} ไม่สำเร็จ`;
      try {
        const body = await response.json();
        if (body && body.error) message = body.error;
      } catch (_) {
        // body ไม่ใช่ JSON ก็ใช้ข้อความ default
      }
      throw new ApiError(message, response.status);
    }

    return response.json();
  }

  window.moneyBotApi = {
    ApiError,
    fetchMe: () => request('/me'),
    fetchSummary: () => request('/summary'),
    fetchTransactions: () => request('/transactions?limit=100'),
    fetchCategories: () => request('/categories'),
    createCategory: ({ name, type, emoji, isEssential }) =>
      request('/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, emoji, isEssential }),
      }),
    // patch: ส่งเฉพาะฟิลด์ที่เปลี่ยน — เปลี่ยน type ไม่ได้ (backend ปฏิเสธ)
    updateCategory: (categoryId, patch) =>
      request(`/categories/${encodeURIComponent(categoryId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    deleteCategory: (categoryId) =>
      request(`/categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' }),
    // รายการเงิน: backend รองรับ POST/PATCH/DELETE/restore อยู่แล้ว (ดู docs/UI_CONTRACT.md)
    // body ทุกตัวใช้ amountSatang เป็นจำนวนเต็มสตางค์ และยอดเป็นบวกเสมอ ทิศทางดูจาก type (G3)
    createTransaction: (payload) =>
      request('/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    updateTransaction: (transactionId, patch) =>
      request(`/transactions/${encodeURIComponent(transactionId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    deleteTransaction: (transactionId) =>
      request(`/transactions/${encodeURIComponent(transactionId)}`, { method: 'DELETE' }),
    restoreTransaction: (transactionId) =>
      request(`/transactions/${encodeURIComponent(transactionId)}/restore`, { method: 'POST' }),
    fetchSettings: () => request('/settings'),
    // month = 'YYYY-MM' ถ้าไม่ส่ง backend จะใช้เดือนปัจจุบัน (ดู docs/UI_CONTRACT.md)
    fetchBudgets: (month) =>
      request(month ? `/budgets?month=${encodeURIComponent(month)}` : '/budgets'),
    // limitSatang เป็น "สตางค์" ให้ตรงกับหน่วยที่ทั้งหน้าเว็บใช้ (keypad คืนค่าเป็นสตางค์อยู่แล้ว)
    saveBudget: (categoryId, limitSatang) =>
      request(`/budgets/${encodeURIComponent(categoryId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitSatang }),
      }),
    deleteBudget: (categoryId) =>
      request(`/budgets/${encodeURIComponent(categoryId)}`, { method: 'DELETE' }),
    fetchPlans: () => request('/plans'),
    fetchPlanCapacity: () => request('/plans/capacity'),
    // targetSatang เป็นสตางค์เหมือนทุกค่าเงินในหน้าเว็บ / months ไม่ส่งก็ได้
    createPlan: (title, targetSatang, months) =>
      request('/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, targetSatang, months }),
      }),
    confirmPlan: (planId) =>
      request(`/plans/${encodeURIComponent(planId)}/confirm`, { method: 'POST' }),
    cancelPlan: (planId) => request(`/plans/${encodeURIComponent(planId)}`, { method: 'DELETE' }),
    transferToPlan: (planId, amountSatang) =>
      request(`/plans/${encodeURIComponent(planId)}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSatang }),
      }),
    fetchRecurring: () => request('/recurring'),
    createRecurring: (payload) =>
      request('/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    deleteRecurring: (ruleId) =>
      request(`/recurring/${encodeURIComponent(ruleId)}`, { method: 'DELETE' }),
    rotateEmailToken: () => request('/settings/email-token/rotate', { method: 'POST' }),
    logout: () =>
      fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(() => {
        window.location.href = '/';
      }),
  };
})();
