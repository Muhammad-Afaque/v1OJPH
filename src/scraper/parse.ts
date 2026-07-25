import * as cheerio from "cheerio";
import type { JobListItem } from "./types";

export function extractJobId(url: string): string | null {
  if (!url || url === "N/A") return null;
  try {
    const cleaned = url.replace(/\/+$/, "");
    const parts = cleaned.split("/");
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

export function parseCards(html: string): JobListItem[] {
  const $ = cheerio.load(html);
  const jobs: JobListItem[] = [];

  $(".jobpost-cat-box").each((_, card) => {
    const $card = $(card);

    // Company from logo alt text
    const logo = $card.find("img.jobpost-cat-box-logo");
    const company = logo.attr("alt")?.trim() || "N/A";

    // Title and work type
    const titleTag = $card.find("h4.fs-16.fw-700");
    let title = "N/A";
    let jobType = "N/A";

    if (titleTag.length) {
      const badgeTag = titleTag.find("span.badge");
      if (badgeTag.length) {
        // Work type is inside a badge span (e.g., "Full Time")
        jobType = badgeTag.text().trim() || "N/A";
        badgeTag.remove();
        title = titleTag.text().trim() || "N/A";
      } else {
        // Work type might be plain text before title (e.g., "Part Time\n      Virtual Assistant")
        const fullText = titleTag.text().trim();
        const workTypes = ["Full Time", "Part Time", "Gig", "Freelance", "Contract"];
        let foundType = false;
        for (const wt of workTypes) {
          if (fullText.startsWith(wt)) {
            jobType = wt;
            title = fullText.slice(wt.length).trim();
            foundType = true;
            break;
          }
        }
        if (!foundType) {
          title = fullText;
        }
      }
    }

    // Salary
    const salaryTag = $card.find("dl.row.no-gutters dd.col");
    const salary = salaryTag.text().trim() || "N/A";

    // Posted date
    const dateTag = $card.find("p.fs-13.mb-0 em");
    const posted = dateTag.text().trim().replace("Posted on ", "") || "N/A";

    // Job URL and ID
    const linkTag = $card.find("div.desc a[href^='/jobseekers/job/']");
    const href = linkTag.attr("href");
    const jobUrl = href ? `https://www.onlinejobs.ph${href}` : "N/A";
    const jobId = extractJobId(jobUrl);

    // Tags
    const tags: string[] = [];
    $card.find("div.job-tag a.badge").each((_, el) => {
      const tag = $(el).text().trim();
      if (tag) tags.push(tag);
    });

    jobs.push({
      job_id: jobId || "",
      title,
      company,
      type: jobType,
      salary,
      posted,
      url: jobUrl,
      tags,
      scraped_at: new Date().toISOString(),
    });
  });

  return jobs;
}
