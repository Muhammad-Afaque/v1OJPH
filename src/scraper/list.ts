import * as cheerio from "cheerio";
import { parseCards } from "./parse";
import type { JobListItem } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://www.onlinejobs.ph/",
};

const BASE_URL = "https://www.onlinejobs.ph/jobseekers/jobsearch";
const OFFSETS = [0, 30, 60, 90, 120, 150, 180, 210, 240];
const DELAY_MS = 2000;

function buildUrl(offset: number, keyword?: string): string {
  if (keyword) {
    const qs = `?jobkeyword=${encodeURIComponent(keyword)}`;
    if (offset === 0) {
      return `${BASE_URL}${qs}`;
    }
    return `${BASE_URL}/${offset}${qs}`;
  }
  if (offset === 0) {
    return BASE_URL;
  }
  return `${BASE_URL}/${offset}`;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      console.error(`  HTTP ${response.status} — skipping`);
      return null;
    }
    const text = await response.text();
    if (!text.toLowerCase().includes("onlinejobs")) {
      console.error("  Response doesn't look like OnlineJobs.ph — skipping");
      return null;
    }
    return text;
  } catch (e) {
    console.error(`  Fetch error: ${e} — skipping`);
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ListOptions {
  keywords?: string[];
  existingIds?: Set<string>;
  dryRun?: boolean;
}

export interface ListResult {
  newJobs: JobListItem[];
  totalNew: number;
  totalScraped: number;
}

export async function scrapeList(options: ListOptions = {}): Promise<ListResult> {
  const { keywords, existingIds = new Set(), dryRun = false } = options;

  const seenThisRun = new Set<string>();
  const allNewJobs: JobListItem[] = [];

  // General listing (always)
  console.log(`\n${"=".repeat(50)}`);
  console.log("Scraping: General listing");
  console.log("=".repeat(50));

  const generalJobs = await scrapeSource("general", undefined, existingIds, seenThisRun, dryRun);
  allNewJobs.push(...generalJobs);

  // Keyword-targeted searches (best-effort)
  if (keywords?.length) {
    for (const keyword of keywords) {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`Scraping: Keyword "${keyword}"`);
      console.log("=".repeat(50));

      try {
        const kwJobs = await scrapeSource(
          `keyword:${keyword}`,
          keyword,
          existingIds,
          seenThisRun,
          dryRun,
        );
        allNewJobs.push(...kwJobs);
      } catch (e) {
        console.error(`  WARNING: Keyword "${keyword}" failed: ${e} — continuing`);
      }
    }
  }

  return {
    newJobs: allNewJobs,
    totalNew: allNewJobs.length,
    totalScraped: existingIds.size + seenThisRun.size,
  };
}

async function scrapeSource(
  label: string,
  keyword: string | undefined,
  existingIds: Set<string>,
  seenThisRun: Set<string>,
  dryRun: boolean,
): Promise<JobListItem[]> {
  const newJobs: JobListItem[] = [];
  const totalPages = OFFSETS.length;

  for (let i = 0; i < OFFSETS.length; i++) {
    const offset = OFFSETS[i];
    const url = buildUrl(offset, keyword);
    console.log(`  [Page ${i + 1}/${totalPages}] Offset ${offset} → ${url}`);

    const html = await fetchPage(url);
    if (!html) {
      console.error("    ERROR: Failed to fetch page");
      continue;
    }

    const cards = parseCards(html);
    if (!cards.length) {
      console.log("    No cards found — stopping.");
      break;
    }

    let pageNew = 0;
    let pageDups = 0;

    for (const job of cards) {
      const jid = job.job_id;
      if (!jid || existingIds.has(jid) || seenThisRun.has(jid)) {
        pageDups++;
        continue;
      }
      if (!dryRun) {
        newJobs.push(job);
      }
      seenThisRun.add(jid);
      pageNew++;
    }

    console.log(`    +${pageNew} new | ${pageDups} skipped`);

    if (pageNew === 0 && pageDups === cards.length) {
      console.log("    Full page of duplicates — stopping early.");
      break;
    }

    if (i < totalPages - 1) {
      await sleep(DELAY_MS);
    }
  }

  return newJobs;
}
