import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { banners } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { storageDelete } from "../storage";

function isAdminUser(user: { role: string }) {
  return user.role === "admin";
}

export const bannersRouter = router({
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const now = new Date();
    const all = await db
      .select()
      .from(banners)
      .orderBy(asc(banners.orderIndex));

    // Filter by schedule
    return all.filter(b => {
      if (b.startsAt && b.startsAt > now) return false;
      if (b.endsAt && b.endsAt < now) return false;
      return true;
    });
  }),

  listAll: protectedProcedure.query(async ({ ctx }) => {
    if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
    const db = await getDb();
    if (!db) return [];
    const allBanners = await db.select().from(banners).orderBy(asc(banners.orderIndex));
    return allBanners;
  }),

  create: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url().max(2000),
        orderIndex: z.number().int().min(0).max(999).default(0),
        isActive: z.boolean().default(true),
        ctaLink: z.string().max(500).default("/create"),
        translations: z.record(z.string(), z.object({
          headline: z.string().max(200),
          subtext: z.string().max(400),
          ctaLabel: z.string().max(60),
        })),
        startsAt: z.string().optional(),
        endsAt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(banners).values({
        imageUrl: input.imageUrl,
        orderIndex: input.orderIndex,
        isActive: input.isActive,
        ctaLink: input.ctaLink,
        translations: input.translations,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      });

      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        imageUrl: z.string().url().max(2000).optional(),
        orderIndex: z.number().int().min(0).max(999).optional(),
        isActive: z.boolean().optional(),
        ctaLink: z.string().max(500).optional(),
        translations: z.record(z.string(), z.object({
          headline: z.string().max(200),
          subtext: z.string().max(400),
          ctaLabel: z.string().max(60),
        })).optional(),
        startsAt: z.string().nullable().optional(),
        endsAt: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, startsAt, endsAt, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };

      if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null;
      if (endsAt !== undefined) updateData.endsAt = endsAt ? new Date(endsAt) : null;

      await db.update(banners).set(updateData).where(eq(banners.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Fetch banner to get imageUrl for S3 cleanup
      const [banner] = await db.select().from(banners).where(eq(banners.id, input.id)).limit(1);

      await db.delete(banners).where(eq(banners.id, input.id));

      // Best-effort: delete the banner image from S3
      if (banner?.imageUrl) {
        try {
          // Extract the S3 key from the URL (everything after the bucket domain)
          const urlObj = new URL(banner.imageUrl);
          const key = urlObj.pathname.replace(/^\//, "");
          if (key) await storageDelete(key);
        } catch (e) {
          console.error("[Banners] Failed to delete image from storage:", e);
        }
      }

      return { success: true };
    }),

  reorder: protectedProcedure
    .input(z.array(z.object({ id: z.number(), orderIndex: z.number() })))
    .mutation(async ({ ctx, input }) => {
      if (!isAdminUser(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      for (const item of input) {
        await db.update(banners).set({ orderIndex: item.orderIndex }).where(eq(banners.id, item.id));
      }
      return { success: true };
    }),
});
