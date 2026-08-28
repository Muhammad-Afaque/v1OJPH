#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import {
  loadJson,
  mergeJobs,
  printCategoryDistribution,
  saveJson,
} from "./cli-helpers";
import { createD1Client } from "./db/d1";
import { createD1Database } from "./db/d1-http";
import { classify } from "./scraper/categorize";
import { scrapeDetail } from "./scraper/detail-scraper";
import { scrapeList } from "./scraper/list";
import type { Job, JobListItem } from "./scraper/types";

/**
 * Build a D1 client backed by the Cloudflare HTTP API. The scraper runs as a
 * Node CLI (not inside a Worker), so there is no Worker binding available.
 * Credentials are read from environment variables:
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN
 */
function getD1Client() {
  return createD1Client(createD1Database());
}

/** Convert a listing into a full Job shell so it can be detail-scraped. */
function toJobShell(listItem: JobListItem): Job {
  return {
    ...listItem,
    job_title: "N/A",
    work_type: "N/A",
    salary_detail: "N/A",
    hours: "N/A",
    date_updated: "N/A",
    description: "N/A",
    company_detail: "N/A",
    contact_person: "N/A",
    detail_scraped_at: "",
    category: "Other",
    email: "",
    extra_description: "",
    custom_notes: [],
    source_info: "",
    status: "",
    contact_info: "",
    notes: "",
  };
}

