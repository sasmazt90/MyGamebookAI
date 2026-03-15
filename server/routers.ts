import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { profileRouter } from "./routers/profile";
import { creditsRouter } from "./routers/credits";
import { booksRouter } from "./routers/books";
import { reviewsRouter } from "./routers/reviews";
import { notificationsRouter } from "./routers/notifications";
import { bannersRouter } from "./routers/banners";
import { adminRouter } from "./routers/admin";
import { stripeRouter } from "./stripe/stripeRouter";
import { moderationRouter } from "./routers/moderation";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
} from "./_core/customAuth";
import { getDb } from "./db";
import { getUserByEmail } from "./db";
import { users, wallets } from "../drizzle/schema";
import { sanitizeText } from "./sanitize";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(50).transform(v => sanitizeText(v.trim())),
          email: z.string().email().max(320).transform(v => v.toLowerCase().trim()),
          password: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

        // Check for duplicate email
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
        }

        const passwordHash = await hashPassword(input.password);
        // Use email as openId for custom-auth users
        const openId = `email:${input.email}`;

        const [result] = await db.insert(users).values({
          openId,
          name: input.name,
          email: input.email,
          passwordHash,
          loginMethod: "email",
          lastSignedIn: new Date(),
        });

        const userId = (result as any).insertId as number;

        // Create wallet
        await db.insert(wallets).values({ userId, balance: 0 });

        // Issue session cookie
        const token = await createSessionToken(userId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: THIRTY_DAYS_MS,
        });

        return { success: true, userId };
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email().max(320).transform(v => v.toLowerCase().trim()),
          password: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }
        if (user.status === "deleted") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This account has been deleted." });
        }
        if (user.accountLocked) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This account is locked. Please contact support." });
        }

        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
        }

        // Update lastSignedIn
        const db = await getDb();
        if (db) {
          const { eq } = await import("drizzle-orm");
          await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
        }

        const token = await createSessionToken(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: THIRTY_DAYS_MS,
        });

        return { success: true, userId: user.id };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  profile: profileRouter,
  credits: creditsRouter,
  books: booksRouter,
  reviews: reviewsRouter,
  notifications: notificationsRouter,
  banners: bannersRouter,
  admin: adminRouter,
  stripe: stripeRouter,
  moderation: moderationRouter,
});

export type AppRouter = typeof appRouter;
