export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Owner notification — no delivery channel configured.
 * Always returns false. Replace this stub when a notification
 * channel (email, webhook, etc.) is set up.
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  console.warn("[Notification] notifyOwner called but no channel is configured. title:", payload.title);
  return false;
}
