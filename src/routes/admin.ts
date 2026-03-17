import { Elysia, t } from "elysia";
import { adminKeyGuard2 } from "../middleware/auth";
import {
  listBugReports,
  getBugReport,
  getFile,
  deleteBugReport,
  updateBugReportStatus,
  countNewReports,
  generateReportZip,
} from "../services/bugReportService";
import {
  listUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser,
  getUserById,
} from "../services/userService";
import { Log } from "../logger";
import type { BugReportStatus, DbEnv } from "../types";

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(adminKeyGuard2)
  .get(
    "/bug-reports",
    async ({ query, headers }) => {
      const page = parseInt(query.page || "1");
      const pageSize = Math.min(parseInt(query.pageSize || "20"), 100);
      const status = query.status as BugReportStatus | undefined;
      const search = query.search || undefined;
      const useTestDb: boolean = headers["x-db-env"] !== "prod" ? true : false;

      if (useTestDb) Log("ADMIN", `Fetching bug reports from test database`);

      Log(
        "ADMIN",
        `List bug reports page=${page} pageSize=${pageSize} status=${status || "all"} search=${search || ""}`,
      );
      const res = await listBugReports(
        {
          page,
          pageSize,
          status,
          search,
        },
        useTestDb,
      );
      return res;
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
          ]),
        ),
        search: t.Optional(t.String()),
      }),
      detail: { summary: "List bug reports (paginated, filterable)" },
    },
  )
  .get(
    "/bug-reports/count",
    async ({ headers }) => {
      const count = await countNewReports(
        headers["x-db-env"] !== "prod" ? true : false,
      );
      return { count };
    },
    { detail: { summary: "Count new bug reports" } },
  )
  .get(
    "/bug-reports/:id",
    async ({ params, status, headers }) => {
      Log("ADMIN", `Get bug report id=${params.id}`);
      const result = await getBugReport(
        parseInt(params.id),
        headers["x-db-env"] !== "prod" ? true : false,
      );
      if (!result)
        return status(404, { success: false, message: "Report not found" });
      return result;
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Get bug report with file metadata" },
    },
  )
  .patch(
    "/bug-reports/:id/status",
    async ({ params, body, status, headers }) => {
      Log("ADMIN", `Update status id=${params.id} status=${body.status}`);
      const updated = await updateBugReportStatus(
        parseInt(params.id),
        body.status,
        headers["x-db-env"] !== "prod" ? true : false,
      );
      if (!updated)
        return status(404, { success: false, message: "Report not found" });
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
    },
  )
  .get(
    "/bug-reports/:id/files/:fileId",
    async ({ params, status, set, headers }) => {
      const file = await getFile(
        parseInt(params.id),
        parseInt(params.fileId),
        headers["x-db-env"] !== "prod" ? true : false,
      );
      if (!file)
        return status(404, { success: false, message: "File not found" });

      set.headers["content-type"] = file.mime_type;
      set.headers["content-disposition"] =
        `attachment; filename="${file.filename}"`;
      return new Response(file.data);
    },
    {
      params: t.Object({ id: t.String(), fileId: t.String() }),
      detail: { summary: "Download a bug report file" },
    },
  )
  .get(
    "/bug-reports/:id/download",
    async ({ params, status, set, headers }) => {
      Log("ADMIN", `Download zip for report id=${params.id}`);
      const zipBuffer = await generateReportZip(
        parseInt(params.id),
        headers["x-db-env"] !== "prod" ? true : false,
      );
      if (!zipBuffer)
        return status(404, { success: false, message: "Report not found" });

      set.headers["content-type"] = "application/zip";
      set.headers["content-disposition"] =
        `attachment; filename="report-${params.id}.zip"`;
      set.headers["content-length"] = String(zipBuffer.length);
      return new Response(new Uint8Array(zipBuffer));
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Download all files for a bug report as ZIP" },
    },
  )
  .delete(
    "/bug-reports/:id",
    async ({ params, status, headers }) => {
      Log("ADMIN", `Delete bug report id=${params.id}`);
      const deleted = await deleteBugReport(
        parseInt(params.id),
        headers["x-db-env"] !== "prod" ? true : false,
      );
      if (!deleted)
        return status(404, { success: false, message: "Report not found" });
      return { success: true, message: "Report deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete a bug report and its files" },
    },
  )
  // User management
  .get(
    "/users",
    async ({ headers }) => {
      Log("ADMIN", "List users");
      return await listUsers();
    },
    { detail: { summary: "List all users" } },
  )
  .post(
    "/users",
    async ({ body, status }) => {
      Log("ADMIN", `Create user username=${body.username}`);
      try {
        const user = await createUser(body);
        return { success: true, user };
      } catch (err) {
        if (err instanceof Error && err.message === "Username already exists") {
          return status(409, { success: false, message: err.message });
        }
        throw err;
      }
    },
    {
      body: t.Object({
        username: t.String({ minLength: 3, maxLength: 255 }),
        displayname: t.String({ default: "" }),
        password: t.String({ minLength: 1 }),
        role: t.Union([t.Literal("admin"), t.Literal("user")]),
      }),
      detail: { summary: "Create a new user" },
    },
  )
  .patch(
    "/users/:id",
    async ({ params, body, status }) => {
      Log("ADMIN", `Update user id=${params.id}`);
      const updated = await updateUser(params.id, body);
      if (!updated)
        return status(404, { success: false, message: "User not found" });
      return { success: true, message: "User updated" };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        displayname: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
      detail: { summary: "Update user displayname or enabled status" },
    },
  )
  .post(
    "/users/:id/reset-password",
    async ({ params, body, status }) => {
      Log("ADMIN", `Reset password for user id=${params.id}`);
      const updated = await resetPassword(params.id, body.password);
      if (!updated)
        return status(404, { success: false, message: "User not found" });
      return { success: true, message: "Password reset" };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ password: t.String({ minLength: 1 }) }),
      detail: { summary: "Reset a user's password" },
    },
  )
  .delete(
    "/users/:id",
    async ({ params, status }) => {
      Log("ADMIN", `Delete user id=${params.id}`);

      const user = await getUserById(params.id);
      if (!user)
        throw status(404, { success: false, message: "User not found" });
      if (user.role === "admin")
        return status(400, {
          success: false,
          message: "Cannot delete an admin user",
        });

      const deleted = await deleteUser(params.id);
      if (!deleted)
        return status(404, { success: false, message: "User not found" });
      return { success: true, message: "User deleted" };
    },
    {
      params: t.Object({ id: t.String() }),
      detail: { summary: "Delete a user (non-admin only)" },
    },
  );
