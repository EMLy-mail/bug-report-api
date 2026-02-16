import { Elysia, t } from "elysia";
import { adminKeyGuard } from "../middleware/auth";
import {
  listBugReports,
  getBugReport,
  getFile,
  deleteBugReport,
  updateBugReportStatus,
} from "../services/bugReportService";
import { Log } from "../logger";
import type { BugReportStatus } from "../types";

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(adminKeyGuard)
  .get(
    "/bug-reports",
    async ({ query }) => {
      const page = parseInt(query.page || "1");
      const pageSize = Math.min(parseInt(query.pageSize || "20"), 100);
      const status = query.status as BugReportStatus | undefined;

      Log("ADMIN", `List bug reports page=${page} pageSize=${pageSize} status=${status || "all"}`);
      return await listBugReports({ page, pageSize, status });
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        status: t.Optional(
          t.Union([
            t.Literal("new"),
            t.Literal("in_review"),
            t.Literal("resolved"),
            t.Literal("closed"),
          ])
        ),
      }),
      detail: { summary: "List bug reports (paginated)" },
    }
  )
  .get(
    "/bug-reports/:id",
    async ({ params, error }) => {
      Log("ADMIN", `Get bug report id=${params.id}`);
      const result = await getBugReport(parseInt(params.id));
      if (!result) return error(404, { success: false, message: "Report not found" });
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Get bug report with file metadata" },
    }
  )
  .patch(
    "/bug-reports/:id/status",
    async ({ params, body, error }) => {
      Log("ADMIN", `Update status id=${params.id} status=${body.status}`);
      const updated = await updateBugReportStatus(
        parseInt(params.id),
        body.status
      );
      if (!updated)
        return error(404, { success: false, message: "Report not found" });
      return { success: true, message: "Status updated" };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        status: t.Union([
          t.Literal("new"),
          t.Literal("in_review"),
          t.Literal("resolved"),
          t.Literal("closed"),
        ]),
      }),
      detail: { summary: "Update bug report status" },
    }
  )
  .get(
    "/bug-reports/:id/files/:fileId",
    async ({ params, error, set }) => {
      const file = await getFile(parseInt(params.id), parseInt(params.fileId));
      if (!file)
        return error(404, { success: false, message: "File not found" });

      set.headers["content-type"] = file.mime_type;
      set.headers["content-disposition"] =
        `attachment; filename="${file.filename}"`;
      return new Response(file.data);
    },
    {
      params: t.Object({ id: t.String(), fileId: t.String() }),
      detail: { summary: "Download a bug report file" },
    }
  )
  .delete(
    "/bug-reports/:id",
    async ({ params, error }) => {
      Log("ADMIN", `Delete bug report id=${params.id}`);
      const deleted = await deleteBugReport(parseInt(params.id));
      if (!deleted)
        return error(404, { success: false, message: "Report not found" });
      return { success: true, message: "Report deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete a bug report and its files" },
    }
  );
