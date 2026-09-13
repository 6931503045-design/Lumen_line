import { describe, expect, it } from 'vitest';

import { listCategories, upsertCategory } from './categories.js';
import { createPlan, listPlans } from './plans.js';

describe('budget and plan services', () => {
  it('stores categories and budgets per user', () => {
    const category = upsertCategory('demo-user', 'food', 150000, true);

    expect(category.name).toBe('food');
    expect(category.monthlyBudgetSatang).toBe(150000);
    expect(listCategories('demo-user')[0].name).toBe('food');
  });

  it('creates saving plans', () => {
    const plan = createPlan('demo-user', 'Trip', 500000, 20000, 'draft');

    expect(plan.targetAmountSatang).toBe(500000);
    expect(listPlans('demo-user')[0].name).toBe('Trip');
  });
});
