import { config } from "../config";
import { Log } from "../logger";
import Elysia from "elysia";
import type { UnauthorizedResponse } from "../types";

export const apiKeyGuard2 = new Elysia({ name: "api-key-guard" }).derive(
  { as: "scoped" },
  ({ headers, status }): UnauthorizedResponse | {} => {
    const apiKey = headers["x-api-key"];
    if (!apiKey || apiKey !== config.apiKey) {
      throw status(401, { success: false as const, message: "Unauthorized API Key" });
    }
    return {};
  },
);

export const adminKeyGuard2 = new Elysia({ name: "admin-key-guard" }).derive(
  { as: "scoped" },
  ({ headers, status }): UnauthorizedResponse | {} => {
    const apiKey = headers["x-admin-key"];
    if (!apiKey || apiKey !== config.adminKey) {
      throw status(401, { success: false as const, message: "Unauthorized Admin Key" });
    }
    return {};
  },
);
