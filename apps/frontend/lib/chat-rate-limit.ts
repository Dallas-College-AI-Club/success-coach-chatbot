import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "./client";

export function requestBuckets(identity: string, now = Date.now()) {
  return [
    {
      key: `network:${identity}:${Math.floor(now / 300_000)}`,
      limit: 120,
      expires: now + 600_000,
    },
    {
      key: `global:${Math.floor(now / 300_000)}`,
      limit: 300,
      expires: now + 600_000,
    },
    {
      key: `day:${Math.floor(now / 86_400_000)}`,
      limit: 1000,
      expires: now + 172_800_000,
    },
  ];
}

/** Atomic shared counters work across serverless instances. Network allowance
 * accommodates attendees behind one campus IP; the provider key's spend cap is
 * an independent hard budget. No raw IP address or conversation is retained. */
export async function reserveChatRequest(
  req: Request,
  key: string,
): Promise<boolean> {
  if (
    process.env.CHAT_RATE_LIMIT_ENABLED !== "1" &&
    process.env.NODE_ENV !== "production"
  )
    return true;
  const address = (
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-forwarded-for") ||
    "local"
  )
    .split(",")[0]
    .trim();
  const identity = createHmac("sha256", key)
    .update(`major-request-budget:${address}`)
    .digest("hex");
  const buckets = requestBuckets(identity);
  const values = sql.join(
    buckets.map(
      (b) =>
        sql`(${b.key}, 1, ${new Date(b.expires).toISOString()}::timestamptz, ${b.limit}::int)`,
    ),
    sql`, `,
  );
  const result = await getDb().execute(sql`
    WITH expired AS (
      DELETE FROM chat_request_budget WHERE expires_at < now()
    ), limits(bucket, used, expires_at, ceiling) AS (VALUES ${values}), reserved AS (
      INSERT INTO chat_request_budget(bucket, used, expires_at)
      SELECT bucket, used, expires_at FROM limits ORDER BY bucket
      ON CONFLICT (bucket) DO UPDATE SET used = chat_request_budget.used + 1
      WHERE chat_request_budget.used < (SELECT ceiling FROM limits WHERE limits.bucket = chat_request_budget.bucket)
      RETURNING bucket
    ) SELECT count(*)::int AS accepted FROM reserved
  `);
  return Number(result.rows[0]?.accepted) === buckets.length;
}
