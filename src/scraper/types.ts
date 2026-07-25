export type Category =
  | "VA"
  | "Marketing"
  | "Design"
  | "Development"
  | "Sales"
  | "Finance"
  | "Writing"
  | "Medical"
  | "Real Estate"
  | "Other";

export interface Job {
  job_id: string;
  title: string;
  company: string;
  type: string;
  salary: string;
  posted: string;
  url: string;
  tags: string[];
  scraped_at: string;

  // Detail fields (from Phase 2)
  job_title: string;
  work_type: string;
  salary_detail: string;
  hours: string;
  date_updated: string;
  description: string;
  company_detail: string;
  contact_person: string;
  detail_scraped_at: string;

  // Category (from Phase 3)
  category: Category;

  // User-editable fields
  email: string;
  extra_description: string;
  custom_notes: string[];
  source_info: string;
  status: string;
  contact_info: string;
  notes: string;
}

export interface JobListItem {
  job_id: string;
  title: string;
  company: string;
  type: string;
  salary: string;
  posted: string;
  url: string;
  tags: string[];
  scraped_at: string;
}

export interface JobDetail {
  job_title: string;
  work_type: string;
  salary_detail: string;
  hours: string;
  date_updated: string;
  description: string;
  company_detail: string;
  contact_person: string;
}

export interface PaginatedResponse<T> {
  jobs: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StatsResponse {
  total: number;
  with_salary: number;
  salary_pct: number;
  categories: { name: string; count: number }[];
  work_types: { type: string; count: number }[];
  salary_ranges: Record<string, number>;
  posting_timeline: { date: string; count: number }[];
  top_tags: { name: string; count: number }[];
}
