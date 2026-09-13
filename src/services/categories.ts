import { randomUUID } from 'node:crypto';

export type Category = {
  id: string;
  userId: string;
  name: string;
  monthlyBudgetSatang: number;
  isRequired: boolean;
  createdAt: string;
};

const categoryStore = new Map<string, Category[]>();

export function listCategories(userId: string): Category[] {
  return [...(categoryStore.get(userId) ?? [])];
}

export function upsertCategory(
  userId: string,
  name: string,
  monthlyBudgetSatang: number,
  isRequired = false,
): Category {
  const normalizedName = name.trim();
  const existing = (categoryStore.get(userId) ?? []).find((item) => item.name === normalizedName);

  if (existing) {
    existing.monthlyBudgetSatang = monthlyBudgetSatang;
    existing.isRequired = isRequired;
    return existing;
  }

  const category: Category = {
    id: randomUUID(),
    userId,
    name: normalizedName,
    monthlyBudgetSatang,
    isRequired,
    createdAt: new Date().toISOString(),
  };

  const list = categoryStore.get(userId) ?? [];
  list.push(category);
  categoryStore.set(userId, list);
  return category;
}

export function getCategoryByName(userId: string, name: string): Category | undefined {
  return (categoryStore.get(userId) ?? []).find((item) => item.name === name.trim());
}
