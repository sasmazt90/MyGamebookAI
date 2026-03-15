/**
 * generationWorker.ts
 *
 * Lease-based generation job worker.
 *
 * Design:
 *  - Each worker instance has a unique workerId (nanoid).
 *  - To claim a job the worker does an atomic UPDATE … WHERE status='queued'
 *    AND (lockedAt IS NULL OR leaseExpiresAt < now). This prevents two workers
 *    from picking the same job simultaneously.
 *  - The lease expires after LEASE_DURATION_MS. If a worker crashes mid-job the
 *    next poll will reclaim the expired lease (stuck job recovery).
 *  - After MAX_ATTEMPTS failures the job is permanently marked failed and will
 *    not be retried automatically (the user can still click Retry in the UI).
 *
 * Usage (standalone process):
 *   node -r tsx/cjs server/generationWorker.ts
 *
 * Usage (embedded, called from books.create / retryGeneration):
 *   import { claimAndRunJob } from "./generationWorker";
 *   await claimAndRunJob(jobId, bookData, db);
 */

import { and, eq, lt, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generationJobs, books, bookCharacters } from "../drizzle/schema";
import { getDb } from "./db";
import type { MySql2Database } from "drizzle-orm/mysql2";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = MySql2Database<any>;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Lease duration: 10 minutes. If a worker holds a job longer than this it is
 *  considered stuck and another worker may reclaim it. */
export const LEASE_DURATION_MS = 10 * 60 * 1000;

/** Maximum processing attempts before a job is permanently failed. */
export const MAX_ATTEMPTS = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookGenerationData {
  title: string;
  category: string;
  length: string;
  description: string;
  language: string;
  characters: { name: string; photoUrl?: string }[];
  uploadedKeys?: string[];
}

// ─── Lease helpers ────────────────────────────────────────────────────────────

/**
 * Attempt to atomically claim a specific job by ID.
 *
 * Returns true if the claim succeeded (this worker now owns the lease),
 * false if another worker already holds a valid lease.
 *
 * This is the core double-processing prevention mechanism:
 *   UPDATE generationJobs
 *   SET    status='generating', lockedAt=now, lockedBy=workerId,
 *          leaseExpiresAt=now+LEASE, attempts=attempts+1, startedAt=now
 *   WHERE  id=jobId
 *     AND  (lockedAt IS NULL OR leaseExpiresAt < now)
 *     AND  status IN ('queued', 'generating')   -- allow reclaim of stuck jobs
 *     AND  attempts < MAX_ATTEMPTS
 */
export async function claimJobLease(
  jobId: number,
  workerId: string,
  db: AnyDb
): Promise<boolean> {
  const now = new Date();
  const leaseExpires = new Date(now.getTime() + LEASE_DURATION_MS);

  const result = await db
    .update(generationJobs)
    .set({
      status: "generating",
      lockedAt: now,
      lockedBy: workerId,
      leaseExpiresAt: leaseExpires,
      startedAt: now,
      attempts: sql`attempts + 1`,
    })
    .where(
      and(
        eq(generationJobs.id, jobId),
        // Only claim if: no lock OR lease has expired (stuck job recovery)
        or(
          isNull(generationJobs.lockedAt),
          lt(generationJobs.leaseExpiresAt, now)
        ),
        // Only claim queued or stuck-generating jobs
        or(
          eq(generationJobs.status, "queued"),
          eq(generationJobs.status, "generating")
        ),
        // Respect maxAttempts
        lt(generationJobs.attempts, MAX_ATTEMPTS)
      )
    );

  // MySQL UPDATE returns [ResultSetHeader, ...]; affectedRows is on the first element
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const header = (result as any)?.[0] ?? result;
  const affected: number = header?.affectedRows ?? header?.rowsAffected ?? 0;
  return affected > 0;
}

/**
 * Release the lease on success: mark completed, clear lock fields.
 */
export async function releaseJobSuccess(
  jobId: number,
  db: AnyDb
): Promise<void> {
  await db
    .update(generationJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
    })
    .where(eq(generationJobs.id, jobId));
}

/**
 * Release the lease on failure.
 *
 * If attempts < MAX_ATTEMPTS the job is reset to 'queued' so another worker
 * (or the user via Retry) can pick it up. If attempts >= MAX_ATTEMPTS it is
 * permanently marked 'failed'.
 */
