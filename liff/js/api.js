// ไฟล์นี้ทำหน้าที่อะไร: helper สำหรับเรียก backend API จาก LIFF
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W3
// TODO: เพิ่ม fetchSummary, fetchTransactions, saveCategory
// ⚖️ กฎเหล็ก G6

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }
  return response.json();
}

async function fetchSummary() {
  return fetchJson('/api/summary');
}

async function fetchTransactions() {
  return fetchJson('/api/transactions');
}

async function fetchCategories() {
  return fetchJson('/api/categories');
}

window.moneyBotApi = {
  fetchSummary,
  fetchTransactions,
  fetchCategories,
};
