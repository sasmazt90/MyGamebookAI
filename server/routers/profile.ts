import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { profiles, wallets } from "../../drizzle/schema";
import { getDb, getProfileByUserId } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { validateUpload } from "../uploadValidation";

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getProfileByUserId(ctx.user.id);
    return profile ?? null;
  }),

  checkAuthorName: protectedProcedure
    .input(z.object({ authorName: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const lower = input.authorName.toLowerCase().trim();
      const existing = await db
        .select()
        .from(profiles)
        .where(eq(profiles.authorNameLower, lower))
        .limit(1);
      return { available: existing.length === 0 };
    }),

  create: protectedProcedure
    .input(
      z.object({
        authorName: z
          .string()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9 ._-]+$/),
        interfaceLanguage: z.string().default("en"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const lower = input.authorName.toLowerCase().trim();

      // Check uniqueness
      const existing = await db
        .select()
        .from(profiles)
        .where(eq(profiles.authorNameLower, lower))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Author name already taken",
        });
      }

      await db.insert(profiles).values({
        userId: ctx.user.id,
        authorName: input.authorName.trim(),
        authorNameLower: lower,
        interfaceLanguage: input.interfaceLanguage,
        onboardingComplete: true,
      });

      // Ensure wallet exists
      await db
        .insert(wallets)
        .values({ userId: ctx.user.id, balance: 0 })
        .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });

      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        authorName: z
          .string()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9 ._-]+$/)
          .optional(),
        bio: z.string().max(500).optional().nullable(),
        interfaceLanguage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const updateData: Record<string, unknown> = {};

      if (input.authorName) {
        const lower = input.authorName.toLowerCase().trim();
        const existing = await db
          .select()
          .from(profiles)
          .where(eq(profiles.authorNameLower, lower))
          .limit(1);

        if (existing.length > 0 && existing[0].userId !== ctx.user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Author name already taken",
          });
        }
        updateData.authorName = input.authorName.trim();
        updateData.authorNameLower = lower;
      }

      if (input.bio !== undefined) {
        updateData.bio = input.bio ?? null;
      }

      if (input.interfaceLanguage) {
        updateData.interfaceLanguage = input.interfaceLanguage;
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(profiles)
          .set(updateData)
          .where(eq(profiles.userId, ctx.user.id));
      }

      return { success: true };
    }),

  uploadAvatar: protectedProcedure
    .input(
      z.object({
        base64Data: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate mime type and size before uploading
      const uploadErr = validateUpload(input.base64Data, input.mimeType, "avatar");
      if (uploadErr) {
        throw new TRPCError({ code: "BAD_REQUEST", message: uploadErr.message });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const buffer = Buffer.from(input.base64Data, "base64");
      const ext = input.mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const key = `avatars/${ctx.user.id}-${nanoid(8)}.${ext}`;

      const { url } = await storagePut(key, buffer, input.mimeType);

      await db
        .update(profiles)
        .set({ avatarUrl: url })
        .where(eq(profiles.userId, ctx.user.id));

      return { avatarUrl: url };
    }),
});
