import { Router } from 'express';

import { createTransaction, getMonthlySummary, getSummary, getTopCategories, listTransactions } from '../services/transactions.js';

const router = Router();

router.get('/transactions', (req, res) => {
  const userId = String(req.query.userId ?? 'demo-user');
  res.json(listTransactions(userId));
});

router.get('/transactions/summary', (req, res) => {
  const userId = String(req.query.userId ?? 'demo-user');
  res.json({
    ...getSummary(userId),
    topCategories: getTopCategories(userId),
  });
});

router.get('/transactions/summary/monthly', (req, res) => {
  const userId = String(req.query.userId ?? 'demo-user');
  res.json(getMonthlySummary(userId));
});

router.post('/transactions', (req, res) => {
  const { userId, type, amount, label, category, parsedBy } = req.body ?? {};

  if (!userId || !type || !amount || !label) {
    return res.status(400).json({
      error: 'userId, type, amount, and label are required',
    });
  }

  try {
    const tx = createTransaction({
      userId,
      type,
      amount,
      label,
      category,
      parsedBy,
    });

    return res.status(201).json(tx);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid transaction';
    return res.status(400).json({ error: message });
  }
});

export default router;
