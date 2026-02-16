import { Elysia, t } from "elysia";
import { apiKeyGuard } from "../middleware/auth";
import { hwidRateLimit } from "../middleware/rateLimit";
import { createBugReport, addFile } from "../services/bugReportService";
import { Log } from "../logger";
import type { FileRole } from "../types";

const FILE_ROLES: { field: string; role: FileRole; mime: string }[] = [
  { field: "screenshot", role: "screenshot", mime: "image/png" },
  { field: "mail_file", role: "mail_file", mime: "application/octet-stream" },
  { field: "localstorage", role: "localstorage", mime: "application/json" },
  { field: "config", role: "config", mime: "application/json" },
];

export const bugReportRoutes = new Elysia({ prefix: "/api/bug-reports" })
  .use(apiKeyGuard)
  .use(hwidRateLimit)
  .post(
    "/",
    async ({ body, request, set }) => {
      const { name, email, description, hwid, hostname, os_user, system_info } = body;

      // Get submitter IP from headers or connection
      const submitterIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

      Log("BUGREPORT", `Received from name=${name} hwid=${hwid || "none"} ip=${submitterIp}`);

      // Parse system_info — may arrive as a JSON string or already-parsed object
      let systemInfo: Record<string, unknown> | null = null;
      if (system_info) {
        if (typeof system_info === "string") {
          try {
            systemInfo = JSON.parse(system_info);
          } catch {
            systemInfo = null;
          }
        } else if (typeof system_info === "object") {
          systemInfo = system_info as Record<string, unknown>;
        }
      }

      // Create the bug report
      const reportId = await createBugReport({
        name,
        email,
        description,
        hwid: hwid || "",
        hostname: hostname || "",
        os_user: os_user || "",
        submitter_ip: submitterIp,
        system_info: systemInfo,
      });

      // Process file uploads
      for (const { field, role, mime } of FILE_ROLES) {
        const file = body[field as keyof typeof body];
        if (file && file instanceof File) {
          const buffer = Buffer.from(await file.arrayBuffer());
          Log("BUGREPORT", `File uploaded: role=${role} size=${buffer.length} bytes`);
          await addFile({
            report_id: reportId,
            file_role: role,
            filename: file.name || `${field}.bin`,
            mime_type: file.type || mime,
            file_size: buffer.length,
            data: buffer,
          });
        }
      }

      Log("BUGREPORT", `Created successfully with id=${reportId}`);

      set.status = 201;
      return {
        success: true,
        report_id: reportId,
        message: "Bug report submitted successfully",
      };
    },
    {
      type: "multipart/form-data",
      body: t.Object({
        name: t.String(),
        email: t.String(),
        description: t.String(),
        hwid: t.Optional(t.String()),
        hostname: t.Optional(t.String()),
        os_user: t.Optional(t.String()),
        system_info: t.Optional(t.Any()),
        screenshot: t.Optional(t.File()),
        mail_file: t.Optional(t.File()),
        localstorage: t.Optional(t.File()),
        config: t.Optional(t.File()),
      }),
      response: {
        201: t.Object({
          success: t.Boolean(),
          report_id: t.Number(),
          message: t.String(),
        }),
      },
      detail: { summary: "Submit a bug report" },
    }
  );
