import { apiFetch } from '../api/client.js';
import { bootstrapMediaPlayer } from './bootstrap.js';
import { createDownloadController } from './downloads.js';

const players = {}; // {cardId: WaveSurferInstance}
const playersMeta = {}; // {cardId: {player, btn, waveformEl, isLoop, userPaused}}
let currentPlayer = null;
let currentPlayerCardId = null;
const waveformCacheSent = new Set();
const waveformPayloadCache = new Map();
const waveformRequestCache = new Map();
const observedCards = new Map();
let cardsObserver = null;

const ICONS = {
  play: '<svg class="play-icon" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg class="pause-icon" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
  playRect: 'Play<svg class="play-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
  pauseRect: 'Pause<svg class="pause-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
};

const WS_OPTIONS = {
  waveColor: 'rgba(107, 127, 247, 0.74)',
  progressColor: 'rgba(156, 171, 255, 0.98)',
  cursorColor: 'rgba(188, 199, 255, 1)',
  height: 'auto',
  barWidth: 3,
  barGap: 2,
  barHeight: 1.5,
  responsive: true,
  normalize: true,
  interact: true,
  dragToSeek: true,
};

const LOOP_WS_OPTIONS = {
  waveColor: 'rgba(86, 94, 182, 0.82)',
  progressColor: 'rgba(109, 118, 215, 0.96)',
  cursorColor: 'rgba(125, 135, 232, 1)',
  barWidth: 3,
  barGap: 3,
  barHeight: 1.72,
};

const SAMPLE_WS_OPTIONS = {
  waveColor: 'rgba(86, 94, 182, 0.82)',
  progressColor: 'rgba(109, 118, 215, 0.96)',
  cursorColor: 'rgba(125, 135, 232, 1)',
  barWidth: 3,
  barGap: 3,
  barHeight: 1.68,
};

function applySeek(ws, ratio) {
  if (!ws) return false;
  const normalized = Math.max(0, Math.min(1, Number(ratio) || 0));
  if (typeof ws.seekTo === 'function') {
    try {
      ws.seekTo(normalized);
      return true;
    } catch (_) {
      // Continue with fallback methods.
    }
  }

  const duration = typeof ws.getDuration === 'function' ? Number(ws.getDuration() || 0) : 0;
  if (duration > 0 && typeof ws.setTime === 'function') {
    try {
      ws.setTime(duration * normalized);
      return true;
    } catch (_) {
      // Continue with media element fallback.
    }
  }

  const media = resolveMediaElement(ws);
  const mediaDuration = Number(media?.duration || duration || 0);
  if (media && mediaDuration > 0) {
    try {
      media.currentTime = mediaDuration * normalized;
      return true;
    } catch (_) {
      // No more fallbacks.
    }
  }

  return false;
}

function parseWaveformPeaks(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const normalized = parsed
      .map(value => Math.max(-1, Math.min(1, Number(value) || 0)))
      .filter(value => Number.isFinite(value));
    return normalized.length ? normalized : null;
  } catch (_) {
    return null;
  }
}

function parseWaveformDuration(raw) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function getWaveformShell(card) {
  return card?.querySelector?.('[id^="waveform-"]') || null;
}

function getWaveformLiveLayer(waveformShell) {
  return waveformShell?.querySelector?.('[data-waveform-live]') || null;
}

function clearWaveformLiveLayer(waveformLiveLayer) {
  if (!waveformLiveLayer) return;
  if (typeof waveformLiveLayer.replaceChildren === 'function') {
    waveformLiveLayer.replaceChildren();
    return;
  }
  waveformLiveLayer.innerHTML = '';
}

function setWaveformLiveActive(meta, active) {
  meta?.waveformEl?.classList.toggle('is-live-waveform-active', Boolean(active));
}

function setCardWaveformDataset(card, waveform) {
  if (!card) return null;
  const peaks = Array.isArray(waveform?.peaks) ? waveform.peaks : null;
  if (!peaks?.length) {
    card.dataset.waveformPeaks = '';
    card.dataset.waveformDuration = '';
    return null;
  }

  card.dataset.waveformPeaks = JSON.stringify(peaks);
  card.dataset.waveformDuration = waveform?.duration || '';
  return waveform;
}

