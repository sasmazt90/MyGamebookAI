/**
 * notificationEvents.ts
 * Higher-level notification triggers that sit on top of createNotification.
 * Each function is idempotent / throttled via the notificationThrottle table.
 *
 * Rules:
 *  - Leaderboard entry (rank 1-10): once per book per list type per 24h
 *  - Rank improvement: once per book per list type per 24h
 *  - Sales milestones (10, 50, 100, 500, 1000): once per milestone per book
 *  - Anti-spam: all notifications respect a minimum cooldown window
 */

import { and, eq, gt } from "drizzle-orm";
import { notificationThrottle } from "../drizzle/schema";
import { getDb } from "./db";
import { createNotification } from "./routers/notifications";

const THROTTLE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const SALES_MILESTONES = [10, 50, 100, 500, 1000];

/** Returns true if a notification of this type+key was already sent within the throttle window */
async function isThrottled(
  userId: number,
  notificationType: string,
  referenceKey: string,
  windowMs = THROTTLE_WINDOW_MS
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const cutoff = new Date(Date.now() - windowMs);
  const existing = await db
    .select({ id: notificationThrottle.id })
    .from(notificationThrottle)
    .where(
      and(
        eq(notificationThrottle.userId, userId),
        eq(notificationThrottle.notificationType, notificationType),
        eq(notificationThrottle.referenceKey, referenceKey),
        gt(notificationThrottle.lastSentAt, cutoff)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/** Records that a notification was sent (upsert by delete+insert for simplicity) */
async function recordThrottle(
  userId: number,
  notificationType: string,
  referenceKey: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Delete old record for this key if exists, then insert fresh
  await db
    .delete(notificationThrottle)
    .where(
      and(
        eq(notificationThrottle.userId, userId),
        eq(notificationThrottle.notificationType, notificationType),
        eq(notificationThrottle.referenceKey, referenceKey)
      )
    );
  await db.insert(notificationThrottle).values({
    userId,
    notificationType,
    referenceKey,
    lastSentAt: new Date(),
  });
}

/**
 * Notify an author when their book enters the leaderboard (top 10) for the first time
 * or re-enters after being absent. Throttled to once per book per list type per 24h.
 */
export async function notifyLeaderboardEntry(params: {
  authorId: number;
  bookId: number;
  bookTitle: string;
  listType: "bestSellers" | "newArrivals" | "mostPopular";
  rank: number;
}): Promise<void> {
  const { authorId, bookId, bookTitle, listType, rank } = params;
  if (rank > 10) return; // Only notify for top 10

  const listLabels: Record<string, string> = {
    bestSellers: "Best Sellers",
    newArrivals: "New Arrivals",
    mostPopular: "Most Popular",
  };

  const notifType = `leaderboard_entry_${listType}`;
  const refKey = `${bookId}`;

  if (await isThrottled(authorId, notifType, refKey)) return;

  await createNotification(
    authorId,
    notifType,
    `📈 "${bookTitle}" entered the ${listLabels[listType]} chart!`,
    `Your book is now ranked #${rank} in ${listLabels[listType]}. Keep up the great work!`,
    `/author/${authorId}`
  );

  await recordThrottle(authorId, notifType, refKey);
}

/**
 * Notify an author when their book improves its rank in a leaderboard column.
 * Throttled to once per book per list type per 24h.
 */
export async function notifyRankImprovement(params: {
  authorId: number;
  bookId: number;
  bookTitle: string;
  listType: "bestSellers" | "newArrivals" | "mostPopular";
  newRank: number;
  previousRank: number;
}): Promise<void> {
  const { authorId, bookId, bookTitle, listType, newRank, previousRank } = params;
  if (newRank >= previousRank) return; // Not an improvement
  if (newRank > 10) return; // Only notify for top 10

  const listLabels: Record<string, string> = {
    bestSellers: "Best Sellers",
    newArrivals: "New Arrivals",
    mostPopular: "Most Popular",
  };

  const notifType = `rank_improvement_${listType}`;
  const refKey = `${bookId}`;

  if (await isThrottled(authorId, notifType, refKey)) return;

  const gained = previousRank - newRank;
  await createNotification(
    authorId,
    notifType,
    `🚀 "${bookTitle}" climbed ${gained} spot${gained !== 1 ? "s" : ""} in ${listLabels[listType]}!`,
    `Now ranked #${newRank} (was #${previousRank}). Your readers are loving it!`,
    `/author/${authorId}`
  );

  await recordThrottle(authorId, notifType, refKey);
}

/**
 * Notify an author when a book crosses a sales milestone.
 * Each milestone is sent exactly once (no cooldown needed — milestone key is unique per level).
 */
export async function notifySalesMilestone(params: {
  authorId: number;
  bookId: number;
  bookTitle: string;
  totalSales: number;
}): Promise<void> {
  const { authorId, bookId, bookTitle, totalSales } = params;

  for (const milestone of SALES_MILESTONES) {
    if (totalSales < milestone) break; // milestones are sorted ascending

    const notifType = "sales_milestone";
    const refKey = `${bookId}_${milestone}`;

    // Use a very long window (365 days) so milestones are effectively sent once
    if (await isThrottled(authorId, notifType, refKey, 365 * 24 * 60 * 60 * 1000)) continue;

    await createNotification(
      authorId,
      notifType,
      `🎉 "${bookTitle}" reached ${milestone} sales!`,
      `Congratulations! Your book has now been purchased ${milestone} times. Thank you for creating amazing stories!`,
      `/author/${authorId}`
    );

    await recordThrottle(authorId, notifType, refKey);
  }
}

/**
 * Called from the leaderboard procedure (fire-and-forget) to dispatch
 * leaderboard entry and rank improvement notifications for all ranked authors.
 */
export async function dispatchLeaderboardNotifications(params: {
  listType: "bestSellers" | "newArrivals" | "mostPopular";
  rankedItems: Array<{
    authorId: number;
    bookId: number;
    bookTitle: string;
    newRank: number;
    previousRank: number | null;
  }>;
}): Promise<void> {
  const { listType, rankedItems } = params;

  for (const item of rankedItems) {
    const { authorId, bookId, bookTitle, newRank, previousRank } = item;

    // Entry notification: book is in top 10 and either new to the list (no prev rank) or re-entered
    if (newRank <= 10 && previousRank === null) {
      await notifyLeaderboardEntry({ authorId, bookId, bookTitle, listType, rank: newRank }).catch(() => {});
    }

    // Rank improvement notification
    if (previousRank !== null && newRank < previousRank) {
      await notifyRankImprovement({ authorId, bookId, bookTitle, listType, newRank, previousRank }).catch(() => {});
    }
  }
}
