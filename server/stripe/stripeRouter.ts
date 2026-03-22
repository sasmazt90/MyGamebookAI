import Stripe from "stripe";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { CREDIT_PACKAGES, type CreditPackageId } from "./products";
import { TRPCError } from "@trpc/server";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe is not configured.",
    });
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover",
  });

  return stripeClient;
}

export const stripeRouter = router({
  /**
   * Returns the list of available credit packages (public — shown on Credits page before login).
   */
  getPackages: publicProcedure.query(() => {
    return CREDIT_PACKAGES.map(p => ({
      id: p.id,
      name: p.name,
      credits: p.credits,
      priceEurCents: p.priceEurCents,
      priceEur: (p.priceEurCents / 100).toFixed(2),
      description: p.description,
      popular: p.popular,
    }));
  }),

  /**
   * Creates a Stripe Checkout Session for the given credit package.
   * Returns the checkout URL so the frontend can redirect the user.
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        packageId: z.enum(["starter", "explorer", "creator"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.status === "suspended" || ctx.user.accountLocked) {
        throw new TRPCError({ code: "FORBIDDEN", message: ctx.user.accountLocked ? "Account locked due to payment issue. Please contact support." : "Account suspended" });
      }

      const pkg = CREDIT_PACKAGES.find(p => p.id === input.packageId);
      if (!pkg) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid package" });
      }

      const stripe = getStripeClient();

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        currency: "eur",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: pkg.priceEurCents,
              product_data: {
                name: `${pkg.name} — ${pkg.credits} Credits`,
                description: pkg.description,
                images: [],
              },
            },
          },
        ],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          package_id: pkg.id,
          credits: pkg.credits.toString(),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
        },
        allow_promotion_codes: true,
        success_url: `${input.origin}/credits?payment=success&credits=${pkg.credits}`,
        cancel_url: `${input.origin}/credits?payment=cancelled`,
      });

      if (!session.url) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create checkout session" });
      }

      return { checkoutUrl: session.url };
    }),
});
