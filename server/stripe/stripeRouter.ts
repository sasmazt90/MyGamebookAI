import Stripe from "stripe";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  CREDIT_PACKAGES,
  getCreditPackage,
  getStripePriceId,
  STRIPE_TAX_CODE,
} from "./products";
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
  getPackages: publicProcedure.query(() => {
    return CREDIT_PACKAGES.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits,
      priceEurCents: pkg.priceEurCents,
      priceEur: (pkg.priceEurCents / 100).toFixed(2),
      description: pkg.description,
      popular: pkg.popular,
    }));
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        packageId: z.enum(["starter", "value", "pro"]),
        origin: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.status === "suspended" || ctx.user.accountLocked) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: ctx.user.accountLocked
            ? "Account locked due to payment issue. Please contact support."
            : "Account suspended",
        });
      }

      const pkg = getCreditPackage(input.packageId);
      if (!pkg) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid package" });
      }

      const priceId = getStripePriceId(pkg);
      if (!priceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Stripe price ID is missing for ${pkg.name}.`,
        });
      }

      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price: priceId,
          },
        ],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: ctx.user.id.toString(),
        metadata: {
          user_id: ctx.user.id.toString(),
          package_id: pkg.id,
          price_id: priceId,
          tax_code: STRIPE_TAX_CODE,
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
        },
        allow_promotion_codes: true,
        success_url: `${input.origin}/credits?payment=success&credits=${pkg.credits}`,
        cancel_url: `${input.origin}/credits?payment=cancelled`,
      });

      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }

      return { checkoutUrl: session.url };
    }),
});
