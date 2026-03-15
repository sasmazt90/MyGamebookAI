/**
 * Gamebook AI credit packages available for purchase via Stripe.
 * Prices are in EUR (cents).
 */
export const CREDIT_PACKAGES = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 100,
    priceEurCents: 499,   // €4.99
    description: "Perfect for trying out the platform",
    popular: false,
  },
  {
    id: "explorer",
    name: "Explorer Pack",
    credits: 300,
    priceEurCents: 1199,  // €11.99
    description: "Great value for regular creators",
    popular: true,
  },
  {
    id: "creator",
    name: "Creator Pack",
    credits: 700,
    priceEurCents: 2499,  // €24.99
    description: "Best value for power users",
    popular: false,
  },
] as const;

export type CreditPackageId = (typeof CREDIT_PACKAGES)[number]["id"];