export async function releaseJobFailure(
  jobId: number,
  errorMessage: string,
  db: AnyDb
): Promise<void> {
  const [job] = await db
    .select({ attempts: generationJobs.attempts })
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);

  const attempts = job?.attempts ?? MAX_ATTEMPTS;
  const permanent = attempts >= MAX_ATTEMPTS;

  await db
    .update(generationJobs)
    .set({
      status: permanent ? "failed" : "queued",
      errorMessage: permanent ? errorMessage : null,
      completedAt: permanent ? new Date() : null,
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
    })
    .where(eq(generationJobs.id, jobId));
}

// ─── Main entry point used by books.create / retryGeneration ─────────────────

/**
 * Claim a specific job by ID and run the generation pipeline.
 *
 * Called fire-and-forget from tRPC procedures:
 *   claimAndRunJob(jobId, bookData, db, generateFn).catch(console.error);
 *
 * @param jobId         The generationJobs row to claim
 * @param bookId        The books row being generated
 * @param bookData      Data passed to the generation function
 * @param db            Active DB connection
 * @param generateFn    The actual AI generation function (injected to keep
 *                      this module free of direct LLM imports — preserves the
 *                      no-runtime-AI test invariant for non-AI code paths)
 */
export async function claimAndRunJob(
  jobId: number,
  bookId: number,
  bookData: BookGenerationData,
  db: AnyDb,
  generateFn: (bookId: number, data: BookGenerationData) => Promise<void>
): Promise<void> {
  const workerId = `worker-${nanoid(8)}`;

  // Attempt to claim the lease
  const claimed = await claimJobLease(jobId, workerId, db);
  if (!claimed) {
    // Another worker already holds a valid lease — skip silently
    console.log(`[Worker ${workerId}] Job ${jobId} already claimed by another worker, skipping.`);
    return;
  }

  console.log(`[Worker ${workerId}] Claimed job ${jobId} for book ${bookId}`);

  try {
    await generateFn(bookId, bookData);

    // Verify the book actually reached 'ready' state
    const [finalBook] = await db
      .select({ status: books.status })
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);

    if (finalBook?.status === "ready") {
      await releaseJobSuccess(jobId, db);
      console.log(`[Worker ${workerId}] Job ${jobId} completed successfully.`);
    } else {
      await releaseJobFailure(jobId, "Generation finished but book did not reach ready state.", db);
      console.warn(`[Worker ${workerId}] Job ${jobId} finished but book status is '${finalBook?.status}'.`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Worker ${workerId}] Job ${jobId} failed: ${msg}`);
    await releaseJobFailure(jobId, msg, db).catch(console.error);
  }
}

// ─── Standalone worker loop (for separate process deployment) ─────────────────

/**
 * Poll for the next claimable job and process it.
 *
 * Returns true if a job was found and processed, false if the queue was empty.
 * Used by the standalone worker process and can be called from a cron job.
 */
export async function processNextQueuedJob(
  generateFn: (bookId: number, data: BookGenerationData) => Promise<void>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const now = new Date();

  // Find the oldest claimable job:
  //   status='queued' with no lock, OR
  //   status='generating' with an expired lease (stuck job recovery)
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        or(
          eq(generationJobs.status, "queued"),
          and(
            eq(generationJobs.status, "generating"),
            lt(generationJobs.leaseExpiresAt, now)
          )
        ),
        lt(generationJobs.attempts, MAX_ATTEMPTS)
      )
    )
    .orderBy(generationJobs.createdAt)
    .limit(1);

  if (!job) return false;

  // Fetch book data for generation
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, job.bookId))
    .limit(1);

  if (!book) {
    await db
      .update(generationJobs)
      .set({ status: "failed", errorMessage: "Book record not found", completedAt: new Date() })
      .where(eq(generationJobs.id, job.id));
    return true;
  }

  const chars = await db
    .select()
    .from(bookCharacters)
    .where(eq(bookCharacters.bookId, book.id));

  const bookData: BookGenerationData = {
    title: book.title,
    category: book.category,
    length: book.length,
    description: book.description ?? "",
    language: book.bookLanguage,
    characters: chars.map(c => ({ name: c.name, photoUrl: c.photoUrl ?? undefined })),
  };

  await claimAndRunJob(job.id, book.id, bookData, db, generateFn);
  return true;
}
