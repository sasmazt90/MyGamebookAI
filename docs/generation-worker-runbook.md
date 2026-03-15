# Generation Worker Operations

*Gamebook AI — Production Runbook*

---

## Overview

The **generation worker** is the process responsible for running the AI book-creation pipeline. When a user submits a new book, the tRPC `books.create` procedure immediately returns `{ status: "generating" }` and inserts a row into the `generationJobs` table. The worker then picks up that row, runs the pipeline (LLM story generation + image generation), and marks the job `completed` or `failed`.

The worker uses a **lease-based locking** mechanism to guarantee that no two processes ever generate the same book simultaneously, and that stuck jobs (e.g. from a crashed worker) are automatically reclaimed.

---

## Architecture

```
User → books.create (tRPC)
         │
         ├─ INSERT generationJobs (status=queued)
         ├─ INSERT books (status=generating)
         └─ claimAndRunJob() ← fire-and-forget
                │
                ├─ UPDATE generationJobs SET status=generating,
                │         lockedAt=now, leaseExpiresAt=now+10min,
                │         attempts=attempts+1
                │         WHERE status IN (queued, generating)
                │           AND (lockedAt IS NULL OR leaseExpiresAt < now)
                │           AND attempts < MAX_ATTEMPTS
                │
                ├─ generateBookContent() — LLM + image pipeline
                │
                ├─ SUCCESS → status=completed, clear lock
                └─ FAILURE → attempts < MAX_ATTEMPTS → status=queued (requeue)
                             attempts ≥ MAX_ATTEMPTS → status=failed (permanent)
```

| Constant | Value | Description |
|---|---|---|
| `LEASE_DURATION_MS` | 10 minutes | How long a worker holds a job before it is considered stuck |
| `MAX_ATTEMPTS` | 3 | Maximum processing attempts before permanent failure |

---

## Running Locally

The worker is **embedded** inside the main Express server process. When `books.create` is called, `claimAndRunJob()` is invoked as a fire-and-forget promise. No separate process is needed for local development.

To start the full stack locally:

```bash
pnpm dev
```

To manually trigger the standalone worker loop (useful for debugging):

```bash
node --import tsx/esm server/generationWorker.ts
```

> **Note:** The standalone loop requires `tsx` to be installed globally (`npm i -g tsx`).

---

## Environment Variables

All required variables are injected automatically by the Manus platform. No manual configuration is needed. The following table documents each variable for reference:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string used by the worker to read/write `generationJobs` |
| `BUILT_IN_FORGE_API_KEY` | Bearer token for the Manus LLM and image generation APIs |
| `BUILT_IN_FORGE_API_URL` | Base URL for the Manus built-in API hub |

---

## Monitoring Job Statuses

### Via the Admin Panel

Navigate to **Admin → Campaigns** (or any admin tab) and use the database panel in the Management UI to run:

```sql
SELECT id, bookId, status, attempts, errorMessage, lockedBy, leaseExpiresAt, createdAt, completedAt
FROM generationJobs
ORDER BY createdAt DESC
LIMIT 50;
```

### Status Reference

| Status | Meaning |
|---|---|
| `queued` | Waiting to be picked up by a worker |
| `generating` | Actively being processed (or stuck if `leaseExpiresAt < now`) |
| `completed` | Successfully finished |
| `failed` | Permanently failed after `MAX_ATTEMPTS` attempts |

### Detecting Stuck Jobs

A job is **stuck** when `status = 'generating'` and `leaseExpiresAt < NOW()`. The worker automatically reclaims these on its next poll. To find stuck jobs manually:

```sql
SELECT * FROM generationJobs
WHERE status = 'generating'
  AND leaseExpiresAt < NOW();
```

---

## Retrying Jobs

### User-Initiated Retry

Users can click the **Retry Generation** button on a failed book card in their Library. This calls `books.retryGeneration`, which resets the job to `queued` (only if `attempts < MAX_ATTEMPTS`) and re-enqueues it through the same lease-based pipeline.

The Retry button is **disabled** when `attempts >= MAX_ATTEMPTS` to prevent infinite loops. The error message from the last failure is displayed on the card.

### Admin / Manual Retry

To manually reset a permanently failed job for re-processing (bypassing the `MAX_ATTEMPTS` guard), run:

```sql
UPDATE generationJobs
SET status = 'queued',
    attempts = 0,
    errorMessage = NULL,
    lockedAt = NULL,
    lockedBy = NULL,
    leaseExpiresAt = NULL
WHERE id = <job_id>;
```

Then update the associated book status:

```sql
UPDATE books SET status = 'generating' WHERE id = <book_id>;
```

The next worker poll will pick it up automatically.

---

## Lease-Based Locking: How Double-Processing Is Prevented

The core of the locking mechanism is a single atomic `UPDATE … WHERE` statement:

```sql
UPDATE generationJobs
SET    status         = 'generating',
       lockedAt       = NOW(),
       lockedBy       = '<workerId>',
       leaseExpiresAt = DATE_ADD(NOW(), INTERVAL 10 MINUTE),
       attempts       = attempts + 1,
       startedAt      = NOW()
WHERE  id             = <jobId>
  AND  status         IN ('queued', 'generating')
  AND  (lockedAt IS NULL OR leaseExpiresAt < NOW())
  AND  attempts       < MAX_ATTEMPTS;
```

If two workers race to claim the same job, only one will receive `affectedRows = 1`. The other receives `affectedRows = 0` and skips the job silently. This is guaranteed by MySQL's row-level locking during the `UPDATE`.

---

## Stuck Job Recovery

If a worker crashes mid-generation (e.g. OOM kill, network timeout), the job remains in `status = 'generating'` with a `leaseExpiresAt` in the past. The next worker poll detects this via the `leaseExpiresAt < NOW()` condition and reclaims the job, incrementing `attempts`.

After `MAX_ATTEMPTS` failed attempts the job is permanently marked `failed` and will not be automatically retried. The user sees the last error message on their Library card.

---

## Deployment Notes

In the current Manus-hosted deployment the worker runs **in-process** alongside the Express server. This is appropriate for the current traffic level. If generation throughput needs to scale independently, the `processNextQueuedJob` export in `server/generationWorker.ts` can be called from a separate Node.js process or a cron job without any code changes — the lease mechanism handles concurrent workers automatically.

---

*Last updated: March 2026*
