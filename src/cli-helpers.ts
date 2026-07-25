import type { Job, JobListItem } from "./scraper/types";

export async function loadJson<T>(filePath: string): Promise<T[]> {
  const fs = await import("node:fs/promises");
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveJson(filePath: string, data: unknown): Promise<void> {
  const fs = await import("node:fs/promises");
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

export function mergeJobs<T extends { job_id?: string }>(
  existing: T[],
  newJobs: T[],
): T[] {
  const existingIds = new Set(existing.map((j) => j.job_id).filter(Boolean));
  const unique = newJobs.filter((j) => !existingIds.has(j.job_id));
  return [...existing, ...unique];
}

export function printCategoryDistribution(jobs: Job[]): void {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    const cat = job.category || "Other";
    counts[cat] = (counts[cat] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log("=".repeat(40));
  for (const [cat, count] of sorted) {
    const pct = (count / jobs.length) * 100;
    console.log(`  ${cat.padEnd(15)} ${String(count).padStart(3)} (${pct.toFixed(0)}%)`);
  }
  console.log("=".repeat(40));
}
