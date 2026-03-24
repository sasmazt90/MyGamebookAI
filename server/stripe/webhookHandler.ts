import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { creditTransactions, wallets, stripeEvents, users } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { getCreditPackageByPriceId } from "./products";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
    apiVersion: "2026-02-25.clover",
  });
  return stripeClient;
}

const NOOP_EVENT_TYPES = new Set<string>(["checkout.session.expired"]);

export function isDuplicateStripeEventError(error: unknown): boolean {
  return (
    (error as { code?: string })?.code === "ER_DUP_ENTRY" ||
    String((error as { message?: string })?.message ?? "").includes("Duplicate entry")
  );
}

export async function recordStripeEventOnce(recordEvent: () => Promise<unknown>) {
  try {
    await recordEvent();
    return true;
  } catch (error) {
    if (isDuplicateStripeEventError(error)) return false;
    throw error;
  }
}

export async function resolveCheckoutSessionPriceId(
  session: Stripe.Checkout.Session,
  stripeClient: Stripe = getStripeClient(),
): Promise<string | null> {
  const metadataPriceId = session.metadata?.price_id?.trim();
  if (metadataPriceId) return metadataPriceId;
  if (!session.id) return null;

  try {
    const lineItems = await stripeClient.checkout.sessions.listLineItems(session.id, {
      limit: 1,
      expand: ["data.price"],
    });
    const lineItemPrice = lineItems.data[0]?.price;
    return typeof lineItemPrice === "string" ? lineItemPrice : lineItemPrice?.id ?? null;
  } catch (error) {
    console.error("[Stripe Webhook] Failed to resolve checkout session price ID:", error);
    return null;
  }
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  deps: {
    stripeClient?: Stripe;
    applyPurchase: (input: {
      userId: number;
      credits: number;
      packageName: string;
      amountEurCents: number;
      paymentIntentId: string | null;
    }) => Promise<void>;
  },
) {
  const userId = parseInt(session.client_reference_id || session.metadata?.user_id || "0", 10);
  if (!userId) {
    return { credited: false, reason: "missing-user-id" } as const;
  }

  const priceId = await resolveCheckoutSessionPriceId(
    session,
    deps.stripeClient ?? getStripeClient(),
  );
  const pkg = getCreditPackageByPriceId(priceId);
  if (!pkg) {
    return { credited: false, reason: "unsupported-price-id" } as const;
  }

  await deps.applyPurchase({
    userId,
    credits: pkg.credits,
    packageName: pkg.name,
    amountEurCents: session.amount_total ?? pkg.priceEurCents,
    paymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : null,
  });

  return {
    credited: true,
    packageId: pkg.id,
    credits: pkg.credits,
    userId,
  } as const;
}

/**
 * Register the Stripe webhook route on the Express app.
 * Must be registered BEFORE express.json() middleware.
 */
