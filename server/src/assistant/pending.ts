import { randomUUID } from "node:crypto";
import { AppError } from "../utils.js";
import type { ActionKind, ClassifiedIntent, PendingActionRecord } from "./types.js";

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, PendingActionRecord>();
const inFlight = new Map<string, Promise<{ reply: string }>>();
export type Clarification = {
  classified: ClassifiedIntent;
  question: "delay" | "pickup" | "message";
  message: string;
  claimIds?: string[];
  expiresAt: number;
};
const clarifications = new Map<string, Clarification>();

export function setClarification(userId: string, value: Omit<Clarification, "expiresAt">) {
  sweep();
  clarifications.set(userId, { ...value, expiresAt: Date.now() + TTL_MS });
}

export function getClarification(userId: string) {
  sweep();
  return clarifications.get(userId);
}

export function clearClarification(userId: string) {
  clarifications.delete(userId);
}

export function isPendingInFlight(id: string) {
  return inFlight.has(id);
}

/** Share one execution between simultaneous button/chat confirmations in this process. */
export function confirmPendingAction(id: string, userId: string, execute: (pending: PendingActionRecord) => Promise<{ reply: string }>) {
  const pending = getPendingAction(id);
  if (!pending) throw new AppError("This confirmation expired or is no longer available. Please describe the update again.", 404);
  if (pending.userId !== userId) throw new AppError("You cannot confirm this action.", 403);
  if (pending.consumed && pending.result) return Promise.resolve(pending.result);
  const running = inFlight.get(id);
  if (running) return running;
  const result = Promise.resolve().then(() => execute(pending)).then(result => {
    markPendingConsumed(id, result);
    return result;
  }).finally(() => inFlight.delete(id));
  inFlight.set(id, result);
  return result;
}

function sweep(now = Date.now()) {
  for (const [id, record] of store) {
    if (record.expiresAt <= now && !inFlight.has(id)) store.delete(id);
  }
  for (const [userId, draft] of clarifications) {
    if (draft.expiresAt <= now) clarifications.delete(userId);
  }
}

export function clearPendingActionsForTests() {
  store.clear();
  clarifications.clear();
  inFlight.clear();
}

export function createPendingAction(input: {
  userId: string;
  kind: ActionKind;
  claimId?: string;
  donationId?: string;
  delayMinutes?: number;
  instructions?: string;
  relayMessage?: string;
  arriveAtLabel?: string;
  arriveAtMinutes?: number;
}) {
  sweep();
  clearClarification(input.userId);
  for (const [id, record] of store) {
    if (record.userId === input.userId && !record.consumed) {
      if (inFlight.has(id)) throw new AppError("Your confirmed update is being sent. Please wait before changing it.", 409);
      store.delete(id);
    }
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
    relayMessage: input.relayMessage,
    arriveAtLabel: input.arriveAtLabel,
    arriveAtMinutes: input.arriveAtMinutes,
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

export function getOpenPendingForUser(userId: string) {
  sweep();
  const now = Date.now();
  for (const record of store.values()) {
    if (record.userId === userId && !record.consumed && record.expiresAt > now) return record;
  }
  return undefined;
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
  if (inFlight.has(id)) throw new AppError("This update is already being sent and cannot be cancelled.", 409);
  if (record.consumed) throw new AppError("This update has already been sent and cannot be cancelled.", 409);
  store.delete(id);
  return true;
}
