import type { Job } from "../scraper/types";

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
  }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Client {
  upsert(job: Job): Promise<void>;
  upsertBatch(jobs: Job[]): Promise<void>;
  getJob(jobId: string): Promise<Job | null>;
  getExistingIds(): Promise<Set<string>>;
  getAll(): Promise<Job[]>;
}

const JOB_COLUMNS = [
  "job_id",
  "title",
  "company",
  "type",
  "salary",
  "posted",
  "url",
  "tags",
  "scraped_at",
  "job_title",
  "work_type",
  "salary_detail",
  "hours",
  "date_updated",
  "description",
  "company_detail",
  "contact_person",
  "detail_scraped_at",
  "category",
  "email",
  "extra_description",
  "custom_notes",
  "source_info",
  "status",
  "contact_info",
  "notes",
] as const;

// D1 caps bound parameters at 100 per query (SQLite SQLITE_MAX_VARIABLE_NUMBER
// in Cloudflare's build). 3 rows × 26 columns = 78 parameters, safely under
// the cap. Larger imports still go through the same batching, so backfills
// stay fast without overflowing the statement.
const UPSERT_BATCH_SIZE = 3;

function serializeJob(job: Job): Record<string, unknown> {
  return {
    ...job,
    tags: JSON.stringify(job.tags || []),
    custom_notes: JSON.stringify(job.custom_notes || []),
  };
}

function deserializeJob(row: Record<string, unknown>): Job {
  return {
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags || [],
    custom_notes:
      typeof row.custom_notes === "string"
        ? JSON.parse(row.custom_notes)
        : row.custom_notes || [],
  } as Job;
}

export function createD1Client(db: D1Database): D1Client {
  return {
    async upsert(job: Job): Promise<void> {
      const data = serializeJob(job);
      await db
        .prepare(
          `INSERT OR REPLACE INTO jobs (
            ${JOB_COLUMNS.join(", ")}
          ) VALUES (
            ${JOB_COLUMNS.map(() => "?").join(", ")}
          )`,
        )
        .bind(...JOB_COLUMNS.map((c) => data[c]))
        .run();
    },

    async upsertBatch(jobs: Job[]): Promise<void> {
      for (let i = 0; i < jobs.length; i += UPSERT_BATCH_SIZE) {
        const rows = jobs.slice(i, i + UPSERT_BATCH_SIZE).map(serializeJob);
        const values = rows
          .map(() => `(${JOB_COLUMNS.map(() => "?").join(", ")})`)
          .join(", ");
        await db
          .prepare(
            `INSERT OR REPLACE INTO jobs (${JOB_COLUMNS.join(", ")})
             VALUES ${values}`,
          )
          .bind(...rows.flatMap((r) => JOB_COLUMNS.map((c) => r[c])))
          .run();
      }
    },

    async getJob(jobId: string): Promise<Job | null> {
      const row = await db
        .prepare("SELECT * FROM jobs WHERE job_id = ?")
        .bind(jobId)
        .first<Record<string, unknown>>();

      if (!row) return null;
      return deserializeJob(row);
    },

    async getExistingIds(): Promise<Set<string>> {
      const result = await db
        .prepare("SELECT job_id FROM jobs")
        .all<{ job_id: string }>();

      return new Set(result.results.map((r) => r.job_id));
    },

    async getAll(): Promise<Job[]> {
      const result = await db
        .prepare("SELECT * FROM jobs")
        .all<Record<string, unknown>>();

      return result.results.map(deserializeJob);
    },
  };
}
