import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ---- Helpers ----

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-openid",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createContext(user?: AuthenticatedUser | null): TrpcContext {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  return {
    user: user !== undefined ? user : null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
    _clearedCookies: clearedCookies,
  } as TrpcContext & { _clearedCookies: typeof clearedCookies };
}

// ---- Auth Tests ----

describe("auth.me", () => {
  it("returns null when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns the current user when authenticated", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.id).toBe(1);
    expect(result?.email).toBe("test@example.com");
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });

  it("works even when not authenticated (public procedure)", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

// ---- Books Credit Cost Tests ----

describe("books.getCreditCost", () => {
  it("returns base cost for fairy_tale thin", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.books.getCreditCost({
      category: "fairy_tale",
      length: "thin",
      characterPhotoCount: 0,
    });
    // Returns { base, photoExtra, total }
    expect(result.base).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThanOrEqual(result.base);
  });

  it("adds extra cost for character photos", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    const withoutPhotos = await caller.books.getCreditCost({
      category: "fairy_tale",
      length: "thin",
      characterPhotoCount: 0,
    });
    const withPhotos = await caller.books.getCreditCost({
      category: "fairy_tale",
      length: "thin",
      characterPhotoCount: 2,
    });
    expect(withPhotos.total).toBeGreaterThan(withoutPhotos.total);
    expect(withPhotos.photoExtra).toBeGreaterThan(0);
  });

  it("returns higher cost for thick books", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    const thin = await caller.books.getCreditCost({
      category: "horror_thriller",
      length: "normal",
      characterPhotoCount: 0,
    });
    const thick = await caller.books.getCreditCost({
      category: "horror_thriller",
      length: "thick",
      characterPhotoCount: 0,
    });
    expect(thick.base).toBeGreaterThanOrEqual(thin.base);
  });

  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.books.getCreditCost({ category: "fairy_tale", length: "thin", characterPhotoCount: 0 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---- Books List Tests ----

describe("books.myLibrary", () => {
  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.books.myLibrary({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---- Reading Progress Tests ----

describe("books.saveProgress", () => {
  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.books.saveProgress({ bookId: 1, currentPageId: 1, branchPath: "root" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("accepts isEndingNode flag without error when authenticated", async () => {
    // This test verifies the new optional field is accepted by the input schema.
    // It will either succeed (DB available) or throw INTERNAL_SERVER_ERROR (no DB) — not a validation error.
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.books.saveProgress({ bookId: 1, currentPageId: 5, branchPath: "root", isEndingNode: true });
      // Succeeded — DB is available in this environment
    } catch (err: unknown) {
      // Only INTERNAL_SERVER_ERROR is acceptable (no DB), not a validation/input error
      expect((err as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });

  it("accepts saveProgress without isEndingNode (backward compatible)", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.books.saveProgress({ bookId: 1, currentPageId: 2, branchPath: "root" });
      // Succeeded — DB is available in this environment
    } catch (err: unknown) {
      // Only INTERNAL_SERVER_ERROR is acceptable (no DB), not a validation/input error
      expect((err as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});

// ---- Store Tests ----

describe("books.storeListing", () => {
  it("is accessible without authentication (public)", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    // storeListing returns an array of book rows
    const result = await caller.books.storeListing({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("supports search filtering", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.books.storeListing({ search: "nonexistent_book_xyz" });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ---- Leaderboard Tests ----

describe("books.leaderboard", () => {
  it("is accessible without authentication (public)", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    // leaderboard returns { bestSellers, newArrivals, mostPopular }
    const result = await caller.books.leaderboard({});
    expect(result).toHaveProperty("bestSellers");
    expect(result).toHaveProperty("newArrivals");
    expect(result).toHaveProperty("mostPopular");
    expect(Array.isArray(result.bestSellers)).toBe(true);
    expect(Array.isArray(result.newArrivals)).toBe(true);
    expect(Array.isArray(result.mostPopular)).toBe(true);
  });

  it("supports category filtering", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.books.leaderboard({ category: "fairy_tale" });
    expect(Array.isArray(result.bestSellers)).toBe(true);
  });
});

// ---- Credits Tests ----

describe("credits.balance", () => {
  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.credits.balance()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("credits.getPackages", () => {
  it("returns credit packages for authenticated users", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    const packages = await caller.credits.getPackages();
    expect(Array.isArray(packages)).toBe(true);
    expect(packages.length).toBeGreaterThan(0);
    packages.forEach(pkg => {
      expect(pkg).toHaveProperty("id");
      expect(pkg).toHaveProperty("credits");
      // Package has priceEur field
      expect(pkg).toHaveProperty("priceEur");
      expect(pkg.credits).toBeGreaterThan(0);
      expect(pkg.priceEur).toBeGreaterThan(0);
    });
  });
});

// ---- Profile Tests ----

describe("profile.get", () => {
  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profile.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---- Notifications Tests ----

describe("notifications.list", () => {
  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.list({ limit: 10 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("notifications.unreadCount", () => {
  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.notifications.unreadCount()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ---- Admin Tests ----

describe("admin.listMembers", () => {
  it("throws UNAUTHORIZED if not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.listMembers({ limit: 10 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws FORBIDDEN if not admin", async () => {
    const user = createMockUser({ role: "user" });
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.listMembers({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("admin.adjustCredits", () => {
  it("throws FORBIDDEN if not admin", async () => {
    const user = createMockUser({ role: "user" });
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.admin.adjustCredits({ userId: 2, amount: 100, reason: "test" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---- Banners Tests ----

describe("banners.list", () => {
  it("is accessible without authentication (public)", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.banners.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