const main = defineCommand({
  meta: {
    name: "ojph",
    version: "1.0.0",
    description: "OnlineJobs.ph Scraper CLI",
  },
  subCommands: {
    list: defineCommand({
      meta: {
        name: "list",
        description: "Scrape job listings from OnlineJobs.ph",
      },
      args: {
        keywords: {
          type: "string",
          description: "Comma-separated keywords for targeted searches",
          required: false,
        },
        "dry-run": {
          type: "boolean",
          description: "Preview what would be scraped without making changes",
          default: false,
        },
        output: {
          type: "string",
          description: "Output file path (for local mode, without D1)",
          default: "jobs.json",
        },
      },
      async run({ args }) {
        console.log("OnlineJobs.ph Listing Scraper — Phase 1");
        console.log("=".repeat(50));

        const keywordsStr = String(args.keywords || "");
        const keywords = keywordsStr
          ? keywordsStr
              .split(",")
              .map((k: string) => k.trim())
              .filter(Boolean)
          : undefined;

        const dryRun = Boolean(args["dry-run"]);
        const outputFile = String(args.output || "jobs.json");

        const result = await scrapeList({
          keywords,
          dryRun,
        });

        const existing = await loadJson<JobListItem>(outputFile);
        const allJobs = mergeJobs(existing, result.newJobs);

        await saveJson(outputFile, allJobs);

        console.log(`\n${"=".repeat(50)}`);
        console.log(`Done. ${result.newJobs.length} new jobs added.`);
        console.log(`Total in ${outputFile}: ${allJobs.length}`);
        console.log("=".repeat(50));
      },
    }),

    detail: defineCommand({
      meta: {
        name: "detail",
        description: "Enrich job listings with detail data (Phase 2)",
      },
      args: {
        input: {
          type: "string",
          description: "Input file path (jobs.json)",
          default: "jobs.json",
        },
        output: {
          type: "string",
          description: "Output file path (enriched_jobs.json)",
          default: "enriched_jobs.json",
        },
        "dry-run": {
          type: "boolean",
          description: "Preview what would be scraped without making changes",
          default: false,
        },
      },
      async run({ args }) {
        console.log("OnlineJobs.ph Detail Scraper — Phase 2");
        console.log("=".repeat(50));

        const inputFile = String(args.input || "jobs.json");
        const outputFile = String(args.output || "enriched_jobs.json");
        const dryRun = Boolean(args["dry-run"]);

        const existing = await loadJson<Job>(inputFile);
        if (!existing.length) {
          console.error(`No ${inputFile} found. Run 'ojph list' first.`);
          return;
        }

        const alreadyEnriched = await loadJson<Job>(outputFile);
        const existingIds = new Set(
          alreadyEnriched.map((j) => j.job_id).filter(Boolean),
        );

        console.log(`Loaded ${existing.length} jobs from ${inputFile}`);
        console.log(`${existingIds.size} already enriched — will skip`);

        const { scrapeDetail } = await import("./scraper/detail-scraper");
        const result = await scrapeDetail({
          jobs: existing,
          existingIds,
          dryRun,
        });

        const allEnriched = [...alreadyEnriched, ...result.enriched];
        await saveJson(outputFile, allEnriched);

        console.log(`\n${"=".repeat(50)}`);
        console.log(
          `Done. ${result.newCount} jobs enriched (${result.skipped} skipped).`,
        );
        console.log(`Total in ${outputFile}: ${allEnriched.length}`);
        console.log("=".repeat(50));
      },
    }),

    categorize: defineCommand({
      meta: {
        name: "categorize",
        description: "Categorize jobs (Phase 3)",
      },
      args: {
        input: {
          type: "string",
          description: "Input file path (enriched_jobs.json)",
          default: "enriched_jobs.json",
        },
        output: {
          type: "string",
          description: "Output file path",
          default: "enriched_jobs.json",
        },
      },
      async run({ args }) {
        console.log("OnlineJobs.ph Categorizer — Phase 3");
        console.log("=".repeat(50));

        const inputFile = String(args.input || "enriched_jobs.json");
        const outputFile = String(args.output || "enriched_jobs.json");

        const jobs = await loadJson<Job>(inputFile);
        if (!jobs.length) {
          console.error(`No ${inputFile} found. Run 'ojph detail' first.`);
          return;
        }

        const { classify } = await import("./scraper/categorize");

        for (const job of jobs) {
          job.category = classify(job);
        }

        await saveJson(outputFile, jobs);

        console.log(`Categorized ${jobs.length} jobs`);
        printCategoryDistribution(jobs);
      },
    }),

    pipeline: defineCommand({
      meta: {
        name: "pipeline",
        description:
          "Run full pipeline (Phase 1 → 2 → 3) and write results to D1",
      },
      args: {
        keywords: {
          type: "string",
          description: "Comma-separated keywords for targeted searches",
          required: false,
        },
        "local-json": {
          type: "boolean",
          description:
            "Also write local JSON files for debugging instead of D1",
          default: false,
        },
        limit: {
          type: "string",
          description:
            "Only process up to N new jobs (0 = all). Useful for testing.",
          default: "0",
        },
        "dry-run": {
          type: "boolean",
          description: "Run all phases without writing to D1 or JSON",
          default: false,
        },
      },
      async run({ args }) {
        const keywordsStr = String(args.keywords || "");
        const keywords = keywordsStr
          ? keywordsStr
              .split(",")
              .map((k: string) => k.trim())
              .filter(Boolean)
          : undefined;
        const dryRun = Boolean(args["dry-run"]);
        const localJson = Boolean(args["local-json"]);
        const limit = Number(args.limit) || 0;

        console.log("OnlineJobs.ph Pipeline — Phase 1 → 2 → 3");
        console.log("=".repeat(50));

        // Seed existing ids for incremental dedup. Production (D1) reads the
        // current ids from D1; --dry-run / --local-json stay offline and read
        // from the local JSON so nothing is hit during a test run.
        let existingIds = new Set<string>();
        let d1Client: ReturnType<typeof getD1Client> | undefined;
        if (!dryRun && !localJson) {
          d1Client = getD1Client();
          existingIds = await d1Client.getExistingIds();
          console.log(`Loaded ${existingIds.size} existing job IDs from D1`);
        } else {
          const local = await loadJson<Job>("enriched_jobs.json");
          existingIds = new Set(local.map((j) => j.job_id).filter(Boolean));
          console.log(
            `Loaded ${existingIds.size} existing job IDs from enriched_jobs.json`,
          );
        }

        // The scrape itself always runs for real (phases 1-3). The mode flags
        // only control the final write step and the dedup source. `--limit`
        // caps how many detail pages we fetch, which makes --dry-run a fast,
        // meaningful end-to-end test without touching D1.
        console.log(`\n${"=".repeat(50)}`);
        console.log("PHASE 1: Scrape listings");
        console.log("=".repeat(50));
        const listResult = await scrapeList({ keywords, existingIds });
        const newListings = listResult.newJobs;
        console.log(`\nPhase 1 done. ${newListings.length} new listings.`);

        if (newListings.length === 0) {
          console.log("No new listings — nothing to enrich or write.");
          return;
        }

        // Optionally cap the number of detail pages to process (for testing).
        const jobsToProcess =
          limit > 0 ? newListings.slice(0, limit) : newListings;

        // ----- Phase 2: Enrich details -----
        console.log(`\n${"=".repeat(50)}`);
        console.log("PHASE 2: Enrich details");
        console.log("=".repeat(50));
        const detailResult = await scrapeDetail({
          jobs: jobsToProcess.map(toJobShell),
          existingIds,
        });
        console.log(
          `\nPhase 2 done. ${detailResult.newCount} enriched (${detailResult.skipped} skipped).`,
        );

        // ----- Phase 3: Categorize -----
        console.log(`\n${"=".repeat(50)}`);
        console.log("PHASE 3: Categorize");
        console.log("=".repeat(50));
        for (const job of detailResult.enriched) {
          job.category = classify(job);
        }
        printCategoryDistribution(detailResult.enriched);

        // ----- Write results -----
        console.log(`\n${"=".repeat(50)}`);
        if (dryRun) {
          console.log(
            `DRY RUN — not writing anywhere. Would write ${detailResult.enriched.length} jobs to D1.`,
          );
        } else if (localJson) {
          console.log(
            `Writing ${detailResult.enriched.length} jobs to local JSON...`,
          );
          const existing = await loadJson<Job>("enriched_jobs.json");
          const all = mergeJobs(existing, detailResult.enriched);
          await saveJson("enriched_jobs.json", all);
          console.log(`Done. Total in enriched_jobs.json: ${all.length}`);
        } else {
          console.log(`Writing ${detailResult.enriched.length} jobs to D1...`);
          if (!d1Client) throw new Error("D1 client not initialized");
          await d1Client.upsertBatch(detailResult.enriched);
          console.log("Done. Upserted to D1.");
        }
        console.log("=".repeat(50));
      },
    }),
  },
});

runMain(main);
