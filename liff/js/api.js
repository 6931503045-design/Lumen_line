// ไฟล์นี้ทำหน้าที่อะไร: helper สำหรับเรียก backend API จาก LIFF พร้อมแนบ ID token
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// ⚖️ กฎเหล็ก G6
//
// 🆕 เดิมไฟล์นี้ fetch('/api/summary') เฉยๆ ไม่แนบอะไรเลย และไม่มีหน้าไหน include มันด้วยซ้ำ
// ตอนนี้ทุก request แนบ LIFF ID token ใน Authorization header — backend เอา token ไปให้ LINE
// ยืนยันแล้วแปลงเป็น user_id เอง หน้าเว็บไม่เคยส่ง user_id ไปเองเลย (นั่นคือหัวใจของ G6)

(function () {
  const config = window.JODTANG_CONFIG || {};
  const baseUrl = (config.apiBaseUrl || '').replace(/\/$/, '');

  /** error ที่มี status ติดมาด้วย เพื่อให้ตัวเรียกแยกได้ว่า 401 (ยังไม่ล็อกอิน) หรือ 403 (ยังไม่แอดบอท) */
  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  }

  async function fetchJson(path, idToken) {
    const response = await fetch(`${baseUrl}/api${path}`, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });

    if (!response.ok) {
      let message = `เรียก ${path} ไม่สำเร็จ`;
      try {
        const body = await response.json();
        if (body && body.error) message = body.error;
      } catch (_) {
        // body ไม่ใช่ JSON ก็ใช้ข้อความ default ไป
      }
      throw new ApiError(message, response.status);
    }

    return response.json();
  }

  window.moneyBotApi = {
    ApiError,
    fetchSummary: (idToken) => fetchJson('/summary', idToken),
    fetchTransactions: (idToken) => fetchJson('/transactions?limit=100', idToken),
    fetchCategories: (idToken) => fetchJson('/categories', idToken),
    fetchPlans: (idToken) => fetchJson('/plans', idToken),
  };
})();
