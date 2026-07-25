import { describe, it, expect } from "vitest";
import { classify } from "./categorize";
import type { Job } from "./types";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    job_id: "1",
    title: "Test Job",
    company: "Test Co",
    salary: "N/A",
    posted_date: "N/A",
    url: "https://example.com",
    tags: [],
    job_title: "N/A",
    work_type: "N/A",
    salary_detail: "N/A",
    hours: "N/A",
    date_updated: "N/A",
    description: "N/A",
    company_detail: "N/A",
    contact_person: "N/A",
    detail_scraped_at: "N/A",
    ...overrides,
  };
}

describe("classify", () => {
  it("classifies Design jobs by title", () => {
    const job = makeJob({ title: "Graphic Designer", tags: [] });
    expect(classify(job)).toBe("Design");
  });

  it("classifies Design jobs by tags", () => {
    const job = makeJob({
      title: "Creative Role",
      tags: ["graphic design", "photoshop"],
    });
    expect(classify(job)).toBe("Design");
  });

  it("classifies Development jobs by title", () => {
    const job = makeJob({ title: "Full Stack Developer", tags: [] });
    expect(classify(job)).toBe("Development");
  });

  it("classifies Development jobs by tags", () => {
    const job = makeJob({
      title: "General Role",
      tags: ["python", "javascript", "node.js"],
    });
    expect(classify(job)).toBe("Development");
  });

  it("classifies Marketing jobs by title", () => {
    const job = makeJob({ title: "Social Media Manager", tags: [] });
    expect(classify(job)).toBe("Marketing");
  });

  it("classifies Marketing jobs by tags", () => {
    const job = makeJob({
      title: "General Role",
      tags: ["social media management", "facebook ads"],
    });
    expect(classify(job)).toBe("Marketing");
  });

  it("classifies VA jobs by title", () => {
    const job = makeJob({ title: "Virtual Assistant", tags: [] });
    expect(classify(job)).toBe("VA");
  });

  it("classifies VA jobs by tags", () => {
    const job = makeJob({
      title: "General Role",
      tags: ["virtual assistant", "data entry"],
    });
    expect(classify(job)).toBe("VA");
  });

  it("classifies Sales jobs by title", () => {
    const job = makeJob({ title: "Cold Caller", tags: [] });
    expect(classify(job)).toBe("Sales");
  });

  it("classifies Sales jobs by tags", () => {
    const job = makeJob({
      title: "General Role",
      tags: ["cold calling", "lead generation"],
    });
    expect(classify(job)).toBe("Sales");
  });

  it("classifies Finance jobs by title", () => {
    const job = makeJob({ title: "Bookkeeper", tags: [] });
    expect(classify(job)).toBe("Finance");
  });

  it("classifies Writing jobs by title", () => {
    const job = makeJob({ title: "Content Writer", tags: [] });
    expect(classify(job)).toBe("Writing");
  });

  it("classifies Medical jobs by title", () => {
    const job = makeJob({ title: "Medical Assistant", tags: [] });
    expect(classify(job)).toBe("Medical");
  });

  it("classifies Real Estate jobs by title", () => {
    const job = makeJob({ title: "Real Estate Manager", tags: [] });
    expect(classify(job)).toBe("Real Estate");
  });

  it("returns Other for unmatched jobs", () => {
    const job = makeJob({ title: "Chief Penguin Officer", tags: ["xyz"] });
    expect(classify(job)).toBe("Other");
  });

  it("returns Other for empty tags and title", () => {
    const job = makeJob({ title: "", tags: [] });
    expect(classify(job)).toBe("Other");
  });

  it("uses tag weight 2 and title weight 3", () => {
    // One tag match (2) vs one title match (3) -> title wins
    const job = makeJob({
      title: "Developer",
      tags: ["graphic design"],
    });
    expect(classify(job)).toBe("Development");
  });

  it("breaks ties by first match (Development before Marketing)", () => {
    // "api marketing" → Development matches "api" (3), Marketing matches "marketing" (3)
    // Development comes first in CATEGORY_RULES, so Development wins
    const job = makeJob({
      title: "API Marketing",
      tags: [],
    });
    expect(classify(job)).toBe("Development");
  });

  it("handles case-insensitive matching", () => {
    const job = makeJob({ title: "GRAPHIC DESIGNER", tags: [] });
    expect(classify(job)).toBe("Design");
  });

  it("uses job_title field for matching", () => {
    const job = makeJob({
      title: "Hiring Now",
      job_title: "Frontend Developer",
      tags: [],
    });
    expect(classify(job)).toBe("Development");
  });
});
