import { describe, it, expect, beforeEach } from "vitest";
import { createD1Client } from "./d1";
import type { Job } from "../scraper/types";

function createMockD1() {
  const store = new Map<string, Record<string, unknown>>();

  function extractColumns(sql: string): string[] {
    const match = sql.match(/INTO\s+jobs\s*\(([^)]+)\)/i);
    if (!match) return [];
    return match[1].split(",").map((c) => c.trim());
  }

  function createStatement(sql: string) {
    let boundParams: unknown[] = [];
    const stmt = {
      bind(...params: unknown[]) {
        boundParams = params;
        return {
          async run() {
            const upperSql = sql.toUpperCase();
            if (upperSql.includes("INSERT") || upperSql.includes("REPLACE")) {
              const columns = extractColumns(sql);
              const row: Record<string, unknown> = {};
              columns.forEach((col, i) => {
                row[col] = boundParams[i];
              });
              const jobId = String(row.job_id);
              store.set(jobId, row);
              return { success: true, meta: { changes: 1 } };
            }
            if (upperSql.includes("DELETE")) {
              const id = String(boundParams[0]);
              store.delete(id);
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          },
          async all() {
            const rows = Array.from(store.values());
            return { results: rows, success: true };
          },
          async first() {
            // If there's a WHERE clause with job_id, filter
            if (sql.toUpperCase().includes("WHERE")) {
              const jobIdParam = boundParams[0];
              const row = store.get(String(jobIdParam));
              return row || null;
            }
            const rows = Array.from(store.values());
            return rows[0] || null;
          },
        };
      },
      async all() {
        const rows = Array.from(store.values());
        return { results: rows, success: true };
      },
      async first() {
        const rows = Array.from(store.values());
        return rows[0] || null;
      },
    };
    return stmt;
  }

  return {
    store,
    prepare(sql: string) {
      return createStatement(sql);
    },
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    job_id: "12345",
    title: "Test Job",
    company: "Test Corp",
    type: "Full Time",
    salary: "$1000/month",
    posted: "2026-01-15",
    url: "https://www.onlinejobs.ph/jobseekers/job/12345",
    tags: ["javascript", "react"],
    scraped_at: "2026-01-15T10:00:00Z",
    job_title: "Test Job",
    work_type: "Full Time",
    salary_detail: "$1000/month",
    hours: "40",
    date_updated: "Jan 15, 2026",
    description: "A test job description",
    company_detail: "N/A",
    contact_person: "N/A",
    detail_scraped_at: "2026-01-15T11:00:00Z",
    category: "Development",
    email: "",
    extra_description: "",
    custom_notes: [],
    source_info: "",
    status: "",
    contact_info: "",
    notes: "",
    ...overrides,
  };
}

describe("D1 Client", () => {
  let mockD1: ReturnType<typeof createMockD1>;
  let client: ReturnType<typeof createD1Client>;

  beforeEach(() => {
    mockD1 = createMockD1();
    client = createD1Client(mockD1 as any);
  });

  describe("upsert", () => {
    it("inserts a new job", async () => {
      const job = makeJob();
      await client.upsert(job);

      expect(mockD1.store.size).toBe(1);
      expect(mockD1.store.has("12345")).toBe(true);
    });

    it("updates an existing job", async () => {
      const job = makeJob();
      await client.upsert(job);

      const updated = makeJob({ title: "Updated Title" });
      await client.upsert(updated);

      expect(mockD1.store.size).toBe(1);
      expect(mockD1.store.get("12345")?.title).toBe("Updated Title");
    });

    it("stores tags as JSON string", async () => {
      const job = makeJob({ tags: ["javascript", "react", "node"] });
      await client.upsert(job);

      const stored = mockD1.store.get("12345");
      expect(stored?.tags).toBe('["javascript","react","node"]');
    });
  });

  describe("upsertBatch", () => {
    it("inserts multiple jobs", async () => {
      const jobs = [
        makeJob({ job_id: "1" }),
        makeJob({ job_id: "2" }),
        makeJob({ job_id: "3" }),
      ];

      await client.upsertBatch(jobs);

      expect(mockD1.store.size).toBe(3);
    });
  });

  describe("getJob", () => {
    it("returns a job by id", async () => {
      const job = makeJob();
      await client.upsert(job);

      const result = await client.getJob("12345");
      expect(result).not.toBeNull();
      expect(result?.job_id).toBe("12345");
      expect(result?.title).toBe("Test Job");
    });

    it("returns null for non-existent job", async () => {
      const result = await client.getJob("99999");
      expect(result).toBeNull();
    });

    it("parses tags from JSON string", async () => {
      const job = makeJob({ tags: ["javascript", "react"] });
      await client.upsert(job);

      const result = await client.getJob("12345");
      expect(result?.tags).toEqual(["javascript", "react"]);
    });
  });

  describe("getExistingIds", () => {
    it("returns set of existing job ids", async () => {
      await client.upsert(makeJob({ job_id: "1" }));
      await client.upsert(makeJob({ job_id: "2" }));
      await client.upsert(makeJob({ job_id: "3" }));

      const ids = await client.getExistingIds();
      expect(ids).toEqual(new Set(["1", "2", "3"]));
    });

    it("returns empty set when no jobs exist", async () => {
      const ids = await client.getExistingIds();
      expect(ids).toEqual(new Set());
    });
  });
});
