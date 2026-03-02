import { config } from "../config";
import { Log } from "../logger";

// simple middleware functions that enforce API or admin keys
export function apiKeyGuard(ctx: { request?: Request; set: any }) {
  const request = ctx.request;
  if (!request) return; // nothing to validate at setup time

  const key = request.headers.get("x-api-key");
  if (!key || key !== config.apiKey) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    Log("AUTH", `Invalid API key from ip=${ip}`);
    ctx.set.status = 401;
    return { success: false, message: "Invalid or missing API key" };
  }
}

export function adminKeyGuard(ctx: { request?: Request; set: any }) {
  const request = ctx.request;
  if (!request) return;

  const key = request.headers.get("x-admin-key");
  if (!key || key !== config.adminKey) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    Log("AUTH", `Invalid admin key from ip=${ip}`);
    ctx.set.status = 401;
    return { success: false, message: "Invalid or missing admin key" };
  }
}
