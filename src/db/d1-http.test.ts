import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Job } from "../scraper/types";
import { createD1Client } from "./d1";
import { createD1Database } from "./d1-http";

/** Records outbound requests and returns a canned D1 HTTP API response. */
function makeMockFetch(opts: {
  rows?: unknown[];
  changes?: number;
  results?: Array<{
    results: unknown[];
    success: boolean;
    meta?: unknown;
    error?: string | null;
  }>;
}) {
  const calls: Array<{
    url: string;
    headers: Record<string, string>;
    body: { sql: string; params: unknown[] };
  }> = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      sql: string;
      params: unknown[];
    };
    calls.push({
      url: String(url),
      headers: (init.headers as Record<string, string>) ?? {},
      body,
    });
    const result = opts.results ?? [
      {
        results: opts.rows ?? [],
        success: true,
        meta: {
          changes: opts.changes ?? 1,
          rows_read: 0,
          rows_written: opts.changes ?? 1,
        },
        error: null,
      },
    ];
    return new Response(
      JSON.stringify({ result, success: true, errors: [], messages: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  return { fetchImpl, calls };
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

const ACCOUNT = "acct-123";
const DB = "db-456";
const TOKEN = "tok-789";
const BASE = "https://api.cloudflare.com/client/v4";

function makeClient(mock: ReturnType<typeof makeMockFetch>["fetchImpl"]) {
  return createD1Client(
    createD1Database({
      accountId: ACCOUNT,
      databaseId: DB,
      apiToken: TOKEN,
      fetchImpl: mock,
    }),
  );
}

describe("d1-http adapter", () => {
  afterEach(() => {
    // Clear via empty string (falsy). Avoids both `delete` (noDelete lint rule)
    // and assigning undefined, which Node coerces to the truthy string "undefined".
    process.env.CLOUDFLARE_ACCOUNT_ID = "";
    process.env.CLOUDFLARE_D1_DATABASE_ID = "";
    process.env.CLOUDFLARE_API_TOKEN = "";
  });

  it("throws when required env vars are missing", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = "";
    process.env.CLOUDFLARE_D1_DATABASE_ID = "";
    process.env.CLOUDFLARE_API_TOKEN = "";
    expect(() => createD1Database()).toThrow(/CLOUDFLARE_ACCOUNT_ID/);
  });

  it("reads credentials from environment variables", () => {
    process.env.CLOUDFLARE_ACCOUNT_ID = ACCOUNT;
    process.env.CLOUDFLARE_D1_DATABASE_ID = DB;
    process.env.CLOUDFLARE_API_TOKEN = TOKEN;
    const mock = makeMockFetch({});
    const db = createD1Database({ fetchImpl: mock.fetchImpl });
    expect(db).toBeDefined();
  });

  it("posts an INSERT OR REPLACE to the correct endpoint with auth header", async () => {
    const mock = makeMockFetch({});
    const client = makeClient(mock.fetchImpl);
    await client.upsert(makeJob());

    expect(mock.calls).toHaveLength(1);
    const call = mock.calls[0];
    expect(call.url).toBe(
      `${BASE}/accounts/${ACCOUNT}/d1/database/${DB}/query`,
    );
    expect(call.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(call.headers["Content-Type"]).toBe("application/json");
    expect(call.body.sql).toContain("INSERT OR REPLACE INTO jobs");
    expect(call.body.params[0]).toBe("12345");
    // tags serialized as JSON string
    expect(call.body.params[7]).toBe('["javascript","react"]');
  });

  it("upsertBatch writes one statement per job", async () => {
    const mock = makeMockFetch({});
    const client = makeClient(mock.fetchImpl);
    await client.upsertBatch([
      makeJob({ job_id: "1" }),
      makeJob({ job_id: "2" }),
      makeJob({ job_id: "3" }),
    ]);

    expect(mock.calls).toHaveLength(3);
    expect(mock.calls.map((c) => c.body.params[0])).toEqual(["1", "2", "3"]);
  });

  it("getExistingIds reads job_id rows", async () => {
    const mock = makeMockFetch({ rows: [{ job_id: "1" }, { job_id: "2" }] });
    const client = makeClient(mock.fetchImpl);
    const ids = await client.getExistingIds();

    expect(ids).toEqual(new Set(["1", "2"]));
    expect(mock.calls[0].body.sql).toContain("SELECT job_id FROM jobs");
  });

  it("getJob returns null when no row", async () => {
    const mock = makeMockFetch({ rows: [] });
    const client = makeClient(mock.fetchImpl);
    expect(await client.getJob("nope")).toBeNull();
  });

  it("propagates D1 API errors", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ message: "boom" }],
          result: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    const client = makeClient(fetchImpl);
    await expect(client.upsert(makeJob())).rejects.toThrow(
      /D1 query failed: boom/,
    );
  });
});
