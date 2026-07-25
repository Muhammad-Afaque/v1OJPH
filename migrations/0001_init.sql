-- D1 Schema for OnlineJobs.ph Scraper

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  title TEXT,
  company TEXT,
  type TEXT,
  salary TEXT,
  posted TEXT,
  url TEXT,
  tags TEXT DEFAULT '[]',
  scraped_at TEXT,

  -- Detail fields (from Phase 2)
  job_title TEXT,
  work_type TEXT,
  salary_detail TEXT,
  hours TEXT,
  date_updated TEXT,
  description TEXT,
  company_detail TEXT,
  contact_person TEXT,
  detail_scraped_at TEXT,

  -- Category (from Phase 3)
  category TEXT DEFAULT 'Other',

  -- User-editable fields
  email TEXT DEFAULT '',
  extra_description TEXT DEFAULT '',
  custom_notes TEXT DEFAULT '[]',
  source_info TEXT DEFAULT '',
  status TEXT DEFAULT '',
  contact_info TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5(
  title,
  company,
  description,
  tags,
  content='jobs',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS jobs_ai AFTER INSERT ON jobs BEGIN
  INSERT INTO jobs_fts(rowid, title, company, description, tags)
  VALUES (new.rowid, new.title, new.company, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS jobs_ad AFTER DELETE ON jobs BEGIN
  INSERT INTO jobs_fts(jobs_fts, rowid, title, company, description, tags)
  VALUES ('delete', old.rowid, old.title, old.company, old.description, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS jobs_au AFTER UPDATE ON jobs BEGIN
  INSERT INTO jobs_fts(jobs_fts, rowid, title, company, description, tags)
  VALUES ('delete', old.rowid, old.title, old.company, old.description, old.tags);
  INSERT INTO jobs_fts(rowid, title, company, description, tags)
  VALUES (new.rowid, new.title, new.company, new.description, new.tags);
END;
