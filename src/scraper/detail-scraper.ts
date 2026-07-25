import { parseDetailPage } from "./detail";
import type { Job, JobDetail } from "./types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://www.onlinejobs.ph/",
};

const MAX_RETRIES = 3;
const DEFAULT_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS });

      if (response.ok) {
        const text = await response.text();
        if (text.toLowerCase().includes("onlinejobs")) {
          return text;
        }
        console.error("    Response doesn't look like OnlineJobs.ph");
        return null;
      }

      const status = response.status;
      if (status === 429 || status === 503 || status === 520) {
        console.error(`    Retry ${attempt}/${MAX_RETRIES}: HTTP ${status}`);
        if (attempt < MAX_RETRIES) {
          await sleep(2000);
        }
        continue;
      }

      console.error(`    HTTP ${status} — not retrying`);
      return null;
    } catch (e) {
      console.error(`    Retry ${attempt}/${MAX_RETRIES}: ${e}`);
      if (attempt < MAX_RETRIES) {
        await sleep(2000);
      }
    }
  }
  return null;
}

export interface DetailOptions {
  jobs: Job[];
  existingIds?: Set<string>;
  delayMs?: number;
  dryRun?: boolean;
}

export interface DetailResult {
  enriched: Job[];
  newCount: number;
  skipped: number;
}

export async function scrapeDetail(options: DetailOptions): Promise<DetailResult> {
  const { jobs, existingIds = new Set(), delayMs = DEFAULT_DELAY_MS, dryRun = false } = options;

  const enriched: Job[] = [];
  let newCount = 0;
  let skipped = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const jid = job.job_id;
    const url = job.url;

    if (!url || url === "N/A") {
      continue;
    }

    if (jid && existingIds.has(jid)) {
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${jobs.length}] ${url}`);

    const html = await fetchPage(url);
    let detail: JobDetail;

    if (!html) {
      console.error("    ERROR: Failed to fetch page");
      detail = {
        job_title: "N/A",
        work_type: "N/A",
        salary_detail: "N/A",
        hours: "N/A",
        date_updated: "N/A",
        description: "Failed to scrape",
        company_detail: "N/A",
        contact_person: "N/A",
      };
    } else {
      detail = parseDetailPage(html);
      console.log(
        `    Title: ${detail.job_title.slice(0, 60)} | Type: ${detail.work_type} | Salary: ${detail.salary_detail}`,
      );
    }

    const enrichedJob: Job = {
      ...job,
      ...detail,
      detail_scraped_at: new Date().toISOString(),
    };

    if (!dryRun) {
      enriched.push(enrichedJob);
    }

    if (jid) {
      existingIds.add(jid);
    }
    newCount++;

    if (i < jobs.length - 1) {
      await sleep(delayMs);
    }
  }

  return { enriched, newCount, skipped };
}
