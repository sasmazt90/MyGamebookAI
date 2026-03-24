import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  handleCheckoutSessionCompleted,
  recordStripeEventOnce,
  resolveCheckoutSessionPriceId,
} from "./webhookHandler";

describe("stripe webhook helpers", () => {
  beforeEach(() => {
    process.env.STRIPE_PRICE_STARTER_ID = "price_starter_test";
    process.env.STRIPE_PRICE_VALUE_ID = "price_value_test";
    process.env.STRIPE_PRICE_PRO_ID = "price_pro_test";
  });

  it("maps checkout.session.completed to credits through the configured price_id", async () => {
    const applyPurchase = vi.fn();
    const session = {
      id: "cs_test_123",
      client_reference_id: "42",
      amount_total: 4499,
      metadata: {
        price_id: "price_value_test",
      },
      payment_intent: "pi_test_123",
    } as unknown as Stripe.Checkout.Session;

    const result = await handleCheckoutSessionCompleted(session, {
      applyPurchase,
    });

    expect(result).toMatchObject({
      credited: true,
      userId: 42,
      packageId: "value",
      credits: 250,
    });
    expect(applyPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        credits: 250,
        packageName: "Value Pack",
        amountEurCents: 4499,
        paymentIntentId: "pi_test_123",
      }),
    );
  });

  it("falls back to Stripe line items when metadata price_id is absent", async () => {
    const stripeClient = {
      checkout: {
        sessions: {
          listLineItems: vi.fn().mockResolvedValue({
            data: [{ price: { id: "price_pro_test" } }],
          }),
        },
      },
    } as unknown as Stripe;
    const session = {
      id: "cs_test_456",
      metadata: {},
    } as unknown as Stripe.Checkout.Session;

    await expect(resolveCheckoutSessionPriceId(session, stripeClient)).resolves.toBe(
      "price_pro_test",
    );
  });

  it("returns false for duplicate events so credits are not applied twice", async () => {
    const recordEvent = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Duplicate entry 'evt_1' for key"));

    await expect(recordStripeEventOnce(recordEvent)).resolves.toBe(true);
    await expect(recordStripeEventOnce(recordEvent)).resolves.toBe(false);
    expect(recordEvent).toHaveBeenCalledTimes(2);
  });
});
