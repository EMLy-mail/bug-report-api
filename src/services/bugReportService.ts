import type { ResultSetHeader, RowDataPacket } from "mysql2";
import JSZip from "jszip";
import { getPool } from "../db/connection";
import type {
  BugReport,
  BugReportFile,
  BugReportListItem,
  BugReportStatus,
  FileRole,
  PaginatedResponse,
} from "../types";

export async function createBugReport(
  data: {
    name: string;
    email: string;
    description: string;
    hwid: string;
    hostname: string;
    os_user: string;
    submitter_ip: string;
    system_info: Record<string, unknown> | null;
  },
  useTestDb?: boolean,
): Promise<number> {
  const pool = getPool(useTestDb ? true : false);
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
    ],
  );
  return result.insertId;
}

export async function addFile(
  data: {
    report_id: number;
    file_role: FileRole;
    filename: string;
    mime_type: string;
    file_size: number;
    data: Buffer;
  },
  useTestDb?: boolean,
): Promise<number> {
  const pool = getPool(useTestDb ? true : false);
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
    ],
  );
  return result.insertId;
}

export async function listBugReports(
  opts: {
    page: number;
    pageSize: number;
    status?: BugReportStatus;
    search?: string;
  },
  useTestDb?: boolean,
): Promise<PaginatedResponse<BugReportListItem>> {
  const pool = getPool(useTestDb ? true : false);
  const { page, pageSize, status, search } = opts;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push("br.status = ?");
    params.push(status);
  }

  if (search) {
    const like = `%${search}%`;
    conditions.push(
      "(br.hostname LIKE ? OR br.os_user LIKE ? OR br.name LIKE ? OR br.email LIKE ?)",
    );
    params.push(like, like, like, like);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM bug_reports br ${whereClause}`,
  );
  const total = (countRows[0] as { total: number }).total;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT br.*, COUNT(bf.id) as file_count
     FROM bug_reports br
     LEFT JOIN bug_report_files bf ON bf.report_id = br.id
     ${whereClause}
     GROUP BY br.id
     ORDER BY br.created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
  );

  return {
    data: rows as BugReportListItem[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function countNewReports(useTestDb?: boolean): Promise<number> {
  const pool = getPool(useTestDb ? true : false);
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM bug_reports WHERE status = 'new'",
  );
  return (rows[0] as { count: number }).count;
}

export async function generateReportZip(
  reportId: number,
  useTestDb?: boolean,
): Promise<Buffer | null> {
  const pool = getPool(useTestDb ? true : false);

  const [reportRows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM bug_reports WHERE id = ?",
    [reportId],
  );
  if ((reportRows as unknown[]).length === 0) return null;

  const report = reportRows[0] as BugReport;

  const [fileRows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM bug_report_files WHERE report_id = ?",
    [reportId],
  );
  const files = fileRows as BugReportFile[];

  const zip = new JSZip();

  const reportText = [
    `Bug Report #${report.id}`,
    `========================`,
    ``,
    `Name: ${report.name}`,
    `Email: ${report.email}`,
    `Hostname: ${report.hostname}`,
    `OS User: ${report.os_user}`,
    `HWID: ${report.hwid}`,
    `IP: ${report.submitter_ip}`,
    `Status: ${report.status}`,
    `Created: ${report.created_at.toISOString()}`,
    `Updated: ${report.updated_at.toISOString()}`,
    ``,
    `Description:`,
    `------------`,
    report.description,
    ``,
    ...(report.system_info
      ? [
          `System Info:`,
          `------------`,
          JSON.stringify(report.system_info, null, 2),
        ]
      : []),
  ].join("\n");

  zip.file("report.txt", reportText);

  for (const file of files) {
    zip.file(`${file.file_role}/${file.filename}`, file.data as Buffer);
  }

  return zip.generateAsync({ type: "nodebuffer" }) as Promise<Buffer>;
}

export async function getBugReport(
  id: number,
  useTestDb?: boolean,
): Promise<{ report: BugReport; files: Omit<BugReportFile, "data">[] } | null> {
  const pool = getPool(useTestDb ? true : false);

  const [reportRows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM bug_reports WHERE id = ?",
    [id],
  );

  if ((reportRows as unknown[]).length === 0) return null;

  const [fileRows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, report_id, file_role, filename, mime_type, file_size, created_at FROM bug_report_files WHERE report_id = ?",
    [id],
  );

  return {
    report: reportRows[0] as BugReport,
    files: fileRows as Omit<BugReportFile, "data">[],
  };
}

export async function getFile(
  reportId: number,
  fileId: number,
  useTestDb?: boolean,
): Promise<BugReportFile | null> {
  const pool = getPool(useTestDb ? true : false);
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM bug_report_files WHERE id = ? AND report_id = ?",
    [fileId, reportId],
  );

  if ((rows as unknown[]).length === 0) return null;
  return rows[0] as BugReportFile;
}

export async function deleteBugReport(
  id: number,
  useTestDb?: boolean,
): Promise<boolean> {
  const pool = getPool(useTestDb ? true : false);
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM bug_reports WHERE id = ?",
    [id],
  );
  return result.affectedRows > 0;
}

export async function updateBugReportStatus(
  id: number,
  status: BugReportStatus,
  useTestDb?: boolean,
): Promise<boolean> {
  const pool = getPool(useTestDb ? true : false);
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE bug_reports SET status = ? WHERE id = ?",
    [status, id],
  );
  return result.affectedRows > 0;
}
