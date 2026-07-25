import type { Job } from "./types";

interface CategoryRule {
  tags: string[];
  titles: string[];
}

const CATEGORY_RULES: Record<string, CategoryRule> = {
  Design: {
    tags: [
      "graphic design", "animation", "video editing", "motion graphics",
      "photo editing", "visual design", "character design", "branding",
      "creative advertising", "advertising and marketing design",
      "landing page design", "film editing", "sound design",
      "product commercial editing", "thumbnail & social media design",
      "2d animation", "3d animation", "infographics", "visual creation",
      "video content creation", "creative direction", "movie editing",
      "apple final cut pro", "adobe premiere pro", "after effects",
      "photoshop", "indesign", "figma", "canva", "capcut",
      "funnel design", "design strategy", "videography",
    ],
    titles: [
      "graphic designer", "video editor", "animator", "motion designer",
      "visual designer", "character designer", "creative designer",
      "illustrator", "3d artist", "motion graphics", "rv park designer",
      "animation designer", "photo editor", "thumbnail designer",
      "design specialist", "brand designer", "funnel designer",
      "ai video creator", "ai video editor", "video creator",
      "content editor video", "video production", "ai creator",
      "autocad", "drafter", "website design",
    ],
  },
  Development: {
    tags: [
      "python", "javascript", "vue.js", "vue js", "node.js", "node js",
      "postgresql", "rest api", "api integration", "api development",
      "fullstack", "web programming", "stripe api", "robotic process automation",
      "it", "it asset management", "technology proficiency",
    ],
    titles: [
      "developer", "programmer", "engineer", "full-stack", "full stack",
      "tech lead", "software", "frontend", "backend", "web developer",
      "app developer", "api", "prompt engineer", "automation developer",
      "trading automation", "ai expert", "ai agent",
      "ai automation", "automation specialist", "workflow specialist",
      "agent builder", "ai specialist", "claude",
      "glide app", "app mvp",
    ],
  },
  Marketing: {
    tags: [
      "social media content creation", "social media management",
      "social media video editing", "social media marketing",
      "social media engagement", "social media moderation",
      "marketing", "facebook ads", "google ads", "tiktok ads",
      "email marketing", "performance marketing", "influencer marketing",
      "youtube marketing", "instagram marketing", "affiliate marketing",
      "digital marketing", "content creation", "video marketing",
      "seo analysis", "keyword research", "linkedin marketing",
      "marketing automation", "meta business suite", "meta pixel",
      "ads management", "marketing management", "public relation",
      "brand analysis", "copywriting", "community moderation",
      "forum community moderation", "gohighlevel", "mobile app",
    ],
    titles: [
      "social media", "marketing", "ads manager", "marketer",
      "content creator", "content strategist", "growth",
      "seo", "ppc", "media buyer", "creative strategist",
      "brand manager", "pr manager", "public relations",
      "community manager", "community growth", "outreach",
      "influencer", "affiliate", "pinterest manager",
      "pinterest content", "tiktok", "youtuber",
      "content producer", "content marketer", "marketing va",
      "digital marketer", "marketing coordinator",
      "content marketing", "performance marketer",
      "ads specialist", "ad specialist",
      "gohighlevel", "client success", "reddit",
      "ad creator", "creative ads",
    ],
  },
  VA: {
    tags: [
      "virtual assistant", "customer service", "customer support",
      "data entry", "email support", "phone support", "chat support",
      "administrative management", "office and administration",
      "file management", "organization", "personal assistant",
      "appointment setting", "calendly", "attention to detail",
      "computer literacy", "customer relationship management",
      "communication", "english speaking", "english proficiency",
      "english", "onboarding", "e-commerce", "ecommerce",
      "product research", "fba", "keepa", "product analysis",
      "catalog management", "seller central", "inventory management",
      "logistics management", "dispatching", "supply management",
      "supply chain management",
    ],
    titles: [
      "virtual assistant", "va", "admin", "receptionist",
      "administrative", "executive assistant", "personal assistant",
      "customer support", "customer service", "data entry",
      "appointment setter", "appointment setting",
      "client communication", "client support",
      "guest support", "guest experience",
      "remote receptionist", "virtual receptionist",
      "order verification", "support specialist",
      "assistant", "coordination", "coordinator",
      "operations assistant", "operations va",
      "general va", "leasing coordinator",
      "operations coordinator", "leasing specialist",
      "product lister", "concierge", "fba",
      "amazon admin", "etsy", "recruiter", "recruiting",
      "logistic", "motor pool", "dispatch", "dispatcher",
    ],
  },
  Writing: {
    tags: [
      "writing", "copywriting", "blogging", "ebook writing",
      "creative writing", "technical writing", "scriptwriting",
      "sop writing", "content writing",
    ],
    titles: [
      "writer", "copywriter", "content writer", "blogger",
      "content editor", "proofreader", "proposal writer",
      "rfp", "sop specialist", "sop writer",
      "linkedin writer", "medical content writer",
      "scriptwriter", "kindle",
    ],
  },
  Finance: {
    tags: [
      "bookkeeping", "financial accounting", "quickbooks",
      "financial planning", "financial analysis",
      "financial forcasting", "forecasting", "xero",
      "invoicing", "costing", "finance management",
      "credit repair", "estimate", "quantity takeoff",
      "simpro", "payroll",
    ],
    titles: [
      "bookkeeper", "accountant", "accounting",
      "cfo", "chief financial officer", "finance",
      "financial", "auditor", "audit",
      "external audit", "financial operations",
      "credit repair", "estimator",
      "mortgage", "loan processor", "enrolled agent",
      "tax", "payroll",
    ],
  },
  Sales: {
    tags: [
      "sales", "outbound calls", "cold calling", "outbound sales",
      "inbound sales", "telemarketing", "lead generation",
      "business development", "account acquisition",
      "acquisition", "sales management", "sales support",
      "b2b", "negotiation",
    ],
    titles: [
      "sales", "cold caller", "telemarketer", "sdr",
      "sales development", "business development",
      "lead generation", "lead gen", "acquisition",
      "closer", "sales representative",
      "sales caller", "sales coordinator",
      "sales support", "outbound", "sales agent",
      "account executive",
    ],
  },
  "Real Estate": {
    tags: [
      "short term rentals", "airbnb", "real estate marketing",
      "gohighlevel real estate", "appfolio", "hostaway",
    ],
    titles: [
      "real estate", "property", "leasing", "airbnb",
      "short term rental", "str", "rental",
      "transaction coordinator", "mls",
      "realestate", "property manager",
    ],
  },
  Medical: {
    tags: [
      "medical knowledge", "credentialing", "medical virtual assistant",
      "patient care", "medical insurance", "prior authorization",
      "electronic health record", "healthcare",
    ],
    titles: [
      "medical", "medva", "med ", "healthcare",
      "dental", "clinical", "patient",
      "prior authorization", "care coordinator",
      "medical assistant", "nurse", "doctor",
    ],
  },
};

