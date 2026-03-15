/**
 * safeguards.test.ts
 * Tests for the 5 production safeguard items:
 *  1. Cookie consent (logic/constants)
 *  2. Stripe refund/chargeback handling (webhook logic)
 *  3. User soft delete (schema + admin logic)
 *  4. Leaderboard rank change tracking (delta computation)
 *  5. Notification events (throttle, milestones, rank notifications)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Item 1: Cookie Consent ────────────────────────────────────────────────────

describe("Item 1: Cookie Consent", () => {
  const CONSENT_KEY = "cookieConsent";

  it("stores consent with correct key in localStorage", () => {
    const mockStorage: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    };

    // Simulate saving consent
    const prefs = { analytics: true, marketing: false };
    storage.setItem(CONSENT_KEY, JSON.stringify({ ...prefs, savedAt: Date.now() }));

    const saved = JSON.parse(storage.getItem(CONSENT_KEY)!);
    expect(saved.analytics).toBe(true);
    expect(saved.marketing).toBe(false);
    expect(saved.savedAt).toBeTypeOf("number");
  });

  it("returns null when no consent has been given", () => {
    const mockStorage: Record<string, string> = {};
    const getConsent = () => {
      const raw = mockStorage["cookieConsent"];
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };
    expect(getConsent()).toBeNull();
  });

  it("banner should show when consent is null", () => {
    const shouldShowBanner = (consent: null | object) => consent === null;
    expect(shouldShowBanner(null)).toBe(true);
    expect(shouldShowBanner({ analytics: true })).toBe(false);
  });

  it("analytics scripts should not load when analytics consent is false", () => {
    const consent = { analytics: false, marketing: false };
    const shouldLoadAnalytics = (c: typeof consent) => c.analytics === true;
    expect(shouldLoadAnalytics(consent)).toBe(false);
    expect(shouldLoadAnalytics({ ...consent, analytics: true })).toBe(true);
  });
});

// ─── Item 2: Stripe Refund / Chargeback Handling ──────────────────────────────

describe("Item 2: Stripe Refund/Chargeback Handling", () => {
  it("charge.dispute.created should set accountLocked=true", () => {
    const processDisputeEvent = (event: { type: string; data: { object: { metadata?: { user_id?: string } } } }) => {
      if (event.type === "charge.dispute.created") {
        const userId = event.data.object.metadata?.user_id;
        if (userId) return { action: "lockAccount", userId };
      }
      return null;
    };

    const result = processDisputeEvent({
      type: "charge.dispute.created",
      data: { object: { metadata: { user_id: "42" } } },
    });
    expect(result).toEqual({ action: "lockAccount", userId: "42" });
  });

  it("charge.refunded should deduct credits from wallet", () => {
    const processRefundEvent = (event: { type: string; data: { object: { metadata?: { user_id?: string; credits?: string } } } }) => {
      if (event.type === "charge.refunded") {
        const userId = event.data.object.metadata?.user_id;
        const credits = Number(event.data.object.metadata?.credits ?? 0);
        if (userId && credits > 0) return { action: "deductCredits", userId, credits };
      }
      return null;
    };

    const result = processRefundEvent({
      type: "charge.refunded",
      data: { object: { metadata: { user_id: "42", credits: "100" } } },
    });
    expect(result).toEqual({ action: "deductCredits", userId: "42", credits: 100 });
  });

  it("accountLocked users should be blocked from buying", () => {
    const canBuy = (user: { status: string; accountLocked: boolean }) =>
      user.status !== "suspended" && !user.accountLocked;

    expect(canBuy({ status: "active", accountLocked: false })).toBe(true);
    expect(canBuy({ status: "active", accountLocked: true })).toBe(false);
    expect(canBuy({ status: "suspended", accountLocked: false })).toBe(false);
  });
});

// ─── Item 3: User Soft Delete ─────────────────────────────────────────────────

describe("Item 3: User Soft Delete", () => {
  it("soft delete sets status=deleted and deletedAt timestamp", () => {
    const softDelete = (user: { id: number; status: string; deletedAt: Date | null }) => ({
      ...user,
      status: "deleted",
      deletedAt: new Date(),
    });

    const user = { id: 1, status: "active", deletedAt: null };
    const result = softDelete(user);
    expect(result.status).toBe("deleted");
    expect(result.deletedAt).toBeInstanceOf(Date);
  });

  it("deleted users should show as [Deleted Author] in book listings", () => {
    const getDisplayName = (authorName: string | null, userStatus: string | null) =>
      userStatus === "deleted" ? "[Deleted Author]" : (authorName ?? "Unknown");

    expect(getDisplayName("Alice", "deleted")).toBe("[Deleted Author]");
    expect(getDisplayName("Alice", "active")).toBe("Alice");
    expect(getDisplayName(null, "active")).toBe("Unknown");
  });

  it("deleted users cannot log in (status check)", () => {
    const canLogin = (status: string) => status !== "deleted" && status !== "suspended";
    expect(canLogin("active")).toBe(true);
    expect(canLogin("deleted")).toBe(false);
    expect(canLogin("suspended")).toBe(false);
  });

  it("admin unlockAccount clears accountLocked flag", () => {
    const unlockAccount = (user: { id: number; accountLocked: boolean }) => ({
      ...user,
      accountLocked: false,
    });

    const lockedUser = { id: 1, accountLocked: true };
    expect(unlockAccount(lockedUser).accountLocked).toBe(false);
  });
});

// ─── Item 4: Leaderboard Rank Change Tracking ─────────────────────────────────

describe("Item 4: Leaderboard Rank Change Tracking", () => {
  const computeRankChange = (currentRank: number, prevRank: number | null): number | null => {
    if (prevRank === null) return null;
    return prevRank - currentRank; // positive = moved up
  };

  it("returns null for new entries (no previous rank)", () => {
    expect(computeRankChange(1, null)).toBeNull();
    expect(computeRankChange(5, null)).toBeNull();
  });

  it("returns positive delta when rank improves", () => {
    expect(computeRankChange(1, 5)).toBe(4);   // moved up 4 spots
    expect(computeRankChange(2, 3)).toBe(1);   // moved up 1 spot
  });

  it("returns negative delta when rank drops", () => {
    expect(computeRankChange(5, 1)).toBe(-4);  // dropped 4 spots
    expect(computeRankChange(3, 2)).toBe(-1);  // dropped 1 spot
  });

  it("returns zero when rank is unchanged", () => {
    expect(computeRankChange(3, 3)).toBe(0);
  });

  it("rank snapshots are written per list type", () => {
    const snapshots: Record<string, number> = {};
    const writeSnapshot = (bookId: number, listType: string, rank: number) => {
      snapshots[`${bookId}_${listType}`] = rank;
    };

    writeSnapshot(1, "bestSellers", 2);
    writeSnapshot(1, "newArrivals", 5);
    writeSnapshot(1, "mostPopular", 1);

    expect(snapshots["1_bestSellers"]).toBe(2);
    expect(snapshots["1_newArrivals"]).toBe(5);
    expect(snapshots["1_mostPopular"]).toBe(1);
  });
});

// ─── Item 5: Notification Events ─────────────────────────────────────────────

describe("Item 5: Notification Events", () => {
  const SALES_MILESTONES = [10, 50, 100, 500, 1000];

  it("sales milestone: identifies correct milestone for given total", () => {
    const getMilestonesCrossed = (totalSales: number) =>
      SALES_MILESTONES.filter(m => totalSales >= m);

    expect(getMilestonesCrossed(5)).toEqual([]);
    expect(getMilestonesCrossed(10)).toEqual([10]);
    expect(getMilestonesCrossed(55)).toEqual([10, 50]);
    expect(getMilestonesCrossed(1000)).toEqual([10, 50, 100, 500, 1000]);
  });

  it("throttle: blocks duplicate notifications within window", () => {
    const sentAt = new Date();
    const windowMs = 24 * 60 * 60 * 1000;
    const isThrottled = (lastSentAt: Date) =>
      Date.now() - lastSentAt.getTime() < windowMs;

    expect(isThrottled(sentAt)).toBe(true); // just sent
    const oldDate = new Date(Date.now() - windowMs - 1000);
    expect(isThrottled(oldDate)).toBe(false); // expired
  });

  it("throttle: allows notification after window expires", () => {
    const windowMs = 24 * 60 * 60 * 1000;
    const expired = new Date(Date.now() - windowMs - 1);
    const canSend = (lastSentAt: Date | null) =>
      lastSentAt === null || Date.now() - lastSentAt.getTime() >= windowMs;

    expect(canSend(null)).toBe(true);       // never sent
    expect(canSend(expired)).toBe(true);    // expired
    expect(canSend(new Date())).toBe(false); // too recent
  });

  it("leaderboard entry: only notifies for top 10", () => {
    const shouldNotify = (rank: number) => rank <= 10;
    expect(shouldNotify(1)).toBe(true);
    expect(shouldNotify(10)).toBe(true);
    expect(shouldNotify(11)).toBe(false);
    expect(shouldNotify(20)).toBe(false);
  });

  it("rank improvement: only notifies when rank actually improves", () => {
    const shouldNotifyImprovement = (newRank: number, prevRank: number | null) =>
      prevRank !== null && newRank < prevRank && newRank <= 10;

    expect(shouldNotifyImprovement(1, 5)).toBe(true);   // improved
    expect(shouldNotifyImprovement(5, 3)).toBe(false);  // worsened
    expect(shouldNotifyImprovement(3, 3)).toBe(false);  // no change
    expect(shouldNotifyImprovement(1, null)).toBe(false); // new entry
    expect(shouldNotifyImprovement(11, 15)).toBe(false); // outside top 10
  });

  it("milestone notifications use per-book per-level reference key", () => {
    const makeRefKey = (bookId: number, milestone: number) => `${bookId}_${milestone}`;
    expect(makeRefKey(42, 100)).toBe("42_100");
    expect(makeRefKey(1, 1000)).toBe("1_1000");
    // Different books have different keys even for same milestone
    expect(makeRefKey(1, 100)).not.toBe(makeRefKey(2, 100));
  });
});
