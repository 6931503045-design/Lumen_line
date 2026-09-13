import { Router } from 'express';

import { listCategories, upsertCategory } from '../services/categories.js';

const router = Router();

router.get('/categories', (req, res) => {
  const userId = String(req.query.userId ?? 'demo-user');
  res.json(listCategories(userId));
});

router.post('/categories', (req, res) => {
  const { userId, name, monthlyBudgetSatang, isRequired } = req.body ?? {};

  if (!userId || !name || typeof monthlyBudgetSatang !== 'number') {
    return res.status(400).json({ error: 'userId, name, and monthlyBudgetSatang are required' });
  }

  const category = upsertCategory(userId, name, monthlyBudgetSatang, Boolean(isRequired));
  return res.status(201).json(category);
});

export default router;
