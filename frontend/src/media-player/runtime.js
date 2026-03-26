let scheduledInitHandle = null;
let scheduledInitUsesIdleCallback = false;

export function cancelScheduledMediaPlayerInit() {
  if (typeof window === 'undefined' || scheduledInitHandle === null) return;

  if (scheduledInitUsesIdleCallback && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(scheduledInitHandle);
  } else {
    window.clearTimeout(scheduledInitHandle);
  }

  scheduledInitHandle = null;
  scheduledInitUsesIdleCallback = false;
}

export function scheduleMediaPlayerInit(options = {}) {
  if (typeof window === 'undefined') return;

  const {
    idleTimeout = 320,
    fallbackDelay = 48,
    immediate = false,
    ...playerOptions
  } = options;
  cancelScheduledMediaPlayerInit();

  const run = () => {
    scheduledInitHandle = null;
    scheduledInitUsesIdleCallback = false;

    if (typeof window.__swInit === 'function') {
      window.__swInit(playerOptions);
    }
  };

  if (immediate) {
    run();
    return;
  }

  if (typeof window.requestIdleCallback === 'function') {
    scheduledInitUsesIdleCallback = true;
    scheduledInitHandle = window.requestIdleCallback(run, { timeout: idleTimeout });
    return;
  }

  scheduledInitHandle = window.setTimeout(run, fallbackDelay);
}

export function stopAllMediaPlayers(options = {}) {
  cancelScheduledMediaPlayerInit();

  if (typeof window !== 'undefined' && typeof window.__swStopAll === 'function') {
    window.__swStopAll(options);
  }
}
