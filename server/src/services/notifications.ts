import { Notification } from "../models/Notification.js";
import type { NotificationType } from "../types.js";

export async function notifyUser(input: {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  donationId?: string;
  claimId?: string;
}) {
  return Notification.create({
    recipientId: input.recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
    donationId: input.donationId,
    claimId: input.claimId,
  });
}

export async function notifyMany(
  recipientIds: string[],
  payload: Omit<Parameters<typeof notifyUser>[0], "recipientId">,
) {
  if (!recipientIds.length) return [];
  const docs = recipientIds.map((recipientId) => ({
    recipientId,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    donationId: payload.donationId,
    claimId: payload.claimId,
  }));
  return Notification.insertMany(docs);
}
