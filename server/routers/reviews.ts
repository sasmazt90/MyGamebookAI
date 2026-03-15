import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { books, profiles, reviews, userBooks } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { createNotification } from "./notifications";
import { sanitizeText } from "../sanitize";
import { refreshAuthorStats } from "../authorStatsCache";

// Helper: build star string e.g. "★★★★☆"
function starString(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export const reviewsRouter = router({
  getForBook: publicProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select({
          review: reviews,
          authorName: profiles.authorName,
          authorAvatar: profiles.avatarUrl,
        })
        .from(reviews)
        .leftJoin(profiles, eq(reviews.userId, profiles.userId))
        .where(eq(reviews.bookId, input.bookId))
        .orderBy(desc(reviews.createdAt))
        .limit(50);

      return result;
    }),

  submit: protectedProcedure
    .input(
      z.object({
        bookId: z.number(),
        rating: z.number().min(1).max(5),
        reviewText: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.status === "suspended") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account suspended" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Must own the book
      const owned = await db
        .select()
        .from(userBooks)
        .where(
          and(
            eq(userBooks.userId, ctx.user.id),
            eq(userBooks.bookId, input.bookId)
          )
        )
        .limit(1);

      if (!owned[0]) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must own this book to review it",
        });
      }

      // Check if already reviewed
      const existing = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.userId, ctx.user.id),
            eq(reviews.bookId, input.bookId)
          )
        )
        .limit(1);

      const cleanReviewText = input.reviewText ? sanitizeText(input.reviewText) : null;

      if (existing[0]) {
        // Update existing review
        await db
          .update(reviews)
          .set({ rating: input.rating, reviewText: cleanReviewText })
          .where(eq(reviews.id, existing[0].id));

        // Recalculate average rating after update
        const allReviews = await db
          .select()
          .from(reviews)
          .where(eq(reviews.bookId, input.bookId));

        const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        await db
          .update(books)
          .set({ reviewCount: allReviews.length, averageRating: avg })
          .where(eq(books.id, input.bookId));
      } else {
        await db.insert(reviews).values({
          bookId: input.bookId,
          userId: ctx.user.id,
          rating: input.rating,
          reviewText: cleanReviewText,
        });

        // Update book review count and average
        const allReviews = await db
          .select()
          .from(reviews)
          .where(eq(reviews.bookId, input.bookId));

        const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        await db
          .update(books)
          .set({
            reviewCount: allReviews.length,
            averageRating: avg,
          })
          .where(eq(books.id, input.bookId));
      }

      // ── Notify the book author ──────────────────────────────────────────────
      // Fetch book + reviewer name to build the notification
      try {
        const [bookRow] = await db
          .select({ authorId: books.authorId, title: books.title })
          .from(books)
          .where(eq(books.id, input.bookId))
          .limit(1);

        // Don't notify if the reviewer IS the author
        if (bookRow && bookRow.authorId !== ctx.user.id) {
          const [reviewerProfile] = await db
            .select({ authorName: profiles.authorName })
            .from(profiles)
            .where(eq(profiles.userId, ctx.user.id))
            .limit(1);

          const reviewerName = reviewerProfile?.authorName ?? ctx.user.name ?? "A reader";
          const isUpdate = !!existing[0];
          const stars = starString(input.rating);
          const commentPreview = input.reviewText
            ? ` — "${input.reviewText.slice(0, 100)}${input.reviewText.length > 100 ? "..." : ""}"`
            : "";

          await createNotification(
            bookRow.authorId,
            "review",
            isUpdate
              ? `${reviewerName} updated their review of "${bookRow.title}"`
              : `New review on "${bookRow.title}"`,
            `${stars}${commentPreview}`,
            `/store/${input.bookId}`,
            { bookId: input.bookId, rating: input.rating, reviewerId: ctx.user.id }
          );
        }
      } catch (notifErr) {
        // Non-critical: log but don't fail the review submission
        console.error("[Reviews] Failed to send author notification:", notifErr);
      }

      // Refresh author stats cache (fire-and-forget)
      try {
        const [bookForStats] = await db
          .select({ authorId: books.authorId })
          .from(books)
          .where(eq(books.id, input.bookId))
          .limit(1);
        if (bookForStats) {
          refreshAuthorStats(bookForStats.authorId, db).catch(console.error);
        }
      } catch { /* non-critical */ }

      return { success: true };
    }),

  myReview: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const result = await db
        .select()
        .from(reviews)
        .where(
          and(
            eq(reviews.userId, ctx.user.id),
            eq(reviews.bookId, input.bookId)
          )
        )
        .limit(1);

      return result[0] ?? null;
    }),
});
