import { Elysia, t } from "elysia";
import { adminKeyGuard } from "../middleware/auth";
import { loginUser, validateSession, logoutSession } from "../services/authService";
import { Log } from "../logger";

export const authRoutes = new Elysia({ prefix: "/api/admin/auth" })
  .onRequest(adminKeyGuard)
  .post(
    "/login",
    async ({ body, error }) => {
      const result = await loginUser(body.username, body.password);
      if (!result) {
        Log("AUTH", `Login failed for username=${body.username}`);
        return error(401, { success: false, message: "Invalid credentials or account disabled" });
      }
      return { success: true, session_id: result.session_id, user: result.user };
    },
    {
      body: t.Object({
        username: t.String({ minLength: 1 }),
        password: t.String({ minLength: 1 }),
      }),
      detail: { summary: "Login with username/password" },
    }
  )
  .post(
    "/logout",
    async ({ headers }) => {
      const sessionId = headers["x-session-token"];
      if (sessionId) {
        await logoutSession(sessionId);
      }
      return { success: true, message: "Logged out" };
    },
    {
      detail: { summary: "Logout and invalidate session" },
    }
  )
  .get(
    "/validate",
    async ({ headers, error }) => {
      const sessionId = headers["x-session-token"];
      if (!sessionId) {
        return error(401, { success: false, message: "No session token provided" });
      }
      const user = await validateSession(sessionId);
      if (!user) {
        return error(401, { success: false, message: "Invalid or expired session" });
      }
      return { success: true, user };
    },
    {
      detail: { summary: "Validate session and return user" },
    }
  );
