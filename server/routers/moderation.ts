import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { bookReports, books, profiles, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { sanitizeText } from "../sanitize";

function isAdminUser(user: { role: string }) {
  return user.role === "admin";
}

export const moderationRouter = router({
  // Submit a report for a book (any authenticated user)
  reportBook: protectedProcedure
    .input(
      z.object({
        bookId: z.number().int().positive(),
        reason: z.string().min(5).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.status === "suspended") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account suspended." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify book exists and is published
      const [book] = await db.select().from(books).where(eq(books.id, input.bookId)).limit(1);
      if (!book || !book.isPublished) throw new TRPCError({ code: "NOT_FOUND" });

      // Prevent duplicate reports from the same user
      const existing = await db
        .select()
        .from(bookReports)
        .where(and(eq(bookReports.bookId, input.bookId), eq(bookReports.reporterUserId, ctx.user.id)))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already reported this book." });
      }

      await db.insert(bookReports).values({
        bookId: input.bookId,
        reporterUserId: ctx.user.id,
        reason: sanitizeText(input.reason),
      });

      return { success: true };
    }),

  // Admin: list all pending reports
  listReports: protectedProcedure
    .input(z.object({ status: z.enum(["pending", "resolved"]).optional() }))
    .query(async ({ ctx, input }) => {
      if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = input.status ? [eq(bookReports.status, input.status)] : [];

      const rows = await db
        .select({
          report: bookReports,
          bookTitle: books.title,
          bookIsDelisted: books.isDelisted,
          reporterName: profiles.authorName,
        })
        .from(bookReports)
        .leftJoin(books, eq(bookReports.bookId, books.id))
        .leftJoin(profiles, eq(bookReports.reporterUserId, profiles.userId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(bookReports.createdAt));

      return rows;
    }),

  // Admin: resolve a report (optionally delist the book)
  resolveReport: protectedProcedure
    .input(
      z.object({
        reportId: z.number().int().positive(),
        delistBook: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [report] = await db
        .select()
        .from(bookReports)
        .where(eq(bookReports.id, input.reportId))
        .limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(bookReports)
        .set({ status: "resolved" })
        .where(eq(bookReports.id, input.reportId));

      if (input.delistBook) {
        await db
          .update(books)
          .set({ isDelisted: true })
          .where(eq(books.id, report.bookId));
      }

      return { success: true };
    }),
});