async function fetchCachedWaveform(card) {
  const kind = card?.dataset?.kind;
  const cardId = card?.dataset?.cardId;
  if (!kind || !cardId) return null;

  const cachedPeaks = parseWaveformPeaks(card.dataset.waveformPeaks);
  if (cachedPeaks?.length) {
    return {
      peaks: cachedPeaks,
      duration: parseWaveformDuration(card.dataset.waveformDuration),
    };
  }

  const cacheKey = `${kind}:${cardId}`;
  const cachedPayload = waveformPayloadCache.get(cacheKey);
  if (cachedPayload) {
    return setCardWaveformDataset(card, cachedPayload);
  }

  const inFlight = waveformRequestCache.get(cacheKey);
  if (inFlight) {
    const waveform = await inFlight;
    return setCardWaveformDataset(card, waveform);
  }

  const request = apiFetch(`/api/waveforms/${kind}/${cardId}/`, {
    method: 'GET',
    skipAuth: true,
  })
    .then(response => response.json().catch(() => null))
    .then(data => {
      const waveform = data?.cached ? data.waveform : null;
      if (waveform?.peaks?.length) {
        waveformPayloadCache.set(cacheKey, waveform);
      }
      return waveform;
    })
    .catch(() => null)
    .finally(() => {
      waveformRequestCache.delete(cacheKey);
    });

  waveformRequestCache.set(cacheKey, request);
  const waveform = await request;
  return setCardWaveformDataset(card, waveform);
}

function getTargetPeakLength(waveformEl) {
  const width = waveformEl ? Math.max(320, waveformEl.clientWidth || 0) : 320;
  return Math.min(4096, Math.max(1024, Math.round(width * 2.4)));
}

function tryExportPeaks(ws, targetLength) {
  if (!ws || typeof ws.exportPeaks !== 'function') return null;
  let exported = null;
  const maxLength = Math.max(128, Number(targetLength) || 1024);
  try {
    exported = ws.exportPeaks({ maxLength, precision: 10000 });
  } catch (_) {
    try {
      exported = ws.exportPeaks(maxLength);
    } catch (_) {
      return null;
    }
  }

  const channelPeaks = Array.isArray(exported?.[0]) ? exported[0] : exported;
  if (!Array.isArray(channelPeaks) || !channelPeaks.length) return null;

  const sanitized = [];
  for (let index = 0; index < channelPeaks.length; index += 1) {
    const numeric = Number(channelPeaks[index]);
    if (!Number.isFinite(numeric)) continue;
    const clamped = Math.max(-1, Math.min(1, numeric));
    sanitized.push(Number(clamped.toFixed(6)));
  }
  return sanitized.length ? sanitized : null;
}

