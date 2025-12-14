(function () {
    const players = {}; // {cardId: WaveSurferInstance}
    const playersMeta = {}; // {cardId: {player, btn, isLoop, userPaused}}
    let currentPlayer = null;

    const ICONS = {
        play: '<svg class="play-icon" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg class="pause-icon" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
        playRect: 'Play<svg class="play-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
        pauseRect: 'Pause<svg class="pause-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
    };

    const WS_OPTIONS = {
        waveColor: 'rgba(107, 127, 247, 0.4)',
        progressColor: 'rgba(107, 127, 247, 0.8)',
        cursorColor: 'rgba(107, 127, 247, 1)',
        barWidth: 3, barGap: 2, barHeight: 1.5,
        responsive: true, normalize: true
    };

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

    function initPlayer(card) {
        const cardId = card.dataset.cardId;
        const url = card.dataset.url;
        const waveform = card.querySelector('[id^="waveform-"]');
        if (!cardId || !url || !waveform) return;

        const ws = WaveSurfer.create({...WS_OPTIONS, container: waveform, url});
        ws.cardId = cardId;
        const btn = card.querySelector('.play-btn-main, .play-btn-rect');
        players[cardId] = ws;
        playersMeta[cardId] = {player: ws, btn, isLoop: false, userPaused: false};
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

    function initAll() {
        document.querySelectorAll('[data-card-id]').forEach(initPlayer);

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

    window.__swPlayers = {players, playersMeta};
})();
