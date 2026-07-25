import { describe, it, expect, beforeEach } from "vitest";
import { app } from "./worker";
import type { Job } from "../scraper/types";

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

function createMockD1() {
  const store = new Map<string, Record<string, unknown>>();

  function extractColumns(sql: string): string[] {
    const match = sql.match(/INTO\s+jobs\s*\(([^)]+)\)/i);
    if (!match) return [];
    return match[1].split(",").map((c) => c.trim());
  }

  function createStatement(sql: string) {
    let boundParams: unknown[] = [];
    return {
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
            return { success: true, meta: { changes: 0 } };
          },
          async all() {
            let rows = Array.from(store.values());

            // Simple WHERE clause handling
            const upperSql = sql.toUpperCase();
            if (upperSql.includes("WHERE")) {
              if (upperSql.includes("CATEGORY")) {
                const cat = String(boundParams[0]);
                rows = rows.filter((r) => r.category === cat);
              }
              if (upperSql.includes("WORK_TYPE")) {
                const wt = String(boundParams[upperSql.includes("CATEGORY") ? 1 : 0]);
                rows = rows.filter((r) => r.work_type === wt);
              }
            }

            // Simple ORDER BY handling
            if (upperSql.includes("ORDER BY")) {
              const desc = upperSql.includes("DESC");
              if (upperSql.includes("POSTED")) {
                rows.sort((a, b) => {
                  const da = String(a.posted || "");
                  const db = String(b.posted || "");
                  return desc ? db.localeCompare(da) : da.localeCompare(db);
                });
              }
            }

            // Simple LIMIT/OFFSET handling - params are after WHERE params
            const whereParamCount = upperSql.includes("WHERE") ? (upperSql.includes("CATEGORY") ? 1 : 0) + (upperSql.includes("WORK_TYPE") ? 1 : 0) : 0;
            const limit = upperSql.includes("LIMIT") ? Number(boundParams[whereParamCount]) : 50;
            const offset = upperSql.includes("OFFSET") ? Number(boundParams[whereParamCount + 1]) : 0;

            const paged = rows.slice(offset, offset + limit);
            return { results: paged, success: true };
          },
          async first() {
            const upperSql = sql.toUpperCase();

            // Handle COUNT queries
            if (upperSql.includes("COUNT(*)")) {
              let rows = Array.from(store.values());
              if (upperSql.includes("WHERE")) {
                if (upperSql.includes("CATEGORY")) {
                  const cat = String(boundParams[0]);
                  rows = rows.filter((r) => r.category === cat);
                }
                if (upperSql.includes("WORK_TYPE")) {
                  const wt = String(boundParams[upperSql.includes("CATEGORY") ? 1 : 0]);
                  rows = rows.filter((r) => r.work_type === wt);
                }
              }
              return { count: rows.length };
            }

            // Handle WHERE queries
            if (upperSql.includes("WHERE")) {
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
  }

  return {
    store,
    prepare(sql: string) {
      return createStatement(sql);
    },
  };
}

describe("Worker API", () => {
  let mockD1: ReturnType<typeof createMockD1>;

  beforeEach(async () => {
    mockD1 = createMockD1();
    // Seed with test data
    const jobs = [
      makeJob({ job_id: "1", title: "React Developer", category: "Development", work_type: "Full Time" }),
      makeJob({ job_id: "2", title: "Virtual Assistant", category: "VA", work_type: "Part Time" }),
      makeJob({ job_id: "3", title: "Marketing Manager", category: "Marketing", work_type: "Full Time" }),
    ];
    for (const job of jobs) {
      const data = { ...job, tags: JSON.stringify(job.tags), custom_notes: JSON.stringify(job.custom_notes) };
      await mockD1
        .prepare("INSERT OR REPLACE INTO jobs (job_id, title, company, type, salary, posted, url, tags, scraped_at, job_title, work_type, salary_detail, hours, date_updated, description, company_detail, contact_person, detail_scraped_at, category, email, extra_description, custom_notes, source_info, status, contact_info, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(
          data.job_id, data.title, data.company, data.type, data.salary,
          data.posted, data.url, data.tags, data.scraped_at,
          data.job_title, data.work_type, data.salary_detail, data.hours,
          data.date_updated, data.description, data.company_detail,
          data.contact_person, data.detail_scraped_at, data.category,
          data.email, data.extra_description, data.custom_notes,
          data.source_info, data.status, data.contact_info, data.notes
        )
        .run();
    }
  });

  describe("GET /api/jobs", () => {
    it("returns paginated jobs", async () => {
      const req = new Request("http://localhost/api/jobs");
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.jobs).toBeDefined();
      expect(data.total).toBe(3);
      expect(data.page).toBe(1);
      expect(data.limit).toBe(50);
    });

    it("filters by category", async () => {
      const req = new Request("http://localhost/api/jobs?category=Development");
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });
      const data = await res.json();

      expect(data.jobs.length).toBe(1);
      expect(data.jobs[0].category).toBe("Development");
    });

    it("filters by work type", async () => {
      const req = new Request("http://localhost/api/jobs?type=Part+Time");
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });
      const data = await res.json();

      expect(data.jobs.length).toBe(1);
      expect(data.jobs[0].work_type).toBe("Part Time");
    });

    it("paginates results", async () => {
      const req = new Request("http://localhost/api/jobs?page=1&limit=2");
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });
      const data = await res.json();

      expect(data.jobs.length).toBe(2);
      expect(data.total).toBe(3);
      expect(data.totalPages).toBe(2);
    });
  });

  describe("GET /api/jobs/:id", () => {
    it("returns a single job", async () => {
      const req = new Request("http://localhost/api/jobs/1");
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.job_id).toBe("1");
      expect(data.title).toBe("React Developer");
    });

    it("returns 404 for non-existent job", async () => {
      const req = new Request("http://localhost/api/jobs/999");
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });

      expect(res.status).toBe(404);
    });
  });

  describe("CORS", () => {
    it("returns CORS headers", async () => {
      const req = new Request("http://localhost/api/jobs");
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });

      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("handles OPTIONS preflight", async () => {
      const req = new Request("http://localhost/api/jobs", { method: "OPTIONS" });
      const res = await app.fetch(req, { D1_DATABASE: mockD1 as any });

      expect(res.status).toBe(204);
    });
  });
});