export function classify(job: Job): string {
  const title = (job.title || "").toLowerCase();
  const jobTitle = (job.job_title || "").toLowerCase();
  const combinedTitle = `${title} ${jobTitle}`;
  const tagsLower = (job.tags || []).map((t) => t.toLowerCase());

  const scores: Record<string, number> = {};

  for (const [category, rules] of Object.entries(CATEGORY_RULES)) {
    let score = 0;

    // Tag matching: exact match = 2, partial match (rule_tag in tag) = 1
    for (const tag of tagsLower) {
      if (rules.tags.includes(tag)) {
        score += 2;
      } else {
        for (const ruleTag of rules.tags) {
          if (ruleTag.length > 3 && ruleTag.includes(tag)) {
            score += 1;
            break;
          }
        }
      }
    }

    // Title matching: keyword in combined title = 3
    for (const keyword of rules.titles) {
      if (combinedTitle.includes(keyword)) {
        score += 3;
      }
    }

    if (score > 0) {
      scores[category] = score;
    }
  }

  if (Object.keys(scores).length === 0) {
    return "Other";
  }

  // Find max score, break ties by first match (entries are in CATEGORY_RULES order)
  let maxScore = 0;
  for (const score of Object.values(scores)) {
    if (score > maxScore) {
      maxScore = score;
    }
  }

  for (const [cat, score] of Object.entries(scores)) {
    if (score === maxScore) {
      return cat;
    }
  }

  return "Other";
}
