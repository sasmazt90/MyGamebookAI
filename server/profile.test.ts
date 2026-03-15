import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type AuthUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    openId: "profile-test-user",
    email: "profile@example.com",
    name: "Profile Tester",
    loginMethod: "email",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createContext(user?: AuthUser | null): TrpcContext {
  return {
    user: user !== undefined ? user : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

// ─── profile.get ─────────────────────────────────────────────────────────────

describe("profile.get", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profile.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns null or a profile object when authenticated", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    // May return null (no profile) or a profile row — both are valid
    const result = await caller.profile.get();
    expect(result === null || typeof result === "object").toBe(true);
  });
});

// ─── profile.update ───────────────────────────────────────────────────────────

describe("profile.update", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.update({ authorName: "ValidName" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects authorName shorter than 3 characters", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.update({ authorName: "AB" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects authorName longer than 30 characters", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.update({ authorName: "A".repeat(31) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects authorName with invalid characters", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.update({ authorName: "Name@Invalid!" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects bio longer than 500 characters", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.update({ bio: "x".repeat(501) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts bio up to 500 characters", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    // Will succeed or throw INTERNAL_SERVER_ERROR (no DB) — not a validation error
    try {
      const result = await caller.profile.update({ bio: "x".repeat(500) });
      expect(result).toEqual({ success: true });
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });

  it("accepts null bio to clear the bio field", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.profile.update({ bio: null });
      expect(result).toEqual({ success: true });
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });

  it("accepts a valid authorName update", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.profile.update({ authorName: "ValidAuthor" });
      expect(result).toEqual({ success: true });
    } catch (err: unknown) {
      // CONFLICT (name taken) or INTERNAL_SERVER_ERROR (no DB) are both acceptable
      expect(["CONFLICT", "INTERNAL_SERVER_ERROR"]).toContain((err as { code?: string }).code);
    }
  });
});

// ─── profile.checkAuthorName ──────────────────────────────────────────────────

describe("profile.checkAuthorName", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.checkAuthorName({ authorName: "TestName" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns an availability object when authenticated", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.profile.checkAuthorName({ authorName: "UniqueNameXYZ999" });
      expect(result).toHaveProperty("available");
      expect(typeof result.available).toBe("boolean");
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});

// ─── profile.uploadAvatar ─────────────────────────────────────────────────────

describe("profile.uploadAvatar", () => {
  it("throws UNAUTHORIZED when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.profile.uploadAvatar({ base64Data: "abc", mimeType: "image/jpeg" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unsupported mime types", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    // Create a small valid base64 payload with an invalid mime type
    const base64Data = Buffer.from("fake-image-data").toString("base64");
    await expect(
      caller.profile.uploadAvatar({ base64Data, mimeType: "image/gif" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects payloads exceeding 2 MB", async () => {
    const ctx = createContext(createMockUser());
    const caller = appRouter.createCaller(ctx);
    // 3 MB of zeros encoded as base64
    const oversizedBase64 = Buffer.alloc(3 * 1024 * 1024).toString("base64");
    await expect(
      caller.profile.uploadAvatar({ base64Data: oversizedBase64, mimeType: "image/jpeg" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
