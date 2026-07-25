import type { Job } from "../scraper/types";

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Client {
  upsert(job: Job): Promise<void>;
  upsertBatch(jobs: Job[]): Promise<void>;
  getJob(jobId: string): Promise<Job | null>;
  getExistingIds(): Promise<Set<string>>;
}

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
            job_id, title, company, type, salary, posted, url, tags, scraped_at,
            job_title, work_type, salary_detail, hours, date_updated, description,
            company_detail, contact_person, detail_scraped_at, category,
            email, extra_description, custom_notes, source_info, status, contact_info, notes
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?
          )`
        )
        .bind(
          data.job_id,
          data.title,
          data.company,
          data.type,
          data.salary,
          data.posted,
          data.url,
          data.tags,
          data.scraped_at,
          data.job_title,
          data.work_type,
          data.salary_detail,
          data.hours,
          data.date_updated,
          data.description,
          data.company_detail,
          data.contact_person,
          data.detail_scraped_at,
          data.category,
          data.email,
          data.extra_description,
          data.custom_notes,
          data.source_info,
          data.status,
          data.contact_info,
          data.notes
        )
        .run();
    },

    async upsertBatch(jobs: Job[]): Promise<void> {
      for (const job of jobs) {
        await this.upsert(job);
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
  };
}
