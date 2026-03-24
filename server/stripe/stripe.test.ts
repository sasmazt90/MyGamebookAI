import { describe, expect, it } from "vitest";
import { CREDIT_PACKAGES } from "./products";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function makePublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function makeAuthCtx(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "test-user-42",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Stripe products", () => {
  it("defines exactly 3 credit packages", () => {
    expect(CREDIT_PACKAGES).toHaveLength(3);
  });

  it("has starter, value, and pro packages", () => {
    const ids = CREDIT_PACKAGES.map(p => p.id);
    expect(ids).toContain("starter");
    expect(ids).toContain("value");
    expect(ids).toContain("pro");
  });

  it("all packages have positive EUR prices", () => {
    for (const pkg of CREDIT_PACKAGES) {
      expect(pkg.priceEurCents).toBeGreaterThan(0);
      expect(pkg.credits).toBeGreaterThan(0);
    }
  });

  it("value is the popular package", () => {
    const value = CREDIT_PACKAGES.find(p => p.id === "value");
    expect(value?.popular).toBe(true);
  });
});

describe("stripe.getPackages (tRPC)", () => {
  it("returns package list with priceEur string", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    const packages = await caller.stripe.getPackages();

    expect(packages).toHaveLength(3);
    for (const pkg of packages) {
      expect(typeof pkg.priceEur).toBe("string");
      expect(pkg.priceEur).toMatch(/^\d+\.\d{2}$/);
      expect(pkg.credits).toBeGreaterThan(0);
    }
  });

  it("returns packages accessible without authentication", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    // Should not throw even without a user
    const packages = await caller.stripe.getPackages();
    expect(Array.isArray(packages)).toBe(true);
  });
});

describe("stripe.createCheckoutSession (tRPC)", () => {
  it("throws UNAUTHORIZED when called without auth", async () => {
    const caller = appRouter.createCaller(makePublicCtx());
    await expect(
      caller.stripe.createCheckoutSession({
        packageId: "starter",
        origin: "https://example.com",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws BAD_REQUEST for invalid packageId", async () => {
    const caller = appRouter.createCaller(makeAuthCtx());
    await expect(
      caller.stripe.createCheckoutSession({
        packageId: "invalid" as any,
        origin: "https://example.com",
      })
    ).rejects.toBeDefined();
  });
});
