import { Loader2 } from 'lucide-react';
import type { JobProgress } from '@shared/types/jobs';

type ProgressPanelProps = {
  progress: JobProgress;
};

export const ProgressPanel = ({ progress }: ProgressPanelProps): JSX.Element => {
  const isActive = ['parsing', 'processing', 'saving'].includes(progress.stage);
  const totalFiles = Math.max(progress.totalFiles, 0);
  const currentFileIndex = totalFiles > 0 ? Math.min(progress.currentFileIndex, totalFiles) : 0;

  return (
    <section className="progress-panel" aria-live="polite">
      <div className="progress-panel__status">
        {isActive ? <Loader2 className="spin" size={18} aria-hidden="true" /> : null}
        <span>{progress.message ?? '等待处理'}</span>
      </div>
      <div className="progress-panel__meta">
        <span>
          {currentFileIndex}/{totalFiles}
        </span>
        <span>{progress.currentFileName ?? '-'}</span>
      </div>
    </section>
  );
};

