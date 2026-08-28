/**
 * D1 HTTP API adapter for running outside of a Cloudflare Worker.
 *
 * Cloudflare's D1 normally surfaces as a Worker binding (c.env.D1_DATABASE).
 * From Node/GitHub Actions there is no binding, so we talk to the D1 HTTP API
 * using an API token:
 *
 *   POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query
 *
 * Credentials come from environment variables (never hardcoded):
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - CLOUDFLARE_D1_DATABASE_ID
 *   - CLOUDFLARE_API_TOKEN
 *
 * The object produced here implements the same small `prepare(...).bind(...)`
 * interface the binding‑based client in ./d1.ts expects, so `createD1Client`
 * can be reused unchanged against a remote database.
 */

export interface D1HttpOptions {
  accountId?: string;
  databaseId?: string;
  apiToken?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function requiredEnv(name: string): string | undefined {
  return process.env[name];
}

export function createD1Database(options: D1HttpOptions = {}) {
  // Each credential can be provided explicitly via options OR read from the
  // corresponding environment variable. We only require the variable when the
  // option wasn't supplied, so callers can inject values (e.g. in tests).
  const accountId = options.accountId ?? requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  const databaseId =
    options.databaseId ?? requiredEnv("CLOUDFLARE_D1_DATABASE_ID");
  const apiToken = options.apiToken ?? requiredEnv("CLOUDFLARE_API_TOKEN");
  const baseUrl = options.baseUrl ?? "https://api.cloudflare.com/client/v4";
  const fetchImpl = options.fetchImpl ?? fetch;

  const missing = [
    ["accountId / CLOUDFLARE_ACCOUNT_ID", accountId],
    ["databaseId / CLOUDFLARE_D1_DATABASE_ID", databaseId],
    ["apiToken / CLOUDFLARE_API_TOKEN", apiToken],
  ].filter(([, v]) => !v);
  if (missing.length) {
    const list = missing.map(([label]) => label).join(", ");
    throw new Error(
      `Missing D1 credential(s): ${list}. Either pass them as options or set the matching environment variables before running the D1 write path.`,
    );
  }

  const endpoint = `${baseUrl}/accounts/${accountId}/d1/database/${databaseId}/query`;

  async function query(sql: string, params: unknown[]) {
    const body = JSON.stringify({ sql, params });
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body,
      });
    } catch (err) {
      throw new Error(`D1 HTTP request failed: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `D1 HTTP API returned ${response.status} ${response.statusText}: ${text}`,
      );
    }

    const json = (await response.json()) as {
      success: boolean;
      errors?: { message?: string }[];
      result?: Array<{
        success: boolean;
        results: unknown[];
        meta?: { changes?: number; rows_read?: number; rows_written?: number };
        error?: string | null;
      }>;
    };

    if (!json.success || !json.result?.length) {
      const detail =
        json.errors?.map((e) => e.message).join("; ") ||
        json.result?.[0]?.error ||
        "unknown error";
      throw new Error(`D1 query failed: ${detail}`);
    }

    return json.result[0];
  }

  function prepare(sql: string) {
    let boundParams: unknown[] = [];
    const instance = {
      bind(...params: unknown[]) {
        boundParams = params;
        return instance;
      },
      async run() {
        const res = await query(sql, boundParams);
        return {
          success: res.success,
          meta: { changes: res.meta?.changes ?? 0 },
        };
      },
      async all<T = Record<string, unknown>>() {
        const res = await query(sql, boundParams);
        return { results: res.results as T[], success: res.success };
      },
      async first<T = Record<string, unknown>>() {
        const res = await query(sql, boundParams);
        return (res.results[0] as T | undefined) ?? null;
      },
    };
    return instance;
  }

  return { prepare };
}

export type D1HttpDatabase = ReturnType<typeof createD1Database>;
