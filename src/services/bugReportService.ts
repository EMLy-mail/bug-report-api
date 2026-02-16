import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "../db/connection";
import type {
  BugReport,
  BugReportFile,
  BugReportListItem,
  BugReportStatus,
  FileRole,
  PaginatedResponse,
} from "../types";

export async function createBugReport(data: {
  name: string;
  email: string;
  description: string;
  hwid: string;
  hostname: string;
  os_user: string;
  submitter_ip: string;
  system_info: Record<string, unknown> | null;
}): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO bug_reports (name, email, description, hwid, hostname, os_user, submitter_ip, system_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.email,
      data.description,
      data.hwid,
      data.hostname,
      data.os_user,
      data.submitter_ip,
      data.system_info ? JSON.stringify(data.system_info) : null,
    ]
  );
  return result.insertId;
}

export async function addFile(data: {
  report_id: number;
  file_role: FileRole;
  filename: string;
  mime_type: string;
  file_size: number;
  data: Buffer;
}): Promise<number> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO bug_report_files (report_id, file_role, filename, mime_type, file_size, data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.report_id,
      data.file_role,
      data.filename,
      data.mime_type,
      data.file_size,
      data.data,
    ]
  );
  return result.insertId;
}

export async function listBugReports(opts: {
  page: number;
  pageSize: number;
  status?: BugReportStatus;
}): Promise<PaginatedResponse<BugReportListItem>> {
  const pool = getPool();
  const { page, pageSize, status } = opts;
  const offset = (page - 1) * pageSize;

  let whereClause = "";
  const params: unknown[] = [];

  if (status) {
    whereClause = "WHERE br.status = ?";
    params.push(status);
  }

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM bug_reports br ${whereClause}`,
    params
  );
  const total = (countRows[0] as { total: number }).total;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT br.*, COUNT(bf.id) as file_count
     FROM bug_reports br
     LEFT JOIN bug_report_files bf ON bf.report_id = br.id
     ${whereClause}
     GROUP BY br.id
     ORDER BY br.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    data: rows as BugReportListItem[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getBugReport(
  id: number
): Promise<{ report: BugReport; files: Omit<BugReportFile, "data">[] } | null> {
  const pool = getPool();

  const [reportRows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM bug_reports WHERE id = ?",
    [id]
  );

  if ((reportRows as unknown[]).length === 0) return null;

  const [fileRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, report_id, file_role, filename, mime_type, file_size, created_at FROM bug_report_files WHERE report_id = ?",
    [id]
  );

  return {
    report: reportRows[0] as BugReport,
    files: fileRows as Omit<BugReportFile, "data">[],
  };
}

export async function getFile(
  reportId: number,
  fileId: number
): Promise<BugReportFile | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM bug_report_files WHERE id = ? AND report_id = ?",
    [fileId, reportId]
  );

  if ((rows as unknown[]).length === 0) return null;
  return rows[0] as BugReportFile;
}

export async function deleteBugReport(id: number): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM bug_reports WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}

export async function updateBugReportStatus(
  id: number,
  status: BugReportStatus
): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE bug_reports SET status = ? WHERE id = ?",
    [status, id]
  );
  return result.affectedRows > 0;
}
