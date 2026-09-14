// ไฟล์นี้ทำหน้าที่อะไร: route สำหรับเอกสาร/JSON API ระหว่าง LIFF หรือ external service
// ใครรับผิดชอบ: ④ Frontend / ① Bot Core
// เขียนในสัปดาห์: W3
// TODO: เพิ่ม routes สำหรับ summary, transactions, plans, categories
// ⚖️ กฎเหล็ก G6

import express from 'express';

export const apiRouter = express.Router();

const mockSummary = {
  totalIncomeSatang: 420000,
  totalExpenseSatang: 275000,
  balanceSatang: 145000,
  monthlyGoalSatang: 200000,
  categories: [
    { name: 'อาหาร', amountSatang: 68000, type: 'expense' },
    { name: 'เดินทาง', amountSatang: 54000, type: 'expense' },
    { name: 'เงินเดือน', amountSatang: 420000, type: 'income' },
    { name: 'ออม', amountSatang: 150000, type: 'transfer' },
  ],
};

const mockTransactions = [
  { id: 't1', title: 'ค่าอาหาร', amountSatang: 35000, type: 'expense', category: 'อาหาร', occurredAt: '2026-09-13T08:15:00+07:00' },
  { id: 't2', title: 'เงินเดือน', amountSatang: 420000, type: 'income', category: 'เงินเดือน', occurredAt: '2026-09-01T09:00:00+07:00' },
  { id: 't3', title: 'ค่ารถ', amountSatang: 22000, type: 'expense', category: 'เดินทาง', occurredAt: '2026-09-10T17:30:00+07:00' },
  { id: 't4', title: 'โอนเข้ากองทุน', amountSatang: 15000, type: 'transfer', category: 'ออม', occurredAt: '2026-09-11T07:00:00+07:00' },
  { id: 't5', title: 'กาแฟ', amountSatang: 12000, type: 'expense', category: 'อาหาร', occurredAt: '2026-09-12T10:45:00+07:00' },
];

const mockPlans = [
  { id: 'p1', title: 'ซื้อ laptop', targetSatang: 5000000, savedSatang: 1500000, status: 'active' },
  { id: 'p2', title: 'ทุนการศึกษา', targetSatang: 1800000, savedSatang: 800000, status: 'draft' },
];

apiRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, message: 'API scaffold ready' });
});

apiRouter.get('/summary', (_req, res) => {
  res.json(mockSummary);
});

apiRouter.get('/transactions', (_req, res) => {
  res.json(mockTransactions);
});

apiRouter.get('/plans', (_req, res) => {
  res.json(mockPlans);
});

apiRouter.get('/categories', (_req, res) => {
  res.json([
    { name: 'อาหาร', type: 'expense' },
    { name: 'เดินทาง', type: 'expense' },
    { name: 'เงินเดือน', type: 'income' },
    { name: 'ออม', type: 'transfer' },
  ]);
});
