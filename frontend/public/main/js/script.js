(function () {
    const players = {}; // {cardId: WaveSurferInstance}
    const playersMeta = {}; // {cardId: {player, btn, waveformEl, isLoop, userPaused}}
    let currentPlayer = null;
    const waveformCacheSent = new Set();

    const ICONS = {
        play: '<svg class="play-icon" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg class="pause-icon" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
        playRect: 'Play<svg class="play-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
        pauseRect: 'Pause<svg class="pause-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
    };

    const WS_OPTIONS = {
        // Backend is selected per-card in initPlayer (loops use MediaElement).
        waveColor: 'rgba(107, 127, 247, 0.4)',
        progressColor: 'rgba(107, 127, 247, 0.8)',
        cursorColor: 'rgba(107, 127, 247, 1)',
        barWidth: 3, barGap: 2, barHeight: 1.5,
        responsive: true, normalize: true,
        interact: true,
        dragToSeek: true
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

    function buildApiUrl(path) {
        const base = (window.__SW_API_BASE || '').trim().replace(/\/+$/, '');
        return base ? `${base}${path}` : path;
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

    function getTargetPeakLength(waveformEl) {
        const width = waveformEl ? Math.max(320, waveformEl.clientWidth || 0) : 320;
        return Math.min(4096, Math.max(1024, Math.round(width * 2.4)));
    }

    function tryExportPeaks(ws, targetLength) {
        if (!ws || typeof ws.exportPeaks !== 'function') return null;
        let exported = null;
        const maxLength = Math.max(128, Number(targetLength) || 1024);
        try {
            exported = ws.exportPeaks({maxLength, precision: 10000});
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
        for (let i = 0; i < channelPeaks.length; i += 1) {
            const numeric = Number(channelPeaks[i]);
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

        try {
            const response = await fetch(buildApiUrl(`/api/waveforms/${kind}/${cardId}/`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    peaks,
                    duration,
                }),
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
        const {unloadMedia = false} = options || {};

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

        // Some browsers suspend WebAudio contexts after tab switches or route changes.
        // Resume context before playback to avoid "playing with no sound" state.
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
        Object.values(playersMeta).forEach(meta => {
            const {player, btn} = meta;
            if (!player || player === exceptPlayer) return;
            meta.pendingPlay = false;
            if (player.isPlaying()) {
                meta.userPaused = true;
                player.pause();
                setButtonIcon(btn, false);
                if (currentPlayer === player) currentPlayer = null;
            }
        });
    }

    function stopAllPlayback(options = {}) {
        const {destroy = false} = options || {};
        const cardIds = Object.keys(playersMeta);
        cardIds.forEach(cardId => {
            const meta = playersMeta[cardId];
            if (!meta?.player) return;
            stopPlayerCompletely(meta.player);
            meta.userPaused = true;
            meta.pendingPlay = false;
            setButtonIcon(meta.btn, false);
            if (destroy) {
                destroyPlayer(cardId);
            }
        });
        currentPlayer = null;
    }

    function destroyPlayer(cardId) {
        const meta = playersMeta[cardId];
        if (!meta) return;

        if (currentPlayer === meta.player) {
            currentPlayer = null;
        }

        if (meta.waveformEl && meta.seekHandler) {
            meta.waveformEl.removeEventListener('pointerup', meta.seekHandler);
        }

        stopPlayerCompletely(meta.player, {unloadMedia: true});

        try {
            meta.player.destroy();
        } catch (_) {
            // Ignore destroy errors from already-disposed instances.
        }

        delete players[cardId];
        delete playersMeta[cardId];
    }

    function requestPlay(meta, {allowRetry = true, fromUserGesture = false} = {}) {
        if (!meta?.player) return;
        const {player, btn} = meta;

        pauseOthers(player);
        meta.userPaused = false;
        setButtonIcon(btn, true);
        currentPlayer = player;

        let playPromise;
        const failPlay = () => {
            if (allowRetry && !meta.isReady) {
                meta.pendingPlay = true;
                return;
            }
            meta.pendingPlay = false;
            meta.userPaused = true;
            setButtonIcon(btn, false);
            if (currentPlayer === player) currentPlayer = null;
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
            // Keep one direct play attempt inside click handler to satisfy autoplay policies.
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
                .filter(Boolean)
        );

        Object.keys(playersMeta).forEach(cardId => {
            if (!activeCardIds.has(cardId)) {
                destroyPlayer(cardId);
            }
        });
    }

    function initPlayer(card) {
        const cardId = card.dataset.cardId;
        const url = card.dataset.url;
        const waveform = card.querySelector('[id^="waveform-"]');
        if (!cardId || !url || !waveform) return;
        const cachedPeaks = parseWaveformPeaks(card.dataset.waveformPeaks);
        const cachedDuration = parseWaveformDuration(card.dataset.waveformDuration);
        const hasCachedWaveform = Boolean(cachedPeaks && cachedPeaks.length);

        // React can remount cards with the same id after filtering/pagination.
        // Recreate player if waveform container node changed.
        if (playersMeta[cardId]) {
            if (playersMeta[cardId].waveformEl === waveform) {
                return;
            }
            destroyPlayer(cardId);
        }

        const wsConfig = {
            ...WS_OPTIONS,
            container: waveform,
            url,
            // WebAudio keeps seek behavior stable for long loops and samples.
            backend: 'WebAudio',
        };
        if (hasCachedWaveform) {
            wsConfig.peaks = cachedPeaks;
            if (cachedDuration) {
                wsConfig.duration = cachedDuration;
            }
        }

        const ws = WaveSurfer.create(wsConfig);
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
            if (typeof meta.pendingSeek === 'number') {
                applySeek(ws, meta.pendingSeek);
                meta.pendingSeek = null;
            }
            if (!meta.pendingPlay) return;
            meta.pendingPlay = false;
            requestPlay(meta, {allowRetry: false});
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
            }
            pauseOthers(ws);
            currentPlayer = ws;
            setButtonIcon(btn, true);
        });
        ws.on('pause', () => {
            setButtonIcon(btn, false);
            if (currentPlayer === ws) currentPlayer = null;
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
        const {player, btn} = meta;

        if (player.isPlaying()) {
            meta.userPaused = true;
            meta.pendingPlay = false;
            player.pause();
            setButtonIcon(btn, false);
            if (currentPlayer === player) currentPlayer = null;
        } else {
            requestPlay(meta, {allowRetry: true, fromUserGesture: true});
        }
    }

    function handleDownload(btn, type) { // type: 'sample' | 'loop'
        const card = btn.closest('.sample-card');
        const cardId = card.dataset.cardId;
        const key = `${type}_${cardId}`;
        if (downloadedFiles.has(key)) return;

        const a = document.createElement('a');
        a.href = btn.href;
        a.download = '';
        document.body.appendChild(a).click();
        document.body.removeChild(a);

        downloadedFiles.add(key);
        const numEl = document.getElementById(`downloads-count-${cardId}`)?.querySelector('.downloads-num');
        if (numEl) {
            numEl.textContent = parseInt(numEl.textContent) + 1;
            const downloadsEl = numEl.closest('#downloads-count-' + cardId);
            downloadsEl.style.animation = 'pulse 0.6s ease-out';
            setTimeout(() => downloadsEl.style.animation = '', 600);
        }
    }

    const downloadedFiles = new Set();

    let listenersBound = false;

    function initAll() {
        cleanupStalePlayers();
        document.querySelectorAll('[data-card-id]').forEach(initPlayer);

        if (listenersBound) return;
        listenersBound = true;

        document.addEventListener('click', e => {
            const playBtn = e.target.closest('.play-btn-main, .play-btn-rect');
            if (playBtn) {
                e.stopPropagation();
                const card = playBtn.closest('[data-card-id]');
                if (card) initPlayer(card);
                togglePlay(playBtn.dataset.cardId);
                return;
            }
            const likeBtn = e.target.closest('.like-btn');
            if (likeBtn) {
                e.stopPropagation();
                likeBtn.classList.toggle('liked');
                return;
            }
            const dlBtn = e.target.closest('.download-btn-bottom, .download-btn-rect');
            if (dlBtn) {
                if (dlBtn.classList.contains('auth-required-download')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                handleDownload(dlBtn, dlBtn.classList.contains('download-btn-bottom') ? 'sample' : 'loop');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    window.__swInit = initAll;
    window.__swStopAll = stopAllPlayback;
    window.__swPlayers = {players, playersMeta};
})();
