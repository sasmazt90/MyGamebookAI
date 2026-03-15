import { TRPCError } from "@trpc/server";
import { desc, eq, like, and, asc } from "drizzle-orm";
import { z } from "zod";
import { books, campaigns, profiles, reviews, users, wallets, bookPages, readingProgress, userBooks, generationJobs, bookCharacters, bookReports } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { adjustCredits } from "./credits";
import { createNotification } from "./notifications";

function adminOnly(role: string) {
  if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
}



export const adminRouter = router({
  // Member management
  listMembers: protectedProcedure
    .input(z.object({ search: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const result = await db
        .select({ user: users, profile: profiles, wallet: wallets })
        .from(users)
        .leftJoin(profiles, eq(users.id, profiles.userId))
        .leftJoin(wallets, eq(users.id, wallets.userId))
        .orderBy(desc(users.createdAt))
        .limit(input.limit);

      return result;
    }),

  suspendUser: protectedProcedure
    .input(z.object({ userId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(users).set({ status: "suspended" }).where(eq(users.id, input.userId));

      await createNotification(
        input.userId,
        "admin_action",
        "Account Suspended",
        input.reason || "Your account has been suspended by an administrator.",
      );

      return { success: true };
    }),

  unsuspendUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(users).set({ status: "active" }).where(eq(users.id, input.userId));

      await createNotification(
        input.userId,
        "admin_action",
        "Account Reinstated",
        "Your account has been reinstated by an administrator.",
      );

      return { success: true };
    }),

  softDeleteUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Soft delete: set status=deleted and stamp deletedAt
      await db
        .update(users)
        .set({ status: "deleted", deletedAt: new Date() })
        .where(eq(users.id, input.userId));

      await createNotification(
        input.userId,
        "admin_action",
        "Account Deleted",
        "Your account has been deleted by an administrator. Your books will remain visible as \"[Deleted Author]\".",
      );

      return { success: true };
    }),

  unlockAccount: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db
        .update(users)
        .set({ accountLocked: false })
        .where(eq(users.id, input.userId));

      await createNotification(
        input.userId,
        "admin_action",
        "Account Unlocked",
        "Your account has been unlocked by an administrator. You can now use all platform features.",
      );

      return { success: true };
    }),

  adjustCredits: protectedProcedure
    .input(z.object({
      userId: z.number(),
      amount: z.number(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);

      await adjustCredits(input.userId, input.amount, "admin_adjust", input.reason);

      await createNotification(
        input.userId,
        "admin_action",
        input.amount > 0 ? "Credits Added" : "Credits Removed",
        `An administrator ${input.amount > 0 ? "added" : "removed"} ${Math.abs(input.amount)} credits. Reason: ${input.reason}`,
      );

      return { success: true };
    }),

  // Book management
  listBooks: protectedProcedure
    .input(z.object({ search: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select({ book: books, authorName: profiles.authorName })
        .from(books)
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .orderBy(desc(books.createdAt))
        .limit(input.limit);
    }),

  delistBook: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.update(books).set({ isDelisted: true }).where(eq(books.id, input.bookId));
      return { success: true };
    }),

  deleteBook: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Cascade delete: remove all related records first (in dependency order)
      await db.delete(bookCharacters).where(eq(bookCharacters.bookId, input.bookId));
      await db.delete(bookReports).where(eq(bookReports.bookId, input.bookId));
      await db.delete(generationJobs).where(eq(generationJobs.bookId, input.bookId));
      await db.delete(readingProgress).where(eq(readingProgress.bookId, input.bookId));
      await db.delete(userBooks).where(eq(userBooks.bookId, input.bookId));
      await db.delete(reviews).where(eq(reviews.bookId, input.bookId));
      await db.delete(bookPages).where(eq(bookPages.bookId, input.bookId));
      
      // Finally, delete the book itself
      await db.delete(books).where(eq(books.id, input.bookId));
      return { success: true };
    }),

  // Review moderation
  listReviews: protectedProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      return db
        .select({ review: reviews, authorName: profiles.authorName, bookTitle: books.title })
        .from(reviews)
        .leftJoin(profiles, eq(reviews.userId, profiles.userId))
        .leftJoin(books, eq(reviews.bookId, books.id))
        .orderBy(desc(reviews.createdAt))
        .limit(input.limit);
    }),

  deleteReview: protectedProcedure
    .input(z.object({ reviewId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(reviews).where(eq(reviews.id, input.reviewId));
      return { success: true };
    }),

  // Campaign management
  listCampaigns: protectedProcedure.query(async ({ ctx }) => {
    adminOnly(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }),

  createCampaign: protectedProcedure
    .input(z.object({
      name: z.string(),
      discountType: z.enum(["percent", "fixed"]),
      discountValue: z.number().positive(),
      targetCategories: z.array(z.string()),
      isActive: z.boolean().default(false),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Validate discount won't make platform earnings negative
      if (input.discountType === "percent" && input.discountValue > 70) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Discount cannot exceed 70% (platform share)" });
      }

      await db.insert(campaigns).values({
        name: input.name,
        discountType: input.discountType,
        discountValue: input.discountValue,
        targetCategories: input.targetCategories,
        isActive: input.isActive,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      });

      return { success: true };
    }),

  updateCampaign: protectedProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean().optional(),
      discountValue: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...rest } = input;
      await db.update(campaigns).set(rest).where(eq(campaigns.id, id));
      return { success: true };
    }),

  deleteCampaign: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.delete(campaigns).where(eq(campaigns.id, input.id));
      return { success: true };
    }),

  // Monthly rewards
  runMonthlyRewards: protectedProcedure.mutation(async ({ ctx }) => {
    adminOnly(ctx.user.role);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

    const { monthlyRewards, userBooks } = await import("../../drizzle/schema");
    const { count, desc: descFn, gte, lt } = await import("drizzle-orm");

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Check if already run this month
    const existing = await db
      .select()
      .from(monthlyRewards)
      .where(eq(monthlyRewards.yearMonth, yearMonth))
      .limit(1);

    if (existing.length > 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Monthly rewards already distributed for this month" });
    }

    // Get top 10 authors by purchases this month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Simple approach: get top authors by total purchase count
    const topAuthors = await db
      .select({ authorId: books.authorId, purchases: books.purchaseCount })
      .from(books)
      .where(eq(books.isPublished, true))
      .orderBy(desc(books.purchaseCount))
      .limit(10);

    for (let i = 0; i < topAuthors.length; i++) {
      const author = topAuthors[i];
      await adjustCredits(author.authorId, 10, "monthly_reward", `Monthly Top-${i + 1} Author Reward`);
      await db.insert(monthlyRewards).values({
        userId: author.authorId,
        yearMonth,
        creditsAwarded: 10,
        rank: i + 1,
      });
      await createNotification(
        author.authorId,
        "monthly_reward",
        "Monthly Author Reward!",
        `Congratulations! You ranked #${i + 1} this month and received 10 credits.`,
      );
    }

    return { success: true, rewarded: topAuthors.length };
  }),

  // ── Featured Gamebooks ──────────────────────────────────────────────────────

  /** List all currently featured books ordered by featuredOrder */
  listFeatured: protectedProcedure
    .query(async ({ ctx }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const result = await db
        .select({ book: books, authorName: profiles.authorName, authorAvatar: profiles.avatarUrl })
        .from(books)
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .where(eq(books.isFeatured, true))
        .orderBy(asc(books.featuredOrder));
      return result;
    }),

  /** Search published books to add to featured (excludes already-featured ones) */
  searchBooksForFeatured: protectedProcedure
    .input(z.object({ search: z.string().max(120).optional() }))
    .query(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conditions = [
        eq(books.isPublished, true),
        eq(books.isDelisted, false),
        eq(books.status, "ready"),
        eq(books.isFeatured, false),
      ];
      if (input.search) conditions.push(like(books.title, `%${input.search}%`));
      const result = await db
        .select({ book: books, authorName: profiles.authorName })
        .from(books)
        .leftJoin(profiles, eq(books.authorId, profiles.userId))
        .where(and(...conditions))
        .orderBy(desc(books.purchaseCount))
        .limit(30);
      return result;
    }),

  /** Feature a book (add to featured list at the end) */
  featureBook: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Get current max featuredOrder
      const featured = await db
        .select({ featuredOrder: books.featuredOrder })
        .from(books)
        .where(eq(books.isFeatured, true))
        .orderBy(desc(books.featuredOrder))
        .limit(1);
      const nextOrder = featured.length > 0 ? (featured[0].featuredOrder + 1) : 0;
      await db.update(books)
        .set({ isFeatured: true, featuredOrder: nextOrder })
        .where(eq(books.id, input.bookId));
      return { success: true };
    }),

  /** Remove a book from featured */
  unfeatureBook: protectedProcedure
    .input(z.object({ bookId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(books)
        .set({ isFeatured: false, featuredOrder: 0 })
        .where(eq(books.id, input.bookId));
      return { success: true };
    }),

  /** Reorder featured books — swap two items */
  reorderFeatured: protectedProcedure
    .input(z.object({
      bookId: z.number(),
      direction: z.enum(["up", "down"]),
    }))
    .mutation(async ({ ctx, input }) => {
      adminOnly(ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const allFeatured = await db
        .select({ id: books.id, featuredOrder: books.featuredOrder })
        .from(books)
        .where(eq(books.isFeatured, true))
        .orderBy(asc(books.featuredOrder));
      const idx = allFeatured.findIndex(b => b.id === input.bookId);
      if (idx === -1) throw new TRPCError({ code: "NOT_FOUND" });
      const swapIdx = input.direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= allFeatured.length) return { success: true }; // already at edge
      const current = allFeatured[idx];
      const swap = allFeatured[swapIdx];
      await db.update(books).set({ featuredOrder: swap.featuredOrder }).where(eq(books.id, current.id));
      await db.update(books).set({ featuredOrder: current.featuredOrder }).where(eq(books.id, swap.id));
      return { success: true };
    }),
});