async function cacheWaveform(card, peaks, duration) {
  const kind = card.dataset.kind;
  const cardId = card.dataset.cardId;
  if (!kind || !cardId || !Array.isArray(peaks) || !peaks.length) return;

  const cacheKey = `${kind}:${cardId}`;
  if (waveformCacheSent.has(cacheKey)) return;
  waveformCacheSent.add(cacheKey);
  const waveform = { peaks, duration };
  setCardWaveformDataset(card, waveform);
  waveformPayloadCache.set(cacheKey, waveform);

  try {
    const response = await apiFetch(`/api/waveforms/${kind}/${cardId}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        peaks,
        duration,
      }),
      skipAuth: true,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (_) {
    waveformCacheSent.delete(cacheKey);
    // Cache write failure should not affect playback.
  }
}

function setButtonIcon(btn, playing) {
  if (!btn) return;
  btn.classList.toggle('is-playing', Boolean(playing));
  btn.innerHTML = btn.classList.contains('play-btn-rect')
    ? (playing ? ICONS.pauseRect : ICONS.playRect)
    : (playing ? ICONS.pause : ICONS.play);
}

function resolveMediaElement(player) {
  if (!player) return null;
  try {
    if (typeof player.getMediaElement === 'function') {
      const media = player.getMediaElement();
      if (media) return media;
    }
  } catch (_) {
    // Ignore getMediaElement access errors.
  }
  const backend = player.backend || {};
  return backend.media || backend.mediaElement || null;
}

function forceMediaElementAudible(player) {
  const media = resolveMediaElement(player);
  if (!media) return;
  try {
    media.muted = false;
    if (typeof media.volume === 'number' && media.volume <= 0) {
      media.volume = 1;
    }
  } catch (_) {
    // Ignore media element state errors.
  }
}

function stopPlayerCompletely(player, options = {}) {
  if (!player) return;
  const { unloadMedia = false } = options || {};

  try {
    if (typeof player.stop === 'function') {
      player.stop();
    } else if (typeof player.pause === 'function') {
      player.pause();
    }
  } catch (_) {
    // Ignore stop errors from already-disposed instances.
  }

  const media = resolveMediaElement(player);
  if (!media) return;

  try {
    media.pause();
  } catch (_) {
    // Ignore pause errors on detached elements.
  }

  try {
    media.currentTime = 0;
  } catch (_) {
    // Ignore currentTime errors on non-seekable streams.
  }

  forceMediaElementAudible(player);

  if (!unloadMedia) return;

  try {
    media.removeAttribute('src');
    media.load();
  } catch (_) {
    // Ignore unload errors.
  }
}

function resolveAudioContext(player) {
  const backend = player && player.backend;
  return backend?.ac || backend?.audioContext || backend?.context || null;
}

function prepareAudioOutput(player) {
  forceMediaElementAudible(player);

  try {
    const context = resolveAudioContext(player);
    if (context && context.state === 'suspended' && typeof context.resume === 'function') {
      return context.resume()
        .catch(() => {})
        .finally(() => {
          forceMediaElementAudible(player);
        });
    }
  } catch (_) {
    // Ignore context lookup/resume errors.
  }
  return Promise.resolve();
}

function pauseOthers(exceptPlayer) {
  if (!currentPlayer || currentPlayer === exceptPlayer) return;

  const activeMeta = currentPlayerCardId
    ? playersMeta[currentPlayerCardId]
    : Object.values(playersMeta).find(meta => meta.player === currentPlayer);

  if (!activeMeta?.player || activeMeta.player === exceptPlayer) return;
  activeMeta.pendingPlay = false;
  if (activeMeta.player.isPlaying()) {
    activeMeta.userPaused = true;
    activeMeta.player.pause();
  }
  setWaveformLiveActive(activeMeta, false);
  setButtonIcon(activeMeta.btn, false);
  currentPlayer = null;
  currentPlayerCardId = null;
}

function stopAllPlayback(options = {}) {
  const { destroy = false } = options || {};
  const cardIds = Object.keys(playersMeta);
  cardIds.forEach(cardId => {
    const meta = playersMeta[cardId];
    if (!meta?.player) return;
    stopPlayerCompletely(meta.player);
    meta.userPaused = true;
    meta.pendingPlay = false;
    setWaveformLiveActive(meta, false);
    setButtonIcon(meta.btn, false);
    if (destroy) {
      destroyPlayer(cardId);
    }
  });
  if (destroy && cardsObserver) {
    cardsObserver.disconnect();
    cardsObserver = null;
    observedCards.clear();
  }
  currentPlayer = null;
  currentPlayerCardId = null;
}

function destroyPlayer(cardId) {
  const meta = playersMeta[cardId];
  if (!meta) return;

  if (currentPlayer === meta.player) {
    currentPlayer = null;
    currentPlayerCardId = null;
  }

  if (meta.waveformEl && meta.seekHandler) {
    meta.waveformEl.removeEventListener('pointerup', meta.seekHandler);
    meta.waveformEl.classList.remove('is-waveform-ready');
    meta.waveformEl.classList.remove('is-live-waveform-active');
  }

  stopPlayerCompletely(meta.player, { unloadMedia: true });

  try {
    meta.player.destroy();
  } catch (_) {
    // Ignore destroy errors from already-disposed instances.
  }

  clearWaveformLiveLayer(meta.waveformLiveEl);

  delete players[cardId];
  delete playersMeta[cardId];
}

function requestPlay(meta, { allowRetry = true, fromUserGesture = false } = {}) {
  if (!meta?.player) return;
  const { player, btn } = meta;

  pauseOthers(player);
  meta.userPaused = false;
  setButtonIcon(btn, true);
  currentPlayer = player;
  currentPlayerCardId = player.cardId || null;

  let playPromise;
  const failPlay = () => {
    if (allowRetry && !meta.isReady) {
      meta.pendingPlay = true;
      return;
    }
    meta.pendingPlay = false;
    meta.userPaused = true;
    setWaveformLiveActive(meta, false);
    setButtonIcon(btn, false);
    if (currentPlayer === player) {
      currentPlayer = null;
      currentPlayerCardId = null;
    }
  };

  const startPlay = () => {
    forceMediaElementAudible(player);
    try {
      playPromise = player.play();
    } catch (_) {
      failPlay();
      return;
    }

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        failPlay();
      });
    }
  };

  if (!meta.isReady && allowRetry) {
    meta.pendingPlay = true;
  }

  if (fromUserGesture) {
    startPlay();
  }

  prepareAudioOutput(player)
    .catch(() => {})
    .finally(() => {
      if (meta.userPaused) {
        meta.pendingPlay = false;
        return;
      }
      if (fromUserGesture && player.isPlaying()) return;
      if (allowRetry && !meta.isReady) return;
      startPlay();
    });
}

function cleanupStalePlayers() {
  const activeCardIds = new Set(
    Array.from(document.querySelectorAll('[data-card-id]'))
      .map(card => card.dataset.cardId)
      .filter(Boolean),
  );

  Object.keys(playersMeta).forEach(cardId => {
    if (!activeCardIds.has(cardId)) {
      destroyPlayer(cardId);
    }
  });

  observedCards.forEach((card, cardId) => {
    if (activeCardIds.has(cardId)) return;
    if (cardsObserver) {
      cardsObserver.unobserve(card);
    }
    observedCards.delete(cardId);
  });
}

function schedulePlayersInit(cards, options = {}) {
  const eagerPageInit = options?.mode === 'page';

  if (cardsObserver) {
    cardsObserver.disconnect();
    cardsObserver = null;
  }

  observedCards.clear();

  if (eagerPageInit) {
    cards.forEach(card => {
      fetchCachedWaveform(card)
        .catch(() => null)
        .finally(() => {
          initPlayer(card);
        });
    });
    return;
  }

  if (typeof window.IntersectionObserver !== 'function') {
    cards.slice(0, 3).forEach(initPlayer);
    return;
  }

  cardsObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const cardId = card.dataset.cardId;
      if (!cardId) return;
      cardsObserver?.unobserve(card);
      observedCards.delete(cardId);
      fetchCachedWaveform(card)
        .catch(() => null)
        .finally(() => {
          initPlayer(card);
        });
    });
  }, {
    root: null,
    rootMargin: '240px 0px 320px 0px',
    threshold: 0.01,
  });

  cards.forEach(card => {
    const cardId = card.dataset.cardId;
    if (!cardId || playersMeta[cardId]) return;
    observedCards.set(cardId, card);
    cardsObserver.observe(card);
  });
}

function initPlayer(card) {
  const waveSurferLib = window.WaveSurfer;
  if (!waveSurferLib || typeof waveSurferLib.create !== 'function') return;

  const cardId = card.dataset.cardId;
  const url = card.dataset.url;
  const waveform = getWaveformShell(card);
  const waveformLiveLayer = getWaveformLiveLayer(waveform);
  if (!cardId || !url || !waveform || !waveformLiveLayer) return;
  const cachedPeaks = parseWaveformPeaks(card.dataset.waveformPeaks);
  const cachedDuration = parseWaveformDuration(card.dataset.waveformDuration);
  const hasCachedWaveform = Boolean(cachedPeaks && cachedPeaks.length);
  const isLoopCard = card.dataset.kind === 'loops';
  const isSampleCard = card.dataset.kind === 'samples';

  if (playersMeta[cardId]) {
    if (playersMeta[cardId].waveformEl === waveform) {
      return;
    }
    destroyPlayer(cardId);
  }

  waveform.classList.remove('is-waveform-ready');
  waveform.classList.remove('is-live-waveform-active');
  clearWaveformLiveLayer(waveformLiveLayer);

  const wsConfig = {
    ...WS_OPTIONS,
    ...(isLoopCard ? LOOP_WS_OPTIONS : {}),
    ...(isSampleCard ? SAMPLE_WS_OPTIONS : {}),
    container: waveformLiveLayer,
    url,
    backend: 'WebAudio',
  };
  if (hasCachedWaveform) {
    wsConfig.peaks = cachedPeaks;
    if (cachedDuration) {
      wsConfig.duration = cachedDuration;
    }
  }

  const ws = waveSurferLib.create(wsConfig);
  ws.cardId = cardId;
  const btn = card.querySelector('.play-btn-main, .play-btn-rect');
  players[cardId] = ws;
  const seekHandler = event => {
    if (!ws) return;
    const rect = waveform.getBoundingClientRect();
    if (!rect.width) return;
    const clientX = Number(event.clientX);
    if (!Number.isFinite(clientX)) return;
    const ratio = (clientX - rect.left) / rect.width;
    const normalized = Math.max(0, Math.min(1, ratio));
    const meta = playersMeta[cardId];
    if (!applySeek(ws, normalized) && meta) {
      meta.pendingSeek = normalized;
    } else if (meta) {
      meta.pendingSeek = null;
    }
  };
  waveform.addEventListener('pointerup', seekHandler);

  playersMeta[cardId] = {
    player: ws,
    btn,
    waveformEl: waveform,
    waveformLiveEl: waveformLiveLayer,
    seekHandler,
    isLoop: false,
    userPaused: false,
    isReady: false,
    pendingPlay: false,
    pendingSeek: null,
  };
  setButtonIcon(btn, false);

  ws.once('ready', () => {
    const meta = playersMeta[cardId];
    if (!meta) return;
    meta.isReady = true;
    meta.waveformEl?.classList.add('is-waveform-ready');
    if (typeof meta.pendingSeek === 'number') {
      applySeek(ws, meta.pendingSeek);
      meta.pendingSeek = null;
    }
    if (!meta.pendingPlay) return;
    meta.pendingPlay = false;
    requestPlay(meta, { allowRetry: false });
  });

  const isLoop = !card.closest('.sample-card')?.classList.contains('sample-item');
  if (isLoop) {
    playersMeta[cardId].isLoop = true;
    ws.on('finish', () => {
      const meta = playersMeta[cardId];
      if (meta.isLoop && !meta.userPaused) {
        applySeek(ws, 0);
        try {
          ws.play();
        } catch (_) {
          // Ignore loop restart failures.
        }
      }
    });
  }

  ws.on('play', () => {
    const meta = playersMeta[cardId];
    if (meta) {
      meta.isReady = true;
      setWaveformLiveActive(meta, true);
    }
    pauseOthers(ws);
    currentPlayer = ws;
    currentPlayerCardId = cardId;
    setButtonIcon(btn, true);
  });
  ws.on('pause', () => {
    const meta = playersMeta[cardId];
    if (meta) {
      setWaveformLiveActive(meta, false);
    }
    setButtonIcon(btn, false);
    if (currentPlayer === ws) {
      currentPlayer = null;
      currentPlayerCardId = null;
    }
  });

  if (!hasCachedWaveform) {
    ws.once('ready', () => {
      const targetLength = getTargetPeakLength(waveform);
      const exportedPeaks = tryExportPeaks(ws, targetLength);
      if (!exportedPeaks) return;
      const duration = typeof ws.getDuration === 'function' ? ws.getDuration() : null;
      cacheWaveform(card, exportedPeaks, duration);
    });
  }
}

function togglePlay(cardId) {
  const meta = playersMeta[cardId];
  if (!meta?.player) return;
  const { player, btn } = meta;

  if (player.isPlaying()) {
    meta.userPaused = true;
    meta.pendingPlay = false;
    player.pause();
    setButtonIcon(btn, false);
    if (currentPlayer === player) {
      currentPlayer = null;
      currentPlayerCardId = null;
    }
  } else {
    requestPlay(meta, { allowRetry: true, fromUserGesture: true });
  }
}

function getPlayerMeta(cardId) {
  return playersMeta[cardId] || null;
}

function scheduleCardWarmup(card) {
  if (!card) return;
  const cardId = card.dataset.cardId;
  if (!cardId || playersMeta[cardId]) return;
  const runWarmup = () => {
    fetchCachedWaveform(card).catch(() => null);
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(runWarmup, { timeout: 120 });
  } else {
    window.setTimeout(runWarmup, 0);
  }
}

const downloads = createDownloadController();

bootstrapMediaPlayer({
  applySeek,
  cleanupStalePlayers,
  getPlayerMeta,
  handleDownload: downloads.handleDownload,
  initPlayer,
  players,
  playersMeta,
  requestPlay,
  scheduleCardWarmup,
  schedulePlayersInit,
  stopAllPlayback,
  togglePlay,
});
