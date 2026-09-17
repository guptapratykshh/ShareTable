import { randomUUID } from "node:crypto";
import type { ActionKind, PendingActionRecord } from "./types.js";

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, PendingActionRecord>();

function sweep(now = Date.now()) {
  for (const [id, record] of store) {
    if (record.expiresAt <= now && !record.consumed) store.delete(id);
  }
}

export function clearPendingActionsForTests() {
  store.clear();
}

export function createPendingAction(input: {
  userId: string;
  kind: ActionKind;
  claimId?: string;
  donationId?: string;
  delayMinutes?: number;
  instructions?: string;
}) {
  sweep();
  for (const [id, record] of store) {
    if (record.userId === input.userId && !record.consumed) store.delete(id);
  }
  const now = Date.now();
  const record: PendingActionRecord = {
    id: randomUUID(),
    userId: input.userId,
    kind: input.kind,
    claimId: input.claimId,
    donationId: input.donationId,
    delayMinutes: input.delayMinutes,
    instructions: input.instructions,
    createdAt: now,
    expiresAt: now + TTL_MS,
    consumed: false,
  };
  store.set(record.id, record);
  return record;
}

export function getPendingAction(id: string) {
  sweep();
  return store.get(id);
}

export function markPendingConsumed(id: string, result: { reply: string }) {
  const record = store.get(id);
  if (!record) return;
  record.consumed = true;
  record.result = result;
}

export function cancelPendingAction(id: string, userId: string) {
  const record = store.get(id);
  if (!record) return false;
  if (record.userId !== userId) return false;
  store.delete(id);
  return true;
}
