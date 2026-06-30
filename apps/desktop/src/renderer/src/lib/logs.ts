import type { LogEntry, LogLevel, WorkflowTab } from '@shared/types/jobs';

export const createLogEntry = (
  tab: WorkflowTab,
  level: LogLevel,
  message: string,
): LogEntry => {
  const timestampMs = Date.now();

  return {
    id: `${tab}-${timestampMs}-${crypto.randomUUID()}`,
    tab,
    level,
    message,
    timestampMs,
  };
};

