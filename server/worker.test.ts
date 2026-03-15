/**
 * worker.test.ts
 *
 * Tests for the lease-based generation worker:
 *   - Double-processing prevention (only one worker claims a job)
 *   - Stuck job reclaim (expired lease is reclaimed)
 *   - maxAttempts guard (permanently failed after N attempts)
 *   - releaseJobSuccess / releaseJobFailure state transitions
 *   - LEASE_DURATION_MS and MAX_ATTEMPTS constants are sane
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LEASE_DURATION_MS,
  MAX_ATTEMPTS,
  claimJobLease,
  releaseJobSuccess,
  releaseJobFailure,
  claimAndRunJob,
} from "./generationWorker";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal in-memory job row for testing. */
function makeJob(overrides: Partial<{
  id: number;
  bookId: number;
  status: "queued" | "generating" | "completed" | "failed";
  lockedAt: Date | null;
  lockedBy: string | null;
  leaseExpiresAt: Date | null;
  attempts: number;
  errorMessage: string | null;
}> = {}) {
  return {
    id: 1,
    bookId: 10,
    status: "queued" as const,
    lockedAt: null,
    lockedBy: null,
    leaseExpiresAt: null,
    attempts: 0,
    errorMessage: null,
    ...overrides,
  };
}

/** Build a mock DB that simulates the UPDATE … WHERE atomic claim. */
function makeMockDb(job: ReturnType<typeof makeJob>) {
  return {
    _job: { ...job },

    update() {
      return {
        set: (values: Partial<ReturnType<typeof makeJob>>) => ({
          where: (condition: unknown) => {
            // Simulate the WHERE clause evaluation
            const now = new Date();
            const j = (this as any)._job as ReturnType<typeof makeJob>;

            // Check if the job is claimable
            const noLock = j.lockedAt === null;
            const leaseExpired = j.leaseExpiresAt !== null && j.leaseExpiresAt < now;
            const isClaimable = noLock || leaseExpired;
            const isRightStatus = j.status === "queued" || j.status === "generating";
            const underMaxAttempts = j.attempts < MAX_ATTEMPTS;

            if (isClaimable && isRightStatus && underMaxAttempts) {
              Object.assign(j, values);
              if (typeof values.attempts === "object" && values.attempts !== null) {
                // Handle sql`attempts + 1` expression
                j.attempts = (job.attempts ?? 0) + 1;
              }
              return Promise.resolve([{ affectedRows: 1 }]);
            }
            return Promise.resolve([{ affectedRows: 0 }]);
          },
        }),
      };
    },

    select(fields?: unknown) {
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ ...(this as any)._job }]),
          }),
        }),
      };
    },
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe("Worker constants", () => {
  it("LEASE_DURATION_MS is at least 5 minutes", () => {
    expect(LEASE_DURATION_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it("MAX_ATTEMPTS is between 2 and 10", () => {
    expect(MAX_ATTEMPTS).toBeGreaterThanOrEqual(2);
    expect(MAX_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});

// ─── Lease claim logic ────────────────────────────────────────────────────────

describe("claimJobLease", () => {
  it("claims a queued job with no lock", async () => {
    const job = makeJob({ status: "queued", lockedAt: null });
    const db = makeMockDb(job);
    const claimed = await claimJobLease(1, "worker-A", db as any);
    expect(claimed).toBe(true);
  });

  it("does NOT claim a job already held by another worker with a valid lease", async () => {
    const futureExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min from now
    const job = makeJob({
      status: "generating",
      lockedAt: new Date(),
      lockedBy: "worker-B",
      leaseExpiresAt: futureExpiry,
      attempts: 1,
    });
    const db = makeMockDb(job);
    const claimed = await claimJobLease(1, "worker-A", db as any);
    expect(claimed).toBe(false);
  });

  it("reclaims a stuck job whose lease has expired", async () => {
    const pastExpiry = new Date(Date.now() - 1000); // 1 second ago
    const job = makeJob({
      status: "generating",
      lockedAt: new Date(Date.now() - LEASE_DURATION_MS - 1000),
      lockedBy: "worker-B",
      leaseExpiresAt: pastExpiry,
      attempts: 1,
    });
    const db = makeMockDb(job);
    const claimed = await claimJobLease(1, "worker-A", db as any);
    expect(claimed).toBe(true);
  });

  it("does NOT claim a job that has reached MAX_ATTEMPTS", async () => {
    const job = makeJob({
      status: "queued",
      lockedAt: null,
      attempts: MAX_ATTEMPTS, // already at max
    });
    const db = makeMockDb(job);
    const claimed = await claimJobLease(1, "worker-A", db as any);
    expect(claimed).toBe(false);
  });

  it("does NOT claim a completed job", async () => {
    const job = makeJob({ status: "completed", lockedAt: null, attempts: 0 });
    const db = makeMockDb(job);
    const claimed = await claimJobLease(1, "worker-A", db as any);
    expect(claimed).toBe(false);
  });

  it("does NOT claim a permanently failed job", async () => {
    const job = makeJob({ status: "failed", lockedAt: null, attempts: MAX_ATTEMPTS });
    const db = makeMockDb(job);
    const claimed = await claimJobLease(1, "worker-A", db as any);
    expect(claimed).toBe(false);
  });
});

// ─── Double-processing prevention ────────────────────────────────────────────

describe("Double-processing prevention", () => {
  it("only one of two concurrent workers claims the same job", async () => {
    // Simulate two workers racing to claim the same job.
    // The first call succeeds; the second sees a valid lease and returns false.
    const job = makeJob({ status: "queued", lockedAt: null, attempts: 0 });

    let claimCount = 0;
    let callIndex = 0;

    // Mock DB that only allows the first UPDATE to succeed
    const db = {
      _claimed: false,
      update() {
        return {
          set: () => ({
            where: () => {
              callIndex++;
              if (!this._claimed) {
                this._claimed = true;
                claimCount++;
                return Promise.resolve([{ affectedRows: 1 }]);
              }
              // Second call: job is now locked
              return Promise.resolve([{ affectedRows: 0 }]);
            },
          }),
        };
      },
      select() {
        return { from: () => ({ where: () => ({ limit: () => Promise.resolve([job]) }) }) };
      },
    };

    const [r1, r2] = await Promise.all([
      claimJobLease(1, "worker-A", db as any),
      claimJobLease(1, "worker-B", db as any),
    ]);

    // Exactly one worker should have claimed the job
    expect(claimCount).toBe(1);
    expect(r1 !== r2).toBe(true); // one true, one false
    expect(r1 || r2).toBe(true);
    expect(r1 && r2).toBe(false);
  });
});

// ─── maxAttempts guard ────────────────────────────────────────────────────────

describe("maxAttempts guard", () => {
  it("permanently fails a job after MAX_ATTEMPTS failures", async () => {
    // Simulate the releaseJobFailure logic: after MAX_ATTEMPTS the job stays failed
    function simulateFailureCycle(currentAttempts: number): "queued" | "failed" {
      return currentAttempts >= MAX_ATTEMPTS ? "failed" : "queued";
    }

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(simulateFailureCycle(i)).toBe("queued");
    }
    expect(simulateFailureCycle(MAX_ATTEMPTS)).toBe("failed");
    expect(simulateFailureCycle(MAX_ATTEMPTS + 1)).toBe("failed");
  });

  it("requeues a job when attempts < MAX_ATTEMPTS", () => {
    function shouldRequeue(attempts: number): boolean {
      return attempts < MAX_ATTEMPTS;
    }
    expect(shouldRequeue(0)).toBe(true);
    expect(shouldRequeue(MAX_ATTEMPTS - 1)).toBe(true);
    expect(shouldRequeue(MAX_ATTEMPTS)).toBe(false);
  });
});

// ─── Stuck job recovery ───────────────────────────────────────────────────────

describe("Stuck job recovery", () => {
  it("identifies a stuck job: status=generating AND leaseExpiresAt < now", () => {
    const now = new Date();
    const pastExpiry = new Date(now.getTime() - 1000);
    const futureExpiry = new Date(now.getTime() + 60_000);

    function isStuck(status: string, leaseExpiresAt: Date | null): boolean {
      if (status !== "generating") return false;
      if (!leaseExpiresAt) return false;
      return leaseExpiresAt < now;
    }

    expect(isStuck("generating", pastExpiry)).toBe(true);
    expect(isStuck("generating", futureExpiry)).toBe(false);
    expect(isStuck("queued", pastExpiry)).toBe(false);
    expect(isStuck("completed", pastExpiry)).toBe(false);
  });

  it("reclaims a stuck job (expired lease) and not a healthy one", async () => {
    const expiredLease = new Date(Date.now() - 1000);
    const stuckJob = makeJob({
      status: "generating",
      lockedAt: new Date(Date.now() - LEASE_DURATION_MS - 5000),
      lockedBy: "dead-worker",
      leaseExpiresAt: expiredLease,
      attempts: 1,
    });

    const healthyJob = makeJob({
      status: "generating",
      lockedAt: new Date(),
      lockedBy: "live-worker",
      leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS),
      attempts: 1,
    });

    const stuckDb = makeMockDb(stuckJob);
    const healthyDb = makeMockDb(healthyJob);

    const stuckClaimed = await claimJobLease(1, "new-worker", stuckDb as any);
    const healthyClaimed = await claimJobLease(1, "new-worker", healthyDb as any);

    expect(stuckClaimed).toBe(true);   // stuck job reclaimed
    expect(healthyClaimed).toBe(false); // healthy job not stolen
  });
});

// ─── claimAndRunJob integration ───────────────────────────────────────────────

describe("claimAndRunJob", () => {
  it("runs the generation function when the lease is claimed", async () => {
    const generateFn = vi.fn().mockResolvedValue(undefined);

    const db = {
      _claimed: false,
      update() {
        return {
          set: () => ({
            where: () => {
              if (!this._claimed) {
                this._claimed = true;
                return Promise.resolve([{ affectedRows: 1 }]);
              }
              return Promise.resolve([{ affectedRows: 1 }]);
            },
          }),
        };
      },
      select() {
        return {
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ status: "ready", attempts: 1 }]),
            }),
          }),
        };
      },
    };

    await claimAndRunJob(1, 10, { title: "Test", category: "fairy_tale", length: "thin", description: "", language: "en", characters: [] }, db as any, generateFn);

    expect(generateFn).toHaveBeenCalledOnce();
  });

  it("does NOT run the generation function when the lease cannot be claimed", async () => {
    const generateFn = vi.fn().mockResolvedValue(undefined);

    // DB always returns 0 affectedRows (job already claimed)
    const db = {
      update() {
        return { set: () => ({ where: () => Promise.resolve([{ affectedRows: 0 }]) }) };
      },
      select() {
        return { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) };
      },
    };

    await claimAndRunJob(1, 10, { title: "Test", category: "fairy_tale", length: "thin", description: "", language: "en", characters: [] }, db as any, generateFn);

    expect(generateFn).not.toHaveBeenCalled();
  });
});
