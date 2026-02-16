export const config = {
  mysql: {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "emly",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "emly_bugreports",
  },
  apiKey: process.env.API_KEY || "",
  adminKey: process.env.ADMIN_KEY || "",
  port: parseInt(process.env.PORT || "3000"),
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || "5"),
    windowHours: parseInt(process.env.RATE_LIMIT_WINDOW_HOURS || "24"),
  },
} as const;

// Validate required config on startup
export function validateConfig(): void {
  if (!config.apiKey) throw new Error("API_KEY is required");
  if (!config.adminKey) throw new Error("ADMIN_KEY is required");
  if (!config.mysql.password)
    throw new Error("MYSQL_PASSWORD is required");
}
