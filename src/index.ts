import { Elysia } from "elysia";
import { config, validateConfig } from "./config";
import { runMigrations } from "./db/migrate";
import { closePool } from "./db/connection";
import { bugReportRoutes } from "./routes/bugReports";
import { adminRoutes } from "./routes/admin";
import { initLogger, Log } from "./logger";

// Initialize logger
initLogger();

// Validate environment
validateConfig();

// Run database migrations
await runMigrations();

const app = new Elysia()
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    Log("HTTP", `${request.method} ${url.pathname} from ${ip}`);
  })
  .onAfterResponse(({ request, set }) => {
    const url = new URL(request.url);
    Log("HTTP", `${request.method} ${url.pathname} -> ${set.status ?? 200}`);
  })
  .onError(({ error, set }) => {
    Log("ERROR", "Unhandled error:", error);
    set.status = 500;
    return { success: false, message: "Internal server error" };
  })
  .get("/health", () => ({ status: "ok", timestamp: new Date().toISOString() }))
  .use(bugReportRoutes)
  .use(adminRoutes)
  .listen({
    port: config.port,
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
