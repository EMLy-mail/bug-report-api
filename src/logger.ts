import { mkdirSync, appendFileSync, existsSync } from "fs";
import { join } from "path";

let logFilePath: string | null = null;

/**
 * Initialize the logger. Creates the logs/ directory if needed
 * and opens the log file in append mode.
 */
export function initLogger(filename = "api.log"): void {
  const logsDir = join(process.cwd(), "logs");
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
  logFilePath = join(logsDir, filename);
  Log("LOGGER", "Logger initialized. Writing to:", logFilePath);
}

/**
 * Log a timestamped, source-tagged message to stdout and the log file.
 * Format: [YYYY-MM-DD] - [HH:MM:SS] - [source] - message
 */
export function Log(source: string, ...args: unknown[]): void {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8);
  const msg = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
    .join(" ");

  const line = `[${date}] - [${time}] - [${source}] - ${msg}`;

  console.log(line);

  if (logFilePath) {
    try {
      appendFileSync(logFilePath, line + "\n");
    } catch {
      // If file write fails, stdout logging still works
    }
  }
}
