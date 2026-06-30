import type { LogEntry } from '@shared/types/jobs';
import { formatTime } from '../../lib/format';

type WorkflowLogProps = {
  logs: LogEntry[];
};

export const WorkflowLog = ({ logs }: WorkflowLogProps): JSX.Element => {
  return (
    <section className="workflow-log" aria-label="日志">
      <div className="workflow-log__header">
        <h2>日志</h2>
      </div>
      <div className="workflow-log__body">
        {logs.length === 0 ? (
          <div className="empty-state">暂无日志</div>
        ) : (
          logs.map((log) => (
            <div className={`workflow-log__entry workflow-log__entry--${log.level}`} key={log.id}>
              <time>{formatTime(log.timestampMs)}</time>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

