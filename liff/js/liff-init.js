// ไฟล์นี้ทำหน้าที่อะไร: เริ่มต้น LIFF ฝั่ง client สำหรับเรียก API ภายใน LINE mini app
// ใครรับผิดชอบ: ④ Frontend
// เขียนในสัปดาห์: W2
// TODO: เพิ่ม initLIFF, token validation, fetch summary
// ⚖️ กฎเหล็ก G6

window.dashboard = {
  formatMoney(satang) {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 2,
    }).format(satang / 100);
  },

  async loadDashboard() {
    try {
      const [summary, transactions, categories] = await Promise.all([
        window.moneyBotApi.fetchSummary(),
        window.moneyBotApi.fetchTransactions(),
        window.moneyBotApi.fetchCategories(),
      ]);

      document.getElementById('incomeAmount').textContent = this.formatMoney(summary.totalIncomeSatang);
      document.getElementById('expenseAmount').textContent = this.formatMoney(summary.totalExpenseSatang);
      document.getElementById('balanceAmount').textContent = this.formatMoney(summary.balanceSatang);
      document.getElementById('goalAmount').textContent = this.formatMoney(summary.monthlyGoalSatang);

      const transactionList = document.getElementById('transactionList');
      transactionList.innerHTML = transactions
        .slice(0, 5)
        .map((item) => {
          const sign = item.type === 'income' ? '+' : '-';
          return `
            <li class="transaction-item">
              <div>
                <strong>${item.title}</strong>
                <small>${item.category}</small>
              </div>
              <span class="amount ${item.type}">${sign}${this.formatMoney(item.amountSatang)}</span>
            </li>
          `;
        })
        .join('');

      const categoryList = document.getElementById('categoryList');
      categoryList.innerHTML = categories
        .map((item) => `
          <li class="category-item">
            <span>${item.name}</span>
            <span class="pill ${item.type}">${item.type}</span>
          </li>
        `)
        .join('');
    } catch (error) {
      console.error('Failed to load dashboard', error);
      document.getElementById('transactionList').innerHTML = '<li>ไม่สามารถโหลดข้อมูลได้</li>';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  window.dashboard.loadDashboard();
});