export function registerStripeWebhook(app: Express) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const sig = req.headers["stripe-signature"];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
      const stripe = getStripeClient();

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body as Buffer,
          sig as string,
          webhookSecret,
        );
      } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }

      if (event.id.startsWith("evt_test_")) {
        console.log("[Stripe Webhook] Test event detected, returning verification response");
        res.json({ verified: true });
        return;
      }

      console.log(`[Stripe Webhook] Event: ${event.type} | ID: ${event.id}`);

      const db = await getDb();
      if (db) {
        try {
          const isNewEvent = await recordStripeEventOnce(() =>
            db.insert(stripeEvents).values({
              eventId: event.id,
              eventType: event.type,
            }),
          );
          if (!isNewEvent) {
            console.log(`[Stripe Webhook] Duplicate event skipped: ${event.id}`);
            res.json({ received: true, skipped: true });
            return;
          }
        } catch (error) {
          console.error("[Stripe Webhook] Failed to record event:", error);
        }
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;

        try {
          const result = await handleCheckoutSessionCompleted(session, {
            stripeClient: stripe,
            applyPurchase: async ({
              userId,
              credits,
              packageName,
              amountEurCents,
              paymentIntentId,
            }) => {
              const dbInner = db ?? (await getDb());
              if (!dbInner) throw new Error("Database not available");

              await dbInner
                .insert(wallets)
                .values({ userId, balance: credits })
                .onDuplicateKeyUpdate({ set: { balance: sql`balance + ${credits}` } });

              const walletRows = await dbInner
                .select({ balance: wallets.balance })
                .from(wallets)
                .where(eq(wallets.userId, userId))
                .limit(1);
              const newBalance = walletRows[0]?.balance ?? credits;

              await dbInner.insert(creditTransactions).values({
                userId,
                type: "purchase" as const,
                amount: credits,
                balanceAfter: newBalance,
                description: `Stripe purchase: ${packageName} (€${(
                  amountEurCents / 100
                ).toFixed(2)})`,
                stripePaymentIntentId: paymentIntentId,
              });
            },
          });

          if (!result.credited) {
            console.warn(
              `[Stripe Webhook] checkout.session.completed ignored (${result.reason}) for session ${session.id}`,
            );
            res.json({ received: true });
            return;
          }

          console.log(
            `[Stripe Webhook] Credited ${result.credits} credits to user ${result.userId}`,
          );
        } catch (err) {
          console.error("[Stripe Webhook] Failed to credit user:", err);
          res.status(500).json({ error: "Failed to process payment" });
          return;
        }
      }

      if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
        const charge = event.data.object as Stripe.Charge;
        const amountRefundedCents =
          event.type === "charge.refunded"
            ? charge.amount_refunded ?? charge.amount
            : charge.amount;

        const paymentIntentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;

        if (!paymentIntentId) {
          console.warn("[Stripe Webhook] Refund event missing payment_intent, skipping");
          res.json({ received: true });
          return;
        }

        const dbInner = db ?? (await getDb());
        if (!dbInner) {
          res.status(500).json({ error: "Database unavailable" });
          return;
        }

        try {
          const origTx = await dbInner
            .select()
            .from(creditTransactions)
            .where(eq(creditTransactions.stripePaymentIntentId, paymentIntentId))
            .limit(1);

          if (!origTx.length) {
            console.warn(
              `[Stripe Webhook] No original transaction found for PI: ${paymentIntentId}`,
            );
            res.json({ received: true });
            return;
          }

          const { userId, amount: originalCredits } = origTx[0];
          const originalChargeCents = charge.amount;
          const creditsToReverse =
            originalChargeCents > 0
              ? Math.round((amountRefundedCents / originalChargeCents) * originalCredits)
              : originalCredits;

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
            newBalance = 0;
            lockAccount = true;
          }

          await dbInner
            .insert(wallets)
            .values({ userId, balance: newBalance })
            .onDuplicateKeyUpdate({ set: { balance: newBalance } });

          if (lockAccount) {
            await dbInner
              .update(users)
              .set({ accountLocked: true })
              .where(eq(users.id, userId));
            console.warn(
              `[Stripe Webhook] Account locked for user ${userId} due to refund exceeding balance`,
            );
          }

          await dbInner.insert(creditTransactions).values({
            userId,
            type: "refund_reversal" as const,
            amount: -creditsToReverse,
            balanceAfter: newBalance,
            description: `${
              event.type === "charge.refunded" ? "Refund" : "Chargeback"
            } reversal for PI: ${paymentIntentId}`,
            stripePaymentIntentId: paymentIntentId,
            referenceId: event.id,
          });

          console.log(
            `[Stripe Webhook] Reversed ${creditsToReverse} credits from user ${userId} (new balance: ${newBalance}, locked: ${lockAccount})`,
          );
        } catch (err) {
          console.error("[Stripe Webhook] Failed to process refund reversal:", err);
          res.status(500).json({ error: "Failed to process refund" });
          return;
        }
      }

      if (NOOP_EVENT_TYPES.has(event.type)) {
        console.log(`[Stripe Webhook] No-op event acknowledged: ${event.type}`);
      } else if (
        event.type !== "checkout.session.completed" &&
        event.type !== "charge.refunded" &&
        event.type !== "charge.dispute.created"
      ) {
        console.log(
          `[Stripe Webhook] Unsupported event acknowledged without action: ${event.type}`,
        );
      }

      res.json({ received: true });
    },
  );
}
