#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { scrapeList } from "./scraper/list";
import type { Job } from "./scraper/types";

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

        // Save to JSON file
        const fs = await import("node:fs/promises");
        let existing: Record<string, unknown>[] = [];
        try {
          const data = await fs.readFile(outputFile, "utf-8");
          existing = JSON.parse(data);
        } catch {
          // File doesn't exist yet
        }

        const existingIds = new Set(
          existing.map((j) => (j as { job_id?: string }).job_id).filter(Boolean),
        );

        const newJobs = result.newJobs.filter((j) => !existingIds.has(j.job_id));
        const allJobs = [...existing, ...newJobs];

        await fs.writeFile(outputFile, JSON.stringify(allJobs, null, 2));

        console.log(`\n${"=".repeat(50)}`);
        console.log(`Done. ${newJobs.length} new jobs added.`);
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

        const fs = await import("node:fs/promises");
        const inputFile = String(args.input || "jobs.json");
        const outputFile = String(args.output || "enriched_jobs.json");
        const dryRun = Boolean(args["dry-run"]);

        // Load existing jobs
        let existing: Job[] = [];
        try {
          const data = await fs.readFile(inputFile, "utf-8");
          existing = JSON.parse(data);
        } catch {
          console.error(`No ${inputFile} found. Run 'ojph list' first.`);
          return;
        }

        if (!existing.length) {
          console.error(`No jobs in ${inputFile}. Run 'ojph list' first.`);
          return;
        }

        // Load already-enriched jobs to get existing IDs
        let alreadyEnriched: Job[] = [];
        try {
          const data = await fs.readFile(outputFile, "utf-8");
          alreadyEnriched = JSON.parse(data);
        } catch {
          // File doesn't exist yet
        }

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

        // Merge and save
        const allEnriched = [...alreadyEnriched, ...result.enriched];
        await fs.writeFile(outputFile, JSON.stringify(allEnriched, null, 2));

        console.log(`\n${"=".repeat(50)}`);
        console.log(`Done. ${result.newCount} jobs enriched (${result.skipped} skipped).`);
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

        const fs = await import("node:fs/promises");
        const inputFile = String(args.input || "enriched_jobs.json");
        const outputFile = String(args.output || "enriched_jobs.json");

        let jobs: Job[] = [];
        try {
          const data = await fs.readFile(inputFile, "utf-8");
          jobs = JSON.parse(data);
        } catch {
          console.error(`No ${inputFile} found. Run 'ojph detail' first.`);
          return;
        }

        if (!jobs.length) {
          console.error(`No jobs in ${inputFile}. Run 'ojph detail' first.`);
          return;
        }

        const { classify } = await import("./scraper/categorize");

        for (const job of jobs) {
          job.category = classify(job);
        }

        await fs.writeFile(outputFile, JSON.stringify(jobs, null, 2));

        // Print distribution
        const counts: Record<string, number> = {};
        for (const job of jobs) {
          const cat = job.category || "Other";
          counts[cat] = (counts[cat] || 0) + 1;
        }

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        console.log(`Categorized ${jobs.length} jobs`);
        console.log("=".repeat(40));
        for (const [cat, count] of sorted) {
          const pct = (count / jobs.length) * 100;
          console.log(`  ${cat.padEnd(15)} ${String(count).padStart(3)} (${pct.toFixed(0)}%)`);
        }
        console.log("=".repeat(40));
      },
    }),

    pipeline: defineCommand({
      meta: {
        name: "pipeline",
        description: "Run full pipeline (Phase 1 → 2 → 3)",
      },
      async run() {
        console.log("Pipeline — not yet implemented");
      },
    }),
  },
});

runMain(main);
