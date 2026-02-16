import { Elysia } from "elysia";
import { config } from "../config";
import { Log } from "../logger";

export const apiKeyGuard = new Elysia({ name: "api-key-guard" }).derive(
  { as: "scoped" },
  ({ headers, error, request }) => {
    const key = headers["x-api-key"];
    if (!key || key !== config.apiKey) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
      Log("AUTH", `Invalid API key from ip=${ip}`);
      return error(401, { success: false, message: "Invalid or missing API key" });
    }
    return {};
  }
);

export const adminKeyGuard = new Elysia({ name: "admin-key-guard" }).derive(
  { as: "scoped" },
  ({ headers, error, request }) => {
    const key = headers["x-admin-key"];
    if (!key || key !== config.adminKey) {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";
      Log("AUTH", `Invalid admin key from ip=${ip}`);
      return error(401, { success: false, message: "Invalid or missing admin key" });
    }
    return {};
  }
);
