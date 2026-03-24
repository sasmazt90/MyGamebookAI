import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { creditTransactions, wallets } from "../../drizzle/schema";
import { getDb, getWalletByUserId } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { CREDIT_PACKAGES } from "../stripe/products";

export async function adjustCredits(
  userId: number,
  amount: number,
  type: "purchase" | "spend_generate" | "spend_buy" | "earn_sale" | "admin_adjust" | "monthly_reward",
  description: string,
  referenceId?: string,
  stripePaymentIntentId?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Ensure wallet exists
  await db
    .insert(wallets)
    .values({ userId, balance: 0 })
    .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });

  const walletRows = await db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1);

  const currentBalance = walletRows[0]?.balance ?? 0;
  const newBalance = currentBalance + amount;

  if (newBalance < 0) {
    throw new Error("Insufficient credits");
  }

  await db
    .update(wallets)
    .set({ balance: newBalance })
    .where(eq(wallets.userId, userId));

  await db.insert(creditTransactions).values({
    userId,
    type,
    amount,
    balanceAfter: newBalance,
    description,
    referenceId,
    stripePaymentIntentId,
  });

  return newBalance;
}

export const creditsRouter = router({
  balance: protectedProcedure.query(async ({ ctx }) => {
    const wallet = await getWalletByUserId(ctx.user.id);
    return { balance: wallet?.balance ?? 0 };
  }),

  transactions: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const txns = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, ctx.user.id))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(input.limit);

      return txns;
    }),

  // Stripe packages
  getPackages: protectedProcedure.query(() => {
    return CREDIT_PACKAGES.map((pkg) => ({
      id: pkg.id,
      credits: pkg.credits,
      priceEur: Number((pkg.priceEurCents / 100).toFixed(2)),
      label: pkg.name,
    }));
  }),
});
