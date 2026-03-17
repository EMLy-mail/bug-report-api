import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { config, validateConfig } from "./config";
import { runMigrations } from "./db/migrate";
import { closePool } from "./db/connection";
import { bugReportRoutes } from "./routes/bugReports";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { featuresRoutes } from "./routes/features";
import { initLogger, Log } from "./logger";
import { adminKeyGuard2 } from "./middleware/auth";

const INSTANCE_ID =
  process.env.HOSTNAME + "_" + Math.random().toString(16).slice(2, 6);

// Initialize logger
initLogger();

// Validate environment
try {
  validateConfig();
} catch (error) {
  Log("ERROR", "Failed to validate config:", error);
  process.exit(1);
}

// Run database migrations
try {
  await runMigrations();
} catch (error) {
  Log("ERROR", "Failed to run migrations:", error);
  process.exit(1);
}

const app = new Elysia()
  .onRequest(({ request, set }) => {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") ?? "unknown";
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    if (url.pathname !== "/api/admin/auth/validate")
      Log(
        "HTTP",
        `[${INSTANCE_ID}] ${request.method} ${url.pathname} from ${ip}`,
      );
    set.headers["x-instance-id"] = INSTANCE_ID;
    set.headers["x-server"] = "EMLy-API";
  })
  .onAfterResponse(({ request, set }) => {
    const url = new URL(request.url);
    if (url.pathname !== "/api/admin/auth/validate")
      Log("HTTP", `${request.method} ${url.pathname} -> ${set.status ?? 200}`);
  })
  .onError(({ error, set, code }) => {
    console.error("Error processing request:", error);
    console.log(code);
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { success: false, message: "Not found" };
    }
    if (code === "VALIDATION") {
      set.status = 422;
      return { success: false, message: "Validation error" };
    }
    if (typeof code === "number") {
      set.status = code;
      return (error as any).response;
    }
    Log("ERROR", "Unhandled error:", error);
    set.status = 500;
    return { success: false, message: "Internal server error" };
  })
  .get("/health", () => ({
    status: "ok",
    instance: INSTANCE_ID,
    timestamp: new Date().toISOString(),
  }))
  .get("/", () => ({ status: "ok", message: "API is running" }))
  .use(
    new Elysia().use(adminKeyGuard2).use(
      swagger({
        path: "/swagger",
        documentation: {
          info: { title: "EMLy Bug Report API", version: "1.0.0" },
          tags: [
            { name: "Bug Reports", description: "Submit bug reports" },
            { name: "Auth", description: "Admin authentication" },
            { name: "Admin", description: "Admin bug report management" },
            { name: "Features", description: "Feature flags" },
          ],
          components: {
            securitySchemes: {
              apiKey: { type: "apiKey", in: "header", name: "x-api-key" },
              adminKey: { type: "apiKey", in: "header", name: "x-admin-key" },
            },
          },
        },
      }),
    ),
  )
  .use(featuresRoutes)
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
  `EMLy Bug Report API running on http://localhost:${app.server?.port}`,
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
