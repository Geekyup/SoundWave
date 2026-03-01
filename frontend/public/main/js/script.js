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
        backend: 'WebAudio',
        waveColor: 'rgba(107, 127, 247, 0.4)',
        progressColor: 'rgba(107, 127, 247, 0.8)',
        cursorColor: 'rgba(107, 127, 247, 1)',
        barWidth: 3, barGap: 2, barHeight: 1.5,
        responsive: true, normalize: true,
        interact: true,
        dragToSeek: true
    };

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

    function pauseOthers(exceptPlayer) {
        Object.values(playersMeta).forEach(({player, btn}) => {
            if (player !== exceptPlayer && player.isPlaying()) {
                playersMeta[player.cardId].userPaused = false;
                player.pause();
                setButtonIcon(btn, false);
                if (currentPlayer === player) currentPlayer = null;
            }
        });
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

        try {
            meta.player.destroy();
        } catch (_) {
            // Ignore destroy errors from already-disposed instances.
        }

        delete players[cardId];
        delete playersMeta[cardId];
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

        const wsConfig = {...WS_OPTIONS, container: waveform, url};
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
            if (!ws || typeof ws.seekTo !== 'function') return;
            const rect = waveform.getBoundingClientRect();
            if (!rect.width) return;
            const clientX = Number(event.clientX);
            if (!Number.isFinite(clientX)) return;
            const ratio = (clientX - rect.left) / rect.width;
            ws.seekTo(Math.max(0, Math.min(1, ratio)));
        };
        waveform.addEventListener('pointerup', seekHandler);

        playersMeta[cardId] = {
            player: ws,
            btn,
            waveformEl: waveform,
            seekHandler,
            isLoop: false,
            userPaused: false,
        };
        setButtonIcon(btn, false);

        const isLoop = !card.closest('.sample-card')?.classList.contains('sample-item');
        if (isLoop) {
            playersMeta[cardId].isLoop = true;
            ws.on('finish', () => {
                const meta = playersMeta[cardId];
                if (meta.isLoop && !meta.userPaused) {
                    ws.seekTo(0).play();
                }
            });
        }

        ws.on('play', () => {
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
            player.pause();
            setButtonIcon(btn, false);
            if (currentPlayer === player) currentPlayer = null;
        } else {
            meta.userPaused = false;
            player.play();
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
    window.__swPlayers = {players, playersMeta};
})();
