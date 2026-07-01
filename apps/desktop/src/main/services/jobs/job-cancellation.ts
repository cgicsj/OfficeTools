let activeJobAbortController: AbortController | null = null;
let skipCurrentFileRequested = false;

export const setActiveJobAbortController = (abortController: AbortController | null): void => {
  activeJobAbortController = abortController;
  skipCurrentFileRequested = false;
};

export const cancelActiveJob = (): boolean => {
  if (!activeJobAbortController) {
    return false;
  }

  activeJobAbortController.abort();
  activeJobAbortController = null;
  skipCurrentFileRequested = false;
  return true;
};

export const requestSkipCurrentFile = (): boolean => {
  if (!activeJobAbortController) {
    return false;
  }

  skipCurrentFileRequested = true;
  return true;
};

export const consumeSkipCurrentFileRequest = (): boolean => {
  const shouldSkip = skipCurrentFileRequested;
  skipCurrentFileRequested = false;
  return shouldSkip;
};

export const isSkipCurrentFileRequested = (): boolean => {
  return skipCurrentFileRequested;
};
