import { Elysia } from "elysia";
import { getPool } from "../db/connection";
import { config } from "../config";
import { Log } from "../logger";

const excludedHwids = new Set<string>([
  // Add HWIDs here for development testing
  "95e025d1-7567-462e-9354-ac88b965cd22",
]);

export const hwidRateLimit = new Elysia({ name: "hwid-rate-limit" }).derive(
  { as: "scoped" },
  // @ts-ignore
  async ({ body, error }) => {
    const hwid = (body as { hwid?: string })?.hwid;
    if (!hwid || excludedHwids.has(hwid)) {
      // No HWID provided or excluded, skip rate limiting
      return {};
    }

    const pool = getPool();
    const windowMs = config.rateLimit.windowHours * 60 * 60 * 1000;
    const now = new Date();

    // Get current rate limit entry
    const [rows] = await pool.execute(
      "SELECT window_start, count FROM rate_limit_hwid WHERE hwid = ?",
      [hwid]
    );

    const entries = rows as { window_start: Date; count: number }[];

    if (entries.length === 0) {
      // First request from this HWID
      await pool.execute(
        "INSERT INTO rate_limit_hwid (hwid, window_start, count) VALUES (?, ?, 1)",
        [hwid, now]
      );
      return {};
    }

    const entry = entries[0];
    const windowStart = new Date(entry.window_start);
    const elapsed = now.getTime() - windowStart.getTime();

    if (elapsed > windowMs) {
      // Window expired, reset
      await pool.execute(
        "UPDATE rate_limit_hwid SET window_start = ?, count = 1 WHERE hwid = ?",
        [now, hwid]
      );
      return {};
    }

    if (entry.count >= config.rateLimit.max) {
      const retryAfterMs = windowMs - elapsed;
      const retryAfterMin = Math.ceil(retryAfterMs / 60000);
      Log("RATELIMIT", `Rate limit hit hwid=${hwid} count=${entry.count}`);
      return error(429, {
        success: false,
        message: `Rate limit exceeded. Try again in ${retryAfterMin} minutes.`,
      });
    }

    // Increment count
    await pool.execute(
      "UPDATE rate_limit_hwid SET count = count + 1 WHERE hwid = ?",
      [hwid]
    );
    return {};
  }
);
