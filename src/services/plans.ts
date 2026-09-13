import { randomUUID } from 'node:crypto';

export type SavingPlan = {
  id: string;
  userId: string;
  name: string;
  targetAmountSatang: number;
  monthlyAmountSatang: number;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
};

const planStore = new Map<string, SavingPlan[]>();

export function listPlans(userId: string): SavingPlan[] {
  return [...(planStore.get(userId) ?? [])];
}

export function createPlan(
  userId: string,
  name: string,
  targetAmountSatang: number,
  monthlyAmountSatang: number,
  status: SavingPlan['status'] = 'draft',
): SavingPlan {
  const plan: SavingPlan = {
    id: randomUUID(),
    userId,
    name: name.trim(),
    targetAmountSatang: targetAmountSatang,
    monthlyAmountSatang: monthlyAmountSatang,
    status,
    createdAt: new Date().toISOString(),
  };

  const list = planStore.get(userId) ?? [];
  list.push(plan);
  planStore.set(userId, list);
  return plan;
}

export function activatePlan(userId: string, planId: string): SavingPlan | null {
  const list = planStore.get(userId) ?? [];
  const item = list.find((plan) => plan.id === planId);

  if (!item) {
    return null;
  }

  item.status = 'active';
  return item;
}
