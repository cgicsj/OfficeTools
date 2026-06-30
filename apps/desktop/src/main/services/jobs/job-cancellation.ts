let activeJobAbortController: AbortController | null = null;

export const setActiveJobAbortController = (abortController: AbortController | null): void => {
  activeJobAbortController = abortController;
};

export const cancelActiveJob = (): void => {
  if (activeJobAbortController) {
    activeJobAbortController.abort();
    activeJobAbortController = null;
  }
};

