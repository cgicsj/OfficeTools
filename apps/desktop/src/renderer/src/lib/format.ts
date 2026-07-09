export const formatBytes = (bytes: number): string => {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const unit = units[exponent] ?? 'B';

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
};

export const formatTime = (timestampMs: number): string => {
  return new Date(timestampMs).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};


export const formatDurationSeconds = (totalSeconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes === 0) {
    return `${seconds} 秒`;
  }

  return `${minutes} 分 ${seconds.toString().padStart(2, '0')} 秒`;
};
