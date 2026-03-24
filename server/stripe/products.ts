/**
 * Stripe credit-pack catalog.
 *
 * Product IDs are documented here for operational reference, but checkout and
 * webhook crediting must always resolve through Stripe price IDs.
 */
export const STRIPE_TAX_CODE = "txcd_10503004";

export const CREDIT_PACKAGES = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 100,
    priceEurCents: 1999,
    description: "A focused pack for a handful of premium generations.",
    popular: false,
    productId: "prod_UCjoVUwwBDO51H",
    priceEnvVar: "STRIPE_PRICE_STARTER_ID",
  },
  {
    id: "value",
    name: "Value Pack",
    credits: 250,
    priceEurCents: 4499,
    description: "Balanced value for regular readers and creators.",
    popular: true,
    productId: "prod_UCjpjI1LNvWJNI",
    priceEnvVar: "STRIPE_PRICE_VALUE_ID",
  },
  {
    id: "pro",
    name: "Pro Pack",
    credits: 500,
    priceEurCents: 8499,
    description: "The largest bundle for high-volume generation workflows.",
    popular: false,
    productId: "prod_UCjqePPK0KD0b7",
    priceEnvVar: "STRIPE_PRICE_PRO_ID",
  },
] as const;

export type CreditPackage = (typeof CREDIT_PACKAGES)[number];
export type CreditPackageId = CreditPackage["id"];

export function getCreditPackage(packageId: CreditPackageId | string) {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId) ?? null;
}

export function getStripePriceId(pkg: CreditPackage): string | null {
  const priceId = process.env[pkg.priceEnvVar]?.trim();
  return priceId ? priceId : null;
}

export function getCreditPackageByPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  return (
    CREDIT_PACKAGES.find((pkg) => getStripePriceId(pkg) === priceId.trim()) ?? null
  );
}
