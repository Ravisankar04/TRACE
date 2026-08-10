export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  userId?: string;
  projectId?: string;
  jobId?: string;
  duration?: number;
  status?: string | number;
  error?: unknown;
  [key: string]: unknown;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return error;
}

export function createLogger(service: string, minLevel: LogLevel = "info") {
  const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

  function log(level: LogLevel, message: string, fields: LogFields = {}) {
    if (order[level] < order[minLevel]) return;
    const { error, ...rest } = fields;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      ...rest,
      ...(error !== undefined ? { error: serializeError(error) } : {}),
    };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  return {
    debug: (m: string, f?: LogFields) => log("debug", m, f),
    info: (m: string, f?: LogFields) => log("info", m, f),
    warn: (m: string, f?: LogFields) => log("warn", m, f),
    error: (m: string, f?: LogFields) => log("error", m, f),
  };
}
