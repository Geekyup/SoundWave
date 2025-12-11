(function () {
    const players = {};               // { [cardId]: WaveSurferInstance }
    const playersMeta = {};           // { [cardId]: { isLoop: boolean, userPaused: boolean } }
    let currentPlayer = null;

    const ICONS = {
        play: '<svg class="play-icon" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
        pause: '<svg class="pause-icon" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
        playText: 'Play',
        pauseText: 'Pause',
        playIconRect: '<svg class="play-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>',
        pauseIconRect: '<svg class="pause-icon-rect" viewBox="0 0 24 24" fill="white"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
    };

    function setButtonIcon(button, playing) {
        if (!button) return;
        if (button.classList.contains('play-btn-rect')) {
            const text = playing ? ICONS.pauseText : ICONS.playText;
            const icon = playing ? ICONS.pauseIconRect : ICONS.playIconRect;
            button.innerHTML = text + icon;  // текст ПЕРЕД иконкой
        } else {
            button.innerHTML = playing ? ICONS.pause : ICONS.play;
        }
    }

    function pauseOtherPlayers(exceptPlayer) {
        Object.values(players).forEach(p => {
            if (p !== exceptPlayer && p.isPlaying && p.isPlaying()) {
                const id = p.cardId;
                if (playersMeta[id]) playersMeta[id].userPaused = false; // программная пауза
                p.pause();
                const otherBtn = document.querySelector(`[data-card-id="${id}"]`)?.querySelector('.play-btn-main');
                setButtonIcon(otherBtn, false);
                if (currentPlayer === p) currentPlayer = null;
            }
        });
    }

    function initPlayerForCard(card) {
        const cardId = card.dataset.cardId;
        const url = card.dataset.url;
        const waveformElement = card.querySelector('[id^="waveform-"]');

        if (!cardId || !url || !waveformElement) return;

        const ws = WaveSurfer.create({
            container: waveformElement,
            waveColor: 'rgba(107, 127, 247, 0.4)',
            progressColor: 'rgba(107, 127, 247, 0.8)',
            cursorColor: 'rgba(107, 127, 247, 1)',
            barWidth: 3,
            barGap: 2,
            barHeight: 1.5,
            responsive: true,
            normalize: true,
            url: url
        });

        ws.cardId = cardId;
        players[cardId] = ws;
        playersMeta[cardId] = { isLoop: false, userPaused: false };

        const cardElement = card.closest('.sample-card');
        if (cardElement && !cardElement.classList.contains('sample-item')) {
            playersMeta[cardId].isLoop = true;

            ws.on('finish', () => {
                const meta = playersMeta[cardId];
                // только если это loop и пользователь не поставил паузу
                if (meta && meta.isLoop && !meta.userPaused) {
                    // some browsers require a tiny timeout to avoid immediate re-finish
                    ws.seekTo(0);
                    ws.play();
                }
            });
        }

        // Когда этот плеер начинает играть - остановить остальных
        ws.on('play', () => {
            pauseOtherPlayers(ws);
            currentPlayer = ws;
            const btn = document.querySelector(`[data-card-id="${cardId}"]`)?.querySelector('.play-btn-main');
            setButtonIcon(btn, true);
        });

        // Когда этот плеер ставят на паузу через API - обновляем кнопку
        ws.on('pause', () => {
            const btn = document.querySelector(`[data-card-id="${cardId}"]`)?.querySelector('.play-btn-main');
            setButtonIcon(btn, false);
            if (currentPlayer === ws) currentPlayer = null;
        });
    }

    function initAllPlayers() {
        document.querySelectorAll('[data-card-id]').forEach(initPlayerForCard);
        
        // Инициализируем иконки на кнопках .play-btn-rect
        document.querySelectorAll('.play-btn-rect').forEach(button => {
            const cardId = button.dataset.cardId;
            if (cardId && players[cardId]) {
                setButtonIcon(button, false); // Устанавливаем Play иконку справа
            }
        });
    }

    function handlePlayButtonClick(button) {
        const cardId = button.dataset.cardId;
        const player = players[cardId];
        const meta = playersMeta[cardId];

        if (!player) return;

        if (player.isPlaying && player.isPlaying()) {
            // юзер нажал паузу -> помечаем как userPaused
            if (meta) meta.userPaused = true;
            player.pause();
            setButtonIcon(button, false);
            if (currentPlayer === player) currentPlayer = null;
        } else {
            // юзер нажал play -> снимаем маркер userPaused и запускаем
            if (meta) meta.userPaused = false;
            player.play();
            setButtonIcon(button, true);
            currentPlayer = player;
            // другие уже будут остановлены в обработчике 'play' этого плеера
        }
    }

    function handleLikeButtonClick(button) {
        button.classList.toggle('liked');
        // TODO: отправить AJAX/Fetch на сервер для сохранения лайка
    }

    function initUiListeners() {
        // делегируем клики для play/like кнопок
        document.addEventListener('click', (e) => {
            const playBtn = e.target.closest('.play-btn-main, .play-btn-rect');
            if (playBtn) {
                e.stopPropagation();
                handlePlayButtonClick(playBtn);
                return;
            }

            const likeBtn = e.target.closest('.like-btn');
            if (likeBtn) {
                e.stopPropagation();
                handleLikeButtonClick(likeBtn);
                return;
            }
        });
    }

    // Инициализация при готовности DOM (скрипт обычно внизу страницы, но на всякий случай)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initAllPlayers();
            initUiListeners();
        });
    } else {
        initAllPlayers();
        initUiListeners();
    }

    // Экспорт в глобальную область (только для отладки, не обязательно)
    window.__swPlayers = { players, playersMeta };

    // В начало IIFE добавьте отслеживание скачанных файлов
    const downloadedFiles = new Set();

    document.addEventListener('DOMContentLoaded', function() {
        // Обработчик для кнопок скачивания samples
        document.querySelectorAll('.download-btn-bottom').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();

                const cardId = this.closest('.sample-card').dataset.cardId;
                const downloadsEl = document.getElementById(`downloads-count-${cardId}`);
                const downloadKey = `sample_${cardId}`;

                // Просто инициируем скачивание, НЕ увеличиваем счетчик на клиенте
                const a = document.createElement('a');
                a.href = link.href;
                a.setAttribute('download', '');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // Увеличиваем счетчик только если это первый скачивание
                if (!downloadedFiles.has(downloadKey) && downloadsEl) {
                    downloadedFiles.add(downloadKey);
                    const currentCount = parseInt(downloadsEl.querySelector('.downloads-num').textContent);
                    downloadsEl.querySelector('.downloads-num').textContent = currentCount + 1;
                    
                    // Добавляем анимацию пульса
                    downloadsEl.style.animation = 'pulse 0.6s ease-out';
                    setTimeout(() => {
                        downloadsEl.style.animation = '';
                    }, 600);
                }
            });
        });

        // Обработчик для кнопок скачивания loops
        document.querySelectorAll('.download-btn-rect').forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                const cardId = this.closest('.sample-card').dataset.cardId;
                const downloadsEl = document.getElementById(`downloads-count-${cardId}`);
                const downloadKey = `loop_${cardId}`;
                
                // Инициируем скачивание
                const a = document.createElement('a');
                a.href = link.href;
                a.setAttribute('download', '');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Обновляем счетчик только если это первое скачивание
                if (!downloadedFiles.has(downloadKey)) {
                    setTimeout(() => {
                        if (downloadsEl) {
                            downloadedFiles.add(downloadKey);
                            const currentCount = parseInt(downloadsEl.querySelector('.downloads-num').textContent);
                            downloadsEl.querySelector('.downloads-num').textContent = currentCount + 1;
                            
                            // Добавляем анимацию пульса
                            downloadsEl.style.animation = 'pulse 0.6s ease-out';
                            setTimeout(() => {
                                downloadsEl.style.animation = '';
                            }, 600);
                        }
                    }, 100);
                }
            });
        });
    });
})();