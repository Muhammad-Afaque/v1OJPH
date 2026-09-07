import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { splitIntoChunks, writeChunkFiles } from "./chunks";
import type { Job } from "./scraper/types";

function makeJob(id: string): Job {
  return {
    job_id: id,
    title: `Job ${id}`,
    company: "Acme Media LLC",
    type: "Full Time",
    salary: "$1000/month",
    posted: `2026-05-2${Number(id) % 10} 10:00:00`,
    url: `https://www.onlinejobs.ph/jobseekers/job/${id}`,
    tags: ["wordpress", "shopify"],
    scraped_at: "2026-05-25T10:00:00Z",
    job_title: `Job ${id}`,
    work_type: "Full Time",
    salary_detail: "$1000/month",
    hours: "40",
    date_updated: "May 25, 2026",
    description:
      "A test job with a long enough description for sizing purposes.",
    company_detail: "N/A",
    contact_person: "N/A",
    detail_scraped_at: "2026-05-25T11:00:00Z",
    category: "Development",
    email: "",
    extra_description: "",
    custom_notes: [],
    source_info: "",
    status: "",
    contact_info: "",
    notes: "",
  };
}

function makeJobs(count: number): Job[] {
  return Array.from({ length: count }, (_, i) => makeJob(String(i + 1)));
}

describe("splitIntoChunks", () => {
  it("returns a single chunk when all items fit", () => {
    const chunks = splitIntoChunks(makeJobs(5), 100_000);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(5);
  });

  it("splits items across chunks when total exceeds target", () => {
    const chunks = splitIntoChunks(makeJobs(10), 1_000);
    expect(chunks.length).toBeGreaterThan(1);
    const total = chunks.reduce((sum, c) => sum + c.length, 0);
    expect(total).toBe(10);
  });

  it("keeps jobs within each chunk under the byte budget", () => {
    const chunks = splitIntoChunks(makeJobs(50), 3_000);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(JSON.stringify(chunk))).toBeLessThanOrEqual(
        3_000 + 4_000,
      );
    }
  });

  it("returns an empty array for no jobs", () => {
    expect(splitIntoChunks([], 1_000)).toEqual([]);
  });
});

describe("writeChunkFiles", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "ojph-chunks-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes chunk_001.json... with zero-padded names", async () => {
    const names = await writeChunkFiles(
      dir,
      splitIntoChunks(makeJobs(10), 1_000),
    );

    expect(names[0]).toBe("chunk_001.json");
    const files = await readdir(dir);
    expect(files.every((f) => /^chunk_\d{3}\.json$/u.test(f))).toBe(true);
    expect(files).toHaveLength(names.length);
  });

  it("writes each chunk as a JSON array of jobs", async () => {
    const jobs = splitIntoChunks(makeJobs(10), 1_000);
    await writeChunkFiles(dir, jobs);

    const first = JSON.parse(
      await readFile(join(dir, "chunk_001.json"), "utf-8"),
    ) as Job[];
    expect(Array.isArray(first)).toBe(true);
    expect(first).toHaveLength(jobs[0].length);
    expect(first[0].job_id).toBe(jobs[0][0].job_id);
  });

  it("removes stale chunk files that are no longer part of the set", async () => {
    await writeFile(join(dir, "chunk_001.json"), "[]");
    await writeFile(join(dir, "chunk_002.json"), "[]");
    await writeFile(join(dir, "chunk_003.json"), "[]");

    await writeChunkFiles(dir, splitIntoChunks(makeJobs(10), 1_000));

    const files = await readdir(dir);
    expect(files.some((f) => f === "chunk_003.json")).toBe(false);
  });
});
