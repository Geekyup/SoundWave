export function bootstrapMediaPlayer(api) {
  const {
    applySeek,
    cleanupStalePlayers,
    getPlayerMeta,
    handleDownload,
    initPlayer,
    players,
    playersMeta,
    requestPlay,
    scheduleCardWarmup,
    schedulePlayersInit,
    stopAllPlayback,
    togglePlay,
  } = api;

  let listenersBound = false;

  function warmupFromInteractiveTarget(target) {
    const playBtn = target?.closest?.('.play-btn-main, .play-btn-rect');
    if (!playBtn) return;
    const card = playBtn.closest('[data-card-id]');
    scheduleCardWarmup(card);
  }

  function initAll(options = {}) {
    cleanupStalePlayers();
    const cards = Array.from(document.querySelectorAll('[data-card-id]'));
    schedulePlayersInit(cards, options);

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

      const dlBtn = e.target.closest('.download-btn-bottom, .download-btn-rect, .drumkit-download-btn');
      if (dlBtn) {
        if (dlBtn.classList.contains('auth-required-download')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const type = dlBtn.classList.contains('download-btn-bottom')
          ? 'sample'
          : (dlBtn.classList.contains('drumkit-download-btn') ? 'drumkit' : 'loop');
        handleDownload(dlBtn, type);
        return;
      }

      const sampleCard = e.target.closest('.sample-card.sample-item[data-card-id]');
      if (!sampleCard) return;

      if (e.target.closest('a, button, input, textarea, select, label')) {
        return;
      }

      initPlayer(sampleCard);
      const cardId = sampleCard.dataset.cardId;
      const meta = getPlayerMeta(cardId);
      if (!meta?.player) return;

      if (!applySeek(meta.player, 0)) {
        meta.pendingSeek = 0;
      }
      meta.userPaused = false;
      requestPlay(meta, { allowRetry: true, fromUserGesture: true });
    });

    document.addEventListener('pointerover', e => {
      warmupFromInteractiveTarget(e.target);
    });
    document.addEventListener('focusin', e => {
      warmupFromInteractiveTarget(e.target);
    });
    document.addEventListener('touchstart', e => {
      warmupFromInteractiveTarget(e.target);
    }, { passive: true });
  }

  function scheduleInitialInit() {
    const runInit = () => {
      initAll();
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(runInit);
      });
    } else {
      runInit();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInitialInit);
  } else {
    scheduleInitialInit();
  }

  window.__swInit = initAll;
  window.__swStopAll = stopAllPlayback;
  window.__swPlayers = { players, playersMeta };
}
