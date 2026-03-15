/**
 * authorStatsCache.ts
 *
 * Write-through cache helpers for author aggregate stats stored on the `profiles` table.
 * Call `refreshAuthorStats(authorId, db)` after any event that changes an author's stats:
 *   - A book is published (cachedTotalBooks)
 *   - A book is purchased (cachedTotalSales)
 *   - A review is submitted or updated (cachedTotalReviews, cachedAverageRating)
 *   - A reader completes a book (cachedTotalCompletions)
 *
 * The function recomputes all five counters in a single pass and upserts them atomically.
 */

import { and, avg, count, eq, sql } from "drizzle-orm";
import { books, profiles, readingProgress, reviews, userBooks } from "../drizzle/schema";

type Db = Awaited<ReturnType<typeof import("./db").getDb>>;

export async function refreshAuthorStats(authorId: number, db: NonNullable<Db>): Promise<void> {
  try {
    // 1. Count published books
    const [booksRow] = await db
      .select({ total: count(books.id) })
      .from(books)
      .where(and(eq(books.authorId, authorId), eq(books.isPublished, true)));

    // 2. Count total sales (unique purchases of author's books)
    const authorBookIds = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.authorId, authorId));

    let totalSales = 0;
    if (authorBookIds.length > 0) {
      const ids = authorBookIds.map(b => b.id);
      const [salesRow] = await db
        .select({ total: count(userBooks.bookId) })
        .from(userBooks)
        .where(
          sql`${userBooks.bookId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)}) AND ${userBooks.acquiredVia} = 'purchased'`
        );
      totalSales = Number(salesRow?.total ?? 0);
    }

    // 3. Count reviews + average rating across all author's books
    let totalReviews = 0;
    let averageRating = 0;
    if (authorBookIds.length > 0) {
      const ids = authorBookIds.map(b => b.id);
      const [reviewRow] = await db
        .select({
          total: count(reviews.id),
          avgRating: avg(reviews.rating),
        })
        .from(reviews)
        .where(
          sql`${reviews.bookId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`
        );
      totalReviews = Number(reviewRow?.total ?? 0);
      averageRating = Number(reviewRow?.avgRating ?? 0);
    }

    // 4. Count total completions across all author's books
    let totalCompletions = 0;
    if (authorBookIds.length > 0) {
      const ids = authorBookIds.map(b => b.id);
      const [compRow] = await db
        .select({ total: count(readingProgress.id) })
        .from(readingProgress)
        .where(
          sql`${readingProgress.bookId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)}) AND ${readingProgress.completedAt} IS NOT NULL`
        );
      totalCompletions = Number(compRow?.total ?? 0);
    }

    // 5. Write-through update
    await db
      .update(profiles)
      .set({
        cachedTotalBooks: Number(booksRow?.total ?? 0),
        cachedTotalSales: totalSales,
        cachedTotalReviews: totalReviews,
        cachedAverageRating: averageRating,
        cachedTotalCompletions: totalCompletions,
        statsUpdatedAt: new Date(),
      })
      .where(eq(profiles.userId, authorId));
  } catch (err) {
    // Never throw — stats cache failure must not block the main operation
    console.error("[authorStatsCache] Failed to refresh stats for author", authorId, err);
  }
}
