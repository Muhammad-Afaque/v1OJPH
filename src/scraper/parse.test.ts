import { describe, it, expect } from "vitest";
import { parseCards, extractJobId } from "./parse";

const SAMPLE_LISTING_HTML = `
<html>
<body>
<div class="jobpost-cat-box">
  <img class="jobpost-cat-box-logo" alt="Tech Corp" src="/logo.png">
  <div class="desc">
    <h4 class="fs-16 fw-700">
      <span class="badge">Full Time</span>
      Senior React Developer
    </h4>
    <dl class="row no-gutters">
      <dd class="col">$1500 per month</dd>
    </dl>
    <p class="fs-13 mb-0"><em>Posted on Jan 15, 2026</em></p>
    <a href="/jobseekers/job/123456">View Job</a>
  </div>
  <div class="job-tag">
    <a class="badge">javascript</a>
    <a class="badge">react</a>
    <a class="badge">node.js</a>
  </div>
</div>

<div class="jobpost-cat-box">
  <img class="jobpost-cat-box-logo" alt="Startup Inc" src="/logo2.png">
  <div class="desc">
    <h4 class="fs-16 fw-700">
      Part Time
      Virtual Assistant
    </h4>
    <dl class="row no-gutters">
      <dd class="col">$500 per month</dd>
    </dl>
    <p class="fs-13 mb-0"><em>Posted on Jan 10, 2026</em></p>
    <a href="/jobseekers/job/789012">View Job</a>
  </div>
  <div class="job-tag">
    <a class="badge">data entry</a>
    <a class="badge">admin</a>
  </div>
</div>

<div class="jobpost-cat-box">
  <div class="desc">
    <h4 class="fs-16 fw-700">No Logo Job</h4>
    <dl class="row no-gutters">
      <dd class="col">N/A</dd>
    </dl>
    <p class="fs-13 mb-0"><em>Posted on Jan 5, 2026</em></p>
    <a href="/jobseekers/job/345678">View Job</a>
  </div>
</div>
</body>
</html>
`;

describe("extractJobId", () => {
  it("extracts job id from URL", () => {
    expect(extractJobId("https://www.onlinejobs.ph/jobseekers/job/123456")).toBe("123456");
  });

  it("extracts job id from relative URL", () => {
    expect(extractJobId("/jobseekers/job/789012")).toBe("789012");
  });

  it("handles trailing slash", () => {
    expect(extractJobId("/jobseekers/job/345678/")).toBe("345678");
  });

  it("returns null for invalid URL", () => {
    expect(extractJobId("N/A")).toBeNull();
  });
});

describe("parseCards", () => {
  it("parses job cards from listing HTML", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs.length).toBe(3);
  });

  it("extracts job_id from URL", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].job_id).toBe("123456");
    expect(jobs[1].job_id).toBe("789012");
    expect(jobs[2].job_id).toBe("345678");
  });

  it("extracts title", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].title).toBe("Senior React Developer");
    expect(jobs[1].title).toBe("Virtual Assistant");
  });

  it("extracts company from logo alt text", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].company).toBe("Tech Corp");
    expect(jobs[1].company).toBe("Startup Inc");
  });

  it("defaults company to N/A when no logo", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[2].company).toBe("N/A");
  });

  it("extracts work type from badge", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].type).toBe("Full Time");
    expect(jobs[1].type).toBe("Part Time");
  });

  it("extracts salary", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].salary).toBe("$1500 per month");
    expect(jobs[1].salary).toBe("$500 per month");
  });

  it("extracts posted date", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].posted).toBe("Jan 15, 2026");
    expect(jobs[1].posted).toBe("Jan 10, 2026");
  });

  it("extracts tags", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].tags).toEqual(["javascript", "react", "node.js"]);
    expect(jobs[1].tags).toEqual(["data entry", "admin"]);
  });

  it("returns empty tags when none present", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[2].tags).toEqual([]);
  });

  it("builds full URL", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].url).toBe("https://www.onlinejobs.ph/jobseekers/job/123456");
  });

  it("includes scraped_at timestamp", () => {
    const jobs = parseCards(SAMPLE_LISTING_HTML);
    expect(jobs[0].scraped_at).toBeTruthy();
    expect(new Date(jobs[0].scraped_at).getTime()).not.toBeNaN();
  });
});

describe("parseCards - edge cases", () => {
  it("returns empty array for HTML with no job cards", () => {
    const html = "<html><body><p>No jobs here</p></body></html>";
    const jobs = parseCards(html);
    expect(jobs).toEqual([]);
  });

  it("handles missing salary gracefully", () => {
    const html = `
      <div class="jobpost-cat-box">
        <div class="desc">
          <h4 class="fs-16 fw-700">Job Title</h4>
          <a href="/jobseekers/job/999">View</a>
        </div>
      </div>
    `;
    const jobs = parseCards(html);
    expect(jobs[0].salary).toBe("N/A");
  });

  it("handles missing posted date gracefully", () => {
    const html = `
      <div class="jobpost-cat-box">
        <div class="desc">
          <h4 class="fs-16 fw-700">Job Title</h4>
          <a href="/jobseekers/job/999">View</a>
        </div>
      </div>
    `;
    const jobs = parseCards(html);
    expect(jobs[0].posted).toBe("N/A");
  });
});
