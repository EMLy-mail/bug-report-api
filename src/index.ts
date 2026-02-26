import { Elysia } from "elysia";
import { config, validateConfig } from "./config";
import { runMigrations } from "./db/migrate";
import { closePool } from "./db/connection";
import { bugReportRoutes } from "./routes/bugReports";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { initLogger, Log } from "./logger";

const INSTANCE_ID = process.env.HOSTNAME + "_" + Math.random().toString(16).slice(2, 6);

// Initialize logger
initLogger();

// Validate environment
validateConfig();

// Run database migrations
try {
  await runMigrations();
} catch (error) {
  Log("ERROR", "Failed to run migrations:", error);
  process.exit(1);
}

const app = new Elysia()
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    Log("HTTP", `[${INSTANCE_ID}] ${request.method} ${url.pathname} from ${ip}`);
  })
  .onAfterResponse(({ request, set }) => {
    const url = new URL(request.url);
    Log("HTTP", `${request.method} ${url.pathname} -> ${set.status ?? 200}`);
  })
  .onError(({ error, set, code }) => {
    console.error("Error processing request:", error);
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { success: false, message: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 422;
      return { success: false, message: "Validation error" };
    }
    Log("ERROR", "Unhandled error:", error);
    set.status = 500;
    return { success: false, message: "Internal server error" };
  })
  .get("/health", () => ({ status: "ok", instance: INSTANCE_ID, timestamp: new Date().toISOString() }))
  .get("/", () => ({ status: "ok", message: "API is running" }))
  .use(bugReportRoutes)
  .use(authRoutes)
  .use(adminRoutes)
  .listen({
    port: config.port,
    //@ts-ignore
    maxBody: 50 * 1024 * 1024, // 50MB
  });

Log(
  "SERVER",
  `EMLy Bug Report API running on http://localhost:${app.server?.port}`
);

// Graceful shutdown
process.on("SIGINT", async () => {
  Log("SERVER", "Shutting down (SIGINT)...");
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  Log("SERVER", "Shutting down (SIGTERM)...");
  await closePool();
  process.exit(0);
});
