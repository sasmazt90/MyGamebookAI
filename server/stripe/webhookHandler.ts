import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { creditTransactions, wallets, stripeEvents, users } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { CREDIT_PACKAGES } from "./products";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    })
  : null;

/**
 * Register the Stripe webhook route on the Express app.
 * Must be registered BEFORE express.json() middleware.
 */
export function registerStripeWebhook(app: Express) {
  if (!stripe || !webhookSecret) {
    console.warn("[Stripe Webhook] Stripe is disabled because STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is missing.");
    return;
  }

  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig as string,
          webhookSecret
        );
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }

      // Handle test events — required for Stripe webhook verification
      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        res.json({ verified: true });
        return;
      }

      console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

      // ── Idempotency guard ──────────────────────────────────────────────────────
      // Insert a record for this event ID. If the unique constraint fires, we
      // already processed it and can safely return 200 without double-crediting.
      const db = await getDb();
      if (db) {
        try {
          await db.insert(stripeEvents).values({
            eventId: event.id,
            eventType: event.type,
          });
        } catch (dupErr: any) {
          const isDuplicate =
            dupErr?.code === "ER_DUP_ENTRY" ||
            String(dupErr?.message ?? "").includes("Duplicate entry");
          if (isDuplicate) {
            console.log(`[Stripe Webhook] Duplicate event skipped: ${event.id}`);
            res.json({ received: true, skipped: true });
            return;
          }
          // Unexpected error — fall through and attempt processing anyway
          console.error("[Stripe Webhook] Failed to record event:", dupErr);
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = parseInt(session.metadata?.user_id || "0");
        const packageId = session.metadata?.package_id as string | undefined;
        const creditsStr = session.metadata?.credits;
        const credits = creditsStr ? parseInt(creditsStr) : 0;

        if (!userId || !credits) {
          console.error("[Stripe Webhook] Missing metadata in session:", session.id);
          res.json({ received: true });
          return;
        }

        const pkg = CREDIT_PACKAGES.find(p => p.id === packageId);
        const amountEurCents = session.amount_total ?? (pkg?.priceEurCents ?? 0);

        try {
          const dbInner = db ?? await getDb();
          if (!dbInner) throw new Error("Database not available");

          // Upsert wallet and credit the user
          await dbInner
            .insert(wallets)
            .values({ userId, balance: credits })
            .onDuplicateKeyUpdate({ set: { balance: sql`balance + ${credits}` } });

          // Fetch updated balance for the transaction record
          const walletRows = await dbInner
            .select({ balance: wallets.balance })
            .from(wallets)
            .where(eq(wallets.userId, userId))
            .limit(1);
          const newBalance = walletRows[0]?.balance ?? credits;

          // Record the transaction
          const txValues = {
            userId,
            type: "purchase" as const,
            amount: credits,
            balanceAfter: newBalance,
            description: `Stripe purchase: ${pkg?.name ?? packageId} (€${(amountEurCents / 100).toFixed(2)})`,
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null,
          };
          await dbInner.insert(creditTransactions).values(txValues);

          console.log(`[Stripe Webhook] Credited ${credits} credits to user ${userId} (new balance: ${newBalance})`);
        } catch (err) {
          console.error("[Stripe Webhook] Failed to credit user:", err);
          res.status(500).json({ error: "Failed to process payment" });
          return;
        }
      }

      // ── Refund reversal ────────────────────────────────────────────────────────
      if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
        const charge = event.data.object as Stripe.Charge;
        const amountRefundedCents =
          event.type === "charge.refunded"
            ? (charge.amount_refunded ?? charge.amount)
            : charge.amount;

        // Determine credits to reverse: 1 credit = 1 EUR cent (same as purchase logic)
        // Find the original transaction by payment_intent to get the user
        const paymentIntentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;

        if (!paymentIntentId) {
          console.warn("[Stripe Webhook] Refund event missing payment_intent, skipping");
          res.json({ received: true });
          return;
        }

        const dbInner = db ?? await getDb();
        if (!dbInner) {
          res.status(500).json({ error: "Database unavailable" });
          return;
        }

        try {
          // Find the original purchase transaction to get userId and credits
          const origTx = await dbInner
            .select()
            .from(creditTransactions)
            .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId))
            .limit(1);

          if (!origTx.length) {
            console.warn(`[Stripe Webhook] No original transaction found for PI: ${paymentIntentId}`);
            res.json({ received: true });
            return;
          }

          const { userId, amount: originalCredits } = origTx[0];
          // Reverse proportional credits (refunded amount / original amount * credits)
          const originalChargeCents = charge.amount;
          const creditsToReverse = originalChargeCents > 0
            ? Math.round((amountRefundedCents / originalChargeCents) * originalCredits)
            : originalCredits;

          // Fetch current wallet balance
          const walletRows = await dbInner
            .select({ balance: wallets.balance })
            .from(wallets)
            .where(eq(wallets.userId, userId))
            .limit(1);
          const currentBalance = walletRows[0]?.balance ?? 0;

          let newBalance: number;
          let lockAccount = false;

          if (currentBalance >= creditsToReverse) {
            newBalance = currentBalance - creditsToReverse;
          } else {
            // Wallet insufficient — zero out and lock account
            newBalance = 0;
            lockAccount = true;
          }

          // Update wallet
          await dbInner
            .insert(wallets)
            .values({ userId, balance: newBalance })
            .onDuplicateKeyUpdate({ set: { balance: newBalance } });

          // Lock account if needed
          if (lockAccount) {
            await dbInner
              .update(users)
              .set({ accountLocked: true })
              .where(eq(users.id, userId));
            console.warn(`[Stripe Webhook] Account locked for user ${userId} due to refund exceeding balance`);
          }

          // Record reversal transaction
          await dbInner.insert(creditTransactions).values({
            userId,
            type: "refund_reversal" as const,
            amount: -creditsToReverse,
            balanceAfter: newBalance,
            description: `${event.type === "charge.refunded" ? "Refund" : "Chargeback"} reversal for PI: ${paymentIntentId}`,
            stripePaymentIntentId: paymentIntentId,
            referenceId: event.id,
          });

          console.log(`[Stripe Webhook] Reversed ${creditsToReverse} credits from user ${userId} (new balance: ${newBalance}, locked: ${lockAccount})`);
        } catch (err) {
          console.error("[Stripe Webhook] Failed to process refund reversal:", err);
          res.status(500).json({ error: "Failed to process refund" });
          return;
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      res.json({ received: true });
    }
  );
}
