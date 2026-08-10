export const CHANGE_TYPES = [
  "PRICE_CHANGE",
  "FEATURE_ADDED",
  "FEATURE_REMOVED",
  "CONTENT_ADDED",
  "CONTENT_REMOVED",
  "POLICY_CHANGE",
  "DOCUMENTATION_CHANGE",
  "PRODUCT_LAUNCH",
  "TEAM_CHANGE",
  "CONTACT_CHANGE",
  "DESIGN_CHANGE",
  "TECHNICAL_CHANGE",
  "UNKNOWN",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export const CHANGE_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type ChangeSeverity = (typeof CHANGE_SEVERITIES)[number];

export const PROJECT_STATUSES = ["active", "paused", "scanning", "error"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const JOB_TYPES = [
  "SCAN_PROJECT",
  "CRAWL_PAGE",
  "STORE_SNAPSHOT",
  "COMPARE_SNAPSHOT",
  "CLASSIFY_CHANGE",
  "GENERATE_EMBEDDING",
  "UPDATE_SEARCH_INDEX",
  "DELIVER_WEBHOOK",
  "RUN_INVESTIGATION",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const WEBHOOK_EVENTS = [
  "project.scan.completed",
  "page.changed",
  "pricing.changed",
  "feature.added",
  "feature.removed",
  "investigation.completed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const REALTIME_EVENTS = [
  "scan.started",
  "scan.progress",
  "scan.completed",
  "scan.failed",
  "page.discovered",
  "page.scanned",
  "change.detected",
  "ai.started",
  "ai.completed",
  "investigation.completed",
  "job.updated",
] as const;
export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface InvestigationAnswer {
  answer: string;
  confidence: number;
  claims: Array<{
    text: string;
    evidenceIds: string[];
  }>;
  evidenceSummary?: string;
}

export interface SemanticDiffResult {
  type: ChangeType;
  severity: ChangeSeverity;
  summary: string;
  confidence: number;
  previousExcerpt?: string;
  currentExcerpt?: string;
  sections?: Array<{
    label: string;
    previous?: string;
    current?: string;
  }>;
}
