import { describe, it, expect } from "vitest";
import { parseDetailPage } from "./detail";

const SAMPLE_DETAIL_HTML = `
<html>
<body>
<h1 class="fs-24 fw-600 text-white text-center mb-40 job__title">Senior React Developer</h1>

<div class="card job-post">
  <p class="fs-18">Full Time</p>
  <p class="fs-18">$1500 per month</p>
  <p class="fs-18">40</p>
  <p class="fs-18">Jan 15, 2026</p>
</div>

<p id="job-description" class="job-description">
  We are looking for a Senior React Developer to join our team.
  The ideal candidate will have 5+ years of experience with React,
  TypeScript, and modern web technologies.
</p>
</body>
</html>
`;

const SAMPLE_DETAIL_NO_CARD_HTML = `
<html>
<body>
<h1 class="fs-24 fw-600 text-white text-center mb-40 job__title">Simple Job</h1>
<p id="job-description">A simple job description.</p>
</body>
</html>
`;

const SAMPLE_DETAIL_MINIMAL_HTML = `
<html>
<body>
<p>No structured data here</p>
</body>
</html>
`;

describe("parseDetailPage", () => {
  it("extracts job title", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_HTML);
    expect(detail.job_title).toBe("Senior React Developer");
  });

  it("extracts work type", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_HTML);
    expect(detail.work_type).toBe("Full Time");
  });

  it("extracts salary detail", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_HTML);
    expect(detail.salary_detail).toBe("$1500 per month");
  });

  it("extracts hours", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_HTML);
    expect(detail.hours).toBe("40");
  });

  it("extracts date updated", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_HTML);
    expect(detail.date_updated).toBe("Jan 15, 2026");
  });

  it("extracts description", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_HTML);
    expect(detail.description).toContain("Senior React Developer");
    expect(detail.description).toContain("5+ years of experience");
  });

  it("handles missing card gracefully", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_NO_CARD_HTML);
    expect(detail.job_title).toBe("Simple Job");
    expect(detail.work_type).toBe("N/A");
    expect(detail.salary_detail).toBe("N/A");
    expect(detail.hours).toBe("N/A");
    expect(detail.date_updated).toBe("N/A");
  });

  it("handles minimal HTML gracefully", () => {
    const detail = parseDetailPage(SAMPLE_DETAIL_MINIMAL_HTML);
    expect(detail.job_title).toBe("N/A");
    expect(detail.work_type).toBe("N/A");
    expect(detail.description).toBe("N/A");
  });

  it("extracts description from p.job-description fallback", () => {
    const html = `
      <h1 class="fs-24 fw-600 text-white text-center mb-40 job__title">Job</h1>
      <p class="job-description">Fallback description</p>
    `;
    const detail = parseDetailPage(html);
    expect(detail.description).toBe("Fallback description");
  });
});
