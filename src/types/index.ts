export type BugReportStatus = "new" | "in_review" | "resolved" | "closed";

export type FileRole =
  | "screenshot"
  | "mail_file"
  | "localstorage"
  | "config"
  | "system_info";

export interface BugReport {
  id: number;
  name: string;
  email: string;
  description: string;
  hwid: string;
  hostname: string;
  os_user: string;
  submitter_ip: string;
  system_info: Record<string, unknown> | null;
  status: BugReportStatus;
  created_at: Date;
  updated_at: Date;
}

export interface BugReportFile {
  id: number;
  report_id: number;
  file_role: FileRole;
  filename: string;
  mime_type: string;
  file_size: number;
  data?: Buffer;
  created_at: Date;
}

export interface BugReportListItem {
  id: number;
  name: string;
  email: string;
  description: string;
  hwid: string;
  hostname: string;
  os_user: string;
  submitter_ip: string;
  status: BugReportStatus;
  created_at: Date;
  updated_at: Date;
  file_count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
