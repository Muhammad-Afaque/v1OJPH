import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  D1_DATABASE: any;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/api/jobs", async (c) => {
  const db = c.env.D1_DATABASE;
  const url = new URL(c.req.url);

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const sort = url.searchParams.get("sort") || "posted";
  const order = url.searchParams.get("order") || "desc";
  const category = url.searchParams.get("category");
  const type = url.searchParams.get("type");

  let whereClause = "";
  const params: unknown[] = [];

  if (category) {
    whereClause += " WHERE category = ?";
    params.push(category);
  }

  if (type) {
    whereClause += whereClause ? " AND work_type = ?" : " WHERE work_type = ?";
    params.push(type);
  }

  const sortColumn = ["posted", "title", "company", "salary_detail"].includes(sort)
    ? sort
    : "posted";
  const sortOrder = order === "asc" ? "ASC" : "DESC";

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM jobs${whereClause}`)
    .bind(...params)
    .first();
  const total = countResult?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Get paginated results
  const offset = (page - 1) * limit;
  const result = await db
    .prepare(
      `SELECT * FROM jobs${whereClause} ORDER BY ${sortColumn} ${sortOrder} LIMIT ? OFFSET ?`
    )
    .bind(...params, limit, offset)
    .all();

  const jobs = (result.results || []).map((row: Record<string, unknown>) => ({
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags as string) : row.tags || [],
    custom_notes:
      typeof row.custom_notes === "string"
        ? JSON.parse(row.custom_notes as string)
        : row.custom_notes || [],
  }));

  return c.json({
    jobs,
    total,
    page,
    limit,
    totalPages,
  });
});

app.get("/api/jobs/:id", async (c) => {
  const db = c.env.D1_DATABASE;
  const id = c.req.param("id");

  const row = await db
    .prepare("SELECT * FROM jobs WHERE job_id = ?")
    .bind(id)
    .first();

  if (!row) {
    return c.json({ error: "not found" }, 404);
  }

  const job = {
    ...row,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags as string) : row.tags || [],
    custom_notes:
      typeof row.custom_notes === "string"
        ? JSON.parse(row.custom_notes as string)
        : row.custom_notes || [],
  };

  return c.json(job);
});

app.get("/api/stats", async (c) => {
  const db = c.env.D1_DATABASE;

  const totalResult = await db.prepare("SELECT COUNT(*) as count FROM jobs").first();
  const total = totalResult?.count || 0;

  const categoryResult = await db
    .prepare("SELECT category, COUNT(*) as count FROM jobs GROUP BY category ORDER BY count DESC")
    .all();
  const categories = categoryResult.results || [];

  const workTypeResult = await db
    .prepare("SELECT work_type, COUNT(*) as count FROM jobs GROUP BY work_type ORDER BY count DESC")
    .all();
  const workTypes = workTypeResult.results || [];

  return c.json({
    total,
    categories: categories.map((r: Record<string, unknown>) => ({
      name: r.category || "Other",
      count: r.count,
    })),
    workTypes: workTypes.map((r: Record<string, unknown>) => ({
      type: r.work_type || "Unknown",
      count: r.count,
    })),
  });
});

app.post("/api/jobs/:id/notes", async (c) => {
  const db = c.env.D1_DATABASE;
  const id = c.req.param("id");
  const body = await c.req.json();

  const { email, extra_description, custom_notes } = body;

  await db
    .prepare(
      `UPDATE jobs SET email = ?, extra_description = ?, custom_notes = ? WHERE job_id = ?`
    )
    .bind(
      email || "",
      extra_description || "",
      JSON.stringify(custom_notes || []),
      id
    )
    .run();

  return c.json({ ok: true });
});

export { app };
