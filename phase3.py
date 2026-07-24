import json
import os
from collections import Counter

INPUT_FILE = "enriched_jobs.json"
OUTPUT_FILE = "enriched_jobs.json"
CHUNKS_DIR = "chunks"
CHUNK_MAX_BYTES = 10 * 1024 * 1024  # 10MB per chunk

CATEGORY_RULES = {
    "Design": {
        "tags": [
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
        "titles": [
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
    "Development": {
        "tags": [
            "python", "javascript", "vue.js", "vue js", "node.js", "node js",
            "postgresql", "rest api", "api integration", "api development",
            "fullstack", "web programming", "stripe api", "robotic process automation",
            "it", "it asset management", "technology proficiency",
        ],
        "titles": [
            "developer", "programmer", "engineer", "full-stack", "full stack",
            "tech lead", "software", "frontend", "backend", "web developer",
            "app developer", "api", "prompt engineer", "automation developer",
            "trading automation", "ai expert", "ai agent",
            "ai automation", "automation specialist", "workflow specialist",
            "agent builder", "ai specialist", "claude",
            "glide app", "app mvp",
        ],
    },
    "Marketing": {
        "tags": [
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
        "titles": [
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
    "VA": {
        "tags": [
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
        "titles": [
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
    "Writing": {
        "tags": [
            "writing", "copywriting", "blogging", "ebook writing",
            "creative writing", "technical writing", "scriptwriting",
            "sop writing", "content writing",
        ],
        "titles": [
            "writer", "copywriter", "content writer", "blogger",
            "content editor", "proofreader", "proposal writer",
            "rfp", "sop specialist", "sop writer",
            "linkedin writer", "medical content writer",
            "scriptwriter", "kindle",
        ],
    },
    "Finance": {
        "tags": [
            "bookkeeping", "financial accounting", "quickbooks",
            "financial planning", "financial analysis",
            "financial forcasting", "forecasting", "xero",
            "invoicing", "costing", "finance management",
            "credit repair", "estimate", "quantity takeoff",
            "simpro", "payroll",
        ],
        "titles": [
            "bookkeeper", "accountant", "accounting",
            "cfo", "chief financial officer", "finance",
            "financial", "auditor", "audit",
            "external audit", "financial operations",
            "credit repair", "estimator",
            "mortgage", "loan processor", "enrolled agent",
            "tax", "payroll",
        ],
    },
    "Sales": {
        "tags": [
            "sales", "outbound calls", "cold calling", "outbound sales",
            "inbound sales", "telemarketing", "lead generation",
            "business development", "account acquisition",
            "acquisition", "sales management", "sales support",
            "b2b", "negotiation",
        ],
        "titles": [
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
        "tags": [
            "short term rentals", "airbnb", "real estate marketing",
            "gohighlevel real estate", "appfolio", "hostaway",
        ],
        "titles": [
            "real estate", "property", "leasing", "airbnb",
            "short term rental", "str", "rental",
            "transaction coordinator", "mls",
            "realestate", "property manager",
        ],
    },
    "Medical": {
        "tags": [
            "medical knowledge", "credentialing", "medical virtual assistant",
            "patient care", "medical insurance", "prior authorization",
            "electronic health record", "healthcare",
        ],
        "titles": [
            "medical", "medva", "med ", "healthcare",
            "dental", "clinical", "patient",
            "prior authorization", "care coordinator",
            "medical assistant", "nurse", "doctor",
        ],
    },
}


def write_chunks(jobs):
    os.makedirs(CHUNKS_DIR, exist_ok=True)
    for f in os.listdir(CHUNKS_DIR):
        if f.startswith("chunk_") and f.endswith(".json"):
            os.remove(os.path.join(CHUNKS_DIR, f))

    chunks = []
    current_chunk = []
    current_size = 2  # opening bracket + indent overhead

    for job in jobs:
        job_bytes = len(json.dumps(job, ensure_ascii=False)) + 2  # +2 for comma/newline
        if current_chunk and current_size + job_bytes > CHUNK_MAX_BYTES:
            chunks.append(current_chunk)
            current_chunk = []
            current_size = 2
        current_chunk.append(job)
        current_size += job_bytes

    if current_chunk:
        chunks.append(current_chunk)

    for i, chunk in enumerate(chunks, 1):
        path = os.path.join(CHUNKS_DIR, f"chunk_{i:03d}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False)
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"  {path}: {len(chunk)} jobs, {size_mb:.1f}MB")

    print(f"Wrote {len(chunks)} chunks to {CHUNKS_DIR}/")
    return len(chunks)


def classify(job):
    title = job.get("title", "").lower()
    title_detailed = job.get("job_title", "").lower()
    combined_title = f"{title} {title_detailed}"
    tags_lower = [t.lower() for t in job.get("tags", [])]

    scores = {}

    for category, rules in CATEGORY_RULES.items():
        score = 0

        for tag in tags_lower:
            if tag in rules["tags"]:
                score += 2
            else:
                for rule_tag in rules["tags"]:
                    if len(rule_tag) > 3 and rule_tag in tag:
                        score += 1
                        break

        for keyword in rules["titles"]:
            if keyword in combined_title:
                score += 3

        if score > 0:
            scores[category] = score

    if not scores:
        return "Other"

    max_score = max(scores.values())
    winners = [cat for cat, score in scores.items() if score == max_score]

    return winners[0]


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"No {INPUT_FILE}. Run phase2.py first.")
        return

    jobs = json.load(open(INPUT_FILE, "r", encoding="utf-8"))

    for job in jobs:
        job["category"] = classify(job)

    json.dump(jobs, open(OUTPUT_FILE, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    write_chunks(jobs)

    counts = Counter(j["category"] for j in jobs)
    print(f"Categorized {len(jobs)} jobs")
    print(f"{'='*40}")
    for cat, count in counts.most_common():
        pct = count / len(jobs) * 100
        print(f"  {cat:15s} {count:3d} ({pct:.0f}%)")
    print(f"{'='*40}")

    # Per-category files
    cat_dir = "categories"
    os.makedirs(cat_dir, exist_ok=True)
    for cat in counts:
        cat_jobs = [j for j in jobs if j["category"] == cat]
        filename = os.path.join(cat_dir, f"{cat.lower().replace(' ', '_')}.json")
        json.dump(cat_jobs, open(filename, "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    print(f"\nPer-category files written to {cat_dir}/")

    # Show some samples
    print(f"\n=== SAMPLE CLASSIFICATIONS ===")
    for job in jobs[:5]:
        print(f"  [{job['category']:12s}] {job['title'][:70]}")

    # Show 'Other' samples to validate
    others = [j for j in jobs if j["category"] == "Other"]
    if others:
        print(f"\n=== 'Other' category ({len(others)} jobs) ===")
        for j in others[:10]:
            print(f"  {j['title'][:80]}")


if __name__ == "__main__":
    main()
