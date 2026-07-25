import * as cheerio from "cheerio";
import type { JobDetail } from "./types";

export function parseDetailPage(html: string): JobDetail {
  const $ = cheerio.load(html);

  // Job title
  const h1 = $("h1.fs-24.fw-600.text-white.text-center.mb-40.job__title");
  const job_title = h1.length ? h1.text().trim() : "N/A";

  // Card fields: work_type, salary_detail, hours, date_updated
  let work_type = "N/A";
  let salary_detail = "N/A";
  let hours = "N/A";
  let date_updated = "N/A";

  const card = $("div.card.job-post");
  if (card.length) {
    const values = card
      .find("p.fs-18")
      .map((_, el) => $(el).text().trim() || "N/A")
      .get();

    if (values.length >= 4) {
      work_type = values[0];
      salary_detail = values[1];
      hours = values[2];
      date_updated = values[3];
    }
  }

  // Description
  const descTag = $("p#job-description").length
    ? $("p#job-description")
    : $("p.job-description");
  const description = descTag.length
    ? descTag.text().replace(/\s+/g, " ").trim()
    : "N/A";

  return {
    job_title,
    work_type,
    salary_detail,
    hours,
    date_updated,
    description,
    company_detail: "N/A",
    contact_person: "N/A",
  };
}
