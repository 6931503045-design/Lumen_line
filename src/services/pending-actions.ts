import { randomUUID } from 'node:crypto';

export type PendingAction = {
  id: string;
  userId: string;
  actionType: string;
  payload: Record<string, unknown>;
  expiresAt: string;
  createdAt: string;
};

const pendingActions = new Map<string, PendingAction[]>();

export function createPendingAction(userId: string, actionType: string, payload: Record<string, unknown>): PendingAction {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  const action: PendingAction = {
    id: randomUUID(),
    userId,
    actionType,
    payload,
    expiresAt,
    createdAt: now.toISOString(),
  };

  const existing = pendingActions.get(userId) ?? [];
  existing.push(action);
  pendingActions.set(userId, existing);

  return action;
}

export function listPendingActions(userId: string): PendingAction[] {
  return [...(pendingActions.get(userId) ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function clearExpiredPendingActions(userId?: string): void {
  const now = Date.now();

  if (userId) {
    const items = (pendingActions.get(userId) ?? []).filter((item) => new Date(item.expiresAt).getTime() > now);
    pendingActions.set(userId, items);
    return;
  }

  for (const [key, items] of pendingActions.entries()) {
    const filtered = items.filter((item) => new Date(item.expiresAt).getTime() > now);
    if (filtered.length > 0) {
      pendingActions.set(key, filtered);
    } else {
      pendingActions.delete(key);
    }
  }
}

export function confirmPendingAction(userId: string, actionId: string): PendingAction | null {
  const items = pendingActions.get(userId) ?? [];
  const index = items.findIndex((item) => item.id === actionId);

  if (index === -1) {
    return null;
  }

  const [matched] = items.splice(index, 1);
  pendingActions.set(userId, items);
  return matched;
}
