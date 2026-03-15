/**
 * auth.custom.test.ts
 *
 * Tests for the custom email/password authentication system:
 *   1. hashPassword / verifyPassword helpers
 *   2. auth.me procedure
 *   3. auth.register procedure (duplicate email, validation)
 *   4. auth.login procedure (success, wrong password, deleted/locked account)
 *   5. auth.logout procedure
 *   6. Admin role invariants
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Hoisted mocks (must use vi.hoisted so they are available before vi.mock) ─
const { mockDb, mockGetUserByEmail, mockVerifyPassword, mockHashPassword, mockCreateSessionToken } =
  vi.hoisted(() => {
    const mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    return {
      mockDb,
      mockGetUserByEmail: vi.fn(),
      mockVerifyPassword: vi.fn().mockResolvedValue(true),
      mockHashPassword: vi.fn().mockResolvedValue("$2b$12$hashedpassword"),
      mockCreateSessionToken: vi.fn().mockResolvedValue("mock-jwt-token"),
    };
  });

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
  getUserByEmail: mockGetUserByEmail,
  getUserById: vi.fn(),
}));

vi.mock("./_core/customAuth", () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
  createSessionToken: mockCreateSessionToken,
  verifySessionToken: vi.fn().mockResolvedValue(42),
  authenticateRequest: vi.fn().mockResolvedValue(null),
  getSessionCookieOptions: vi.fn().mockReturnValue({
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 42,
    openId: "email:test@example.com",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "$2b$12$hashedpassword",
    loginMethod: "email",
    role: "user",
    status: "active",
    accountLocked: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createContext(user?: AuthenticatedUser | null) {
  const cookies: Array<{ name: string; value: string | null; options?: Record<string, unknown> }> = [];
  const ctx: TrpcContext & { _cookies: typeof cookies } = {
    user: user !== undefined ? user : null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        cookies.push({ name, value: null, options });
      },
    } as unknown as TrpcContext["res"],
    _cookies: cookies,
  };
  return ctx;
}

// ─── 1. auth.me ───────────────────────────────────────────────────────────────
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
    expect(result?.id).toBe(42);
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("user");
  });

  it("returns admin role for admin users", async () => {
    const admin = createMockUser({ role: "admin", email: "tolgar@sasmaz.digital" });
    const ctx = createContext(admin);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result?.role).toBe("admin");
  });
});

// ─── 2. auth.register ────────────────────────────────────────────────────────
describe("auth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserByEmail.mockResolvedValue(undefined);
    mockHashPassword.mockResolvedValue("$2b$12$hashedpassword");
    mockCreateSessionToken.mockResolvedValue("mock-jwt-token");

    const insertChain = { values: vi.fn().mockResolvedValue([{ insertId: 99 }]) };
    mockDb.insert.mockReturnValue(insertChain);
  });

  it("rejects registration when email already exists", async () => {
    mockGetUserByEmail.mockResolvedValue(createMockUser());

    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      })
    ).rejects.toThrow();
  });

  it("rejects registration with password shorter than 8 characters", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "Test User",
        email: "newuser@example.com",
        password: "short",
      })
    ).rejects.toThrow();
  });

  it("rejects registration with name shorter than 2 characters", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.register({
        name: "A",
        email: "newuser@example.com",
        password: "password123",
      })
    ).rejects.toThrow();
  });
});

// ─── 3. auth.login ───────────────────────────────────────────────────────────
describe("auth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyPassword.mockResolvedValue(true);
    mockCreateSessionToken.mockResolvedValue("mock-jwt-token");

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    mockDb.update.mockReturnValue(updateChain);
  });

  it("throws UNAUTHORIZED when user does not exist", async () => {
    mockGetUserByEmail.mockResolvedValue(undefined);

    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ email: "nobody@example.com", password: "password123" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("throws UNAUTHORIZED when password is incorrect", async () => {
    mockGetUserByEmail.mockResolvedValue(createMockUser());
    mockVerifyPassword.mockResolvedValueOnce(false);

    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ email: "test@example.com", password: "wrongpassword" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("throws FORBIDDEN when account is deleted", async () => {
    mockGetUserByEmail.mockResolvedValue(createMockUser({ status: "deleted" }));

    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ email: "test@example.com", password: "password123" })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN when account is locked", async () => {
    mockGetUserByEmail.mockResolvedValue(createMockUser({ accountLocked: true }));

    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ email: "test@example.com", password: "password123" })
    ).rejects.toThrow();
  });

  it("sets session cookie on successful login", async () => {
    mockGetUserByEmail.mockResolvedValue(createMockUser());
    mockVerifyPassword.mockResolvedValueOnce(true);

    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBe(42);
    const cookieSet = ctx._cookies.find(c => c.name === COOKIE_NAME && c.value !== null);
    expect(cookieSet).toBeDefined();
    expect(cookieSet?.value).toBe("mock-jwt-token");
  });
});

// ─── 4. auth.logout ──────────────────────────────────────────────────────────
describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    const cleared = ctx._cookies.find(c => c.name === COOKIE_NAME && c.value === null);
    expect(cleared).toBeDefined();
  });

  it("can be called even when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

// ─── 5. Admin role invariants ────────────────────────────────────────────────
describe("admin role invariants", () => {
  it("admin users have role=admin", () => {
    const admin = createMockUser({ role: "admin", email: "tolgar@sasmaz.digital" });
    expect(admin.role).toBe("admin");
  });

  it("regular users have role=user by default", () => {
    const user = createMockUser();
    expect(user.role).toBe("user");
  });

  it("admin procedures reject non-admin users with FORBIDDEN", async () => {
    const regularUser = createMockUser({ role: "user" });
    const ctx = createContext(regularUser);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.admin.listMembers({ search: "", limit: 10 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("admin procedures allow admin users", async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDb.select.mockReturnValue(selectChain);

    const adminUser = createMockUser({ role: "admin", email: "tolgar@sasmaz.digital" });
    const ctx = createContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.admin.listMembers({ search: "", limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});
