import type { Job } from "./scraper/types";

/** Default target size per chunk file, roughly matching the old ~10MB files. */
export const DEFAULT_CHUNK_BYTES = 10 * 1024 * 1024;

/** Kinds of files within a chunk dir: only zero-padded chunk_NNN.json are managed. */
const CHUNK_FILE_RE = /^chunk_\d{3}\.json$/u;

function serializeChunk(jobs: Job[]): string {
  return JSON.stringify(jobs);
}

/**
 * Split a list of jobs into arrays that each serialize under `targetBytes`
 * (plus a small tolerance so a single oversized job never splits itself).
 */
export function splitIntoChunks(
  jobs: Job[],
  targetBytes = DEFAULT_CHUNK_BYTES,
): Job[][] {
  const chunks: Job[][] = [];
  const tolerance = Math.max(targetBytes, 4096);
  let current: Job[] = [];
  let currentBytes = 0;

  for (const job of jobs) {
    const bytes = Buffer.byteLength(serializeChunk([job]));
    if (current.length > 0 && currentBytes + bytes > tolerance) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(job);
    currentBytes += bytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * Write chunk arrays to `dir` as chunk_001.json, chunk_002.json, ...
 * Any pre-existing chunk_NNN.json files that are NOT part of the new set are
 * removed so the frontend never mixes stale data with fresh chunks.
 * Returns the names of the files written.
 */
export async function writeChunkFiles(
  dir: string,
  chunks: Job[][],
): Promise<string[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  await fs.mkdir(dir, { recursive: true });

  const written: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const name = `chunk_${String(i + 1).padStart(3, "0")}.json`;
    await fs.writeFile(path.join(dir, name), serializeChunk(chunks[i]));
    written.push(name);
  }

  const existing = await fs.readdir(dir);
  for (const file of existing) {
    if (CHUNK_FILE_RE.test(file) && !written.includes(file)) {
      await fs.unlink(path.join(dir, file));
    }
  }

  return written;
}

/** Load every job currently stored in the chunk files (in file order). */
export async function readChunkFiles(dir: string): Promise<Job[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const files = (await fs.readdir(dir))
    .filter((f) => CHUNK_FILE_RE.test(f))
    .sort();

  const jobs: Job[] = [];
  for (const file of files) {
    const chunk = JSON.parse(
      await fs.readFile(path.join(dir, file), "utf-8"),
    ) as Job[];
    jobs.push(...chunk);
  }
  return jobs;
}
