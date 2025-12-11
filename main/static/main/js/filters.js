document.addEventListener('DOMContentLoaded', () => {
    const filterSelect = document.getElementById('sample-type-filter');
    const genreSelect = document.getElementById('sample-genre-filter');
    const resetButton = document.getElementById('reset-filters');
    const samplesGrid = document.getElementById('samples-grid');

    if (!filterSelect) return;

    // --- Инициализация значений селектов из GET-параметров (чтобы при перезагрузке выбор сохранялся) ---
    const initParams = new URLSearchParams(window.location.search);
    const initType = initParams.get('sample_type') || '';
    const initGenre = initParams.get('genre') || '';

    if (initType) {
        try { filterSelect.value = initType; } catch (e) { /* noop */ }
    } else {
        filterSelect.value = '';
    }

    if (genreSelect) {
        if (initGenre) {
            try { genreSelect.value = initGenre; } catch (e) { /* noop */ }
        } else {
            genreSelect.value = '';
        }
    }

    // Обновляем вид кастомных селектов согласно значению
    updateCustomSelectDisplay(filterSelect);
    if (genreSelect) updateCustomSelectDisplay(genreSelect);
    // --- конец инициализации ---

    // При изменении селекта переходим на URL с GET-параметрами — сервер вернёт корректную страницу с пагинацией
    filterSelect.addEventListener('change', () => {
        updateCustomSelectDisplay(filterSelect);
        applyFiltersToUrl();
    });

    if (genreSelect) {
        genreSelect.addEventListener('change', () => {
            updateCustomSelectDisplay(genreSelect);
            applyFiltersToUrl();
        });
    }

    function applyFiltersToUrl() {
        const params = new URLSearchParams(window.location.search);

        const typeVal = filterSelect.value || '';
        const genreVal = genreSelect?.value || '';

        if (typeVal) params.set('sample_type', typeVal);
        else params.delete('sample_type');

        if (genreVal) params.set('genre', genreVal);
        else params.delete('genre');

        // При применении фильтров сбрасываем страницу на 1
        params.set('page', '1');

        // Сохраняем другие параметры (например tab) автоматически, потому что используем существующий search
        window.location.search = '?' + params.toString();
    }

    // Обновление видимой части кастомного селекта
    function updateCustomSelectDisplay(sel) {
        if (!sel) return;

        const selectedOption = sel.options[sel.selectedIndex];
        const optionText = selectedOption ? selectedOption.textContent : '';

        const parent = sel.parentElement;

        const displayCandidates = [
            sel.nextElementSibling,
            parent?.querySelector('.nice-select'),
            parent?.querySelector('.custom-select'),
            parent?.querySelector('.select-selected'),
            parent?.querySelector('[class*="select"]')
        ];

        for (const el of displayCandidates) {
            if (!el) continue;

            const textEl = el.querySelector('.current') ||
                          el.querySelector('.selected') ||
                          el.querySelector('span') ||
                          el;

            if (textEl && textEl.textContent !== undefined) {
                textEl.textContent = optionText;
                break;
            }
        }
    }

    // Сброс фильтров -> удалить параметры и перезагрузить (page=1)
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            const params = new URLSearchParams(window.location.search);
            params.delete('sample_type');
            params.delete('genre');
            params.set('page', '1');

            // Сброс видимых значений на странице
            filterSelect.selectedIndex = 0;
            filterSelect.value = '';
            if (genreSelect) {
                genreSelect.selectedIndex = 0;
                genreSelect.value = '';
            }
            updateCustomSelectDisplay(filterSelect);
            if (genreSelect) updateCustomSelectDisplay(genreSelect);

            window.location.search = '?' + params.toString();
        });
    }

    // Эти функции остались на случай локального отображения пустого состояния (не обязателен)
    function checkEmptyState() {
        const visibleSamples = document.querySelectorAll('.sample-item:not(.hidden)');
        let emptyState = samplesGrid ? samplesGrid.querySelector('.empty-state') : null;

        if (visibleSamples.length === 0) {
            if (!emptyState && samplesGrid) {
                emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = '<p>По вашим критериям ничего не найдено.</p>';
                samplesGrid.appendChild(emptyState);
            }
        } else {
            if (emptyState) {
                emptyState.remove();
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const filterBtn = document.getElementById('loop-filter-btn');
    const modal = document.getElementById('loop-filter-modal');
    const closeBtn = document.getElementById('close-loop-filter');
    const form = document.getElementById('loop-filter-form');
    const resetBtn = document.getElementById('reset-loop-filters');

    // Открыть модальное окно
    if (filterBtn && modal) {
        filterBtn.addEventListener('click', function(e) {
            e.preventDefault();
            modal.classList.add('show');
        });
    }

    // Закрыть модальное окно по кнопке X
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            modal.classList.remove('show');
        });
    }

    // Закрыть модальное окно при клике вне окна
    if (modal) {
        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.classList.remove('show');
            }
        });
    }

    // Применить фильтры
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const params = new URLSearchParams();
            
            Array.from(form.elements).forEach(el => {
                if (el.name && el.value && el.type !== 'submit' && el.type !== 'button') {
                    params.append(el.name, el.value);
                }
            });
            
            window.location.search = params.toString();
        });
    }

    // Сброс фильтров
    if (resetBtn && form) {
        resetBtn.addEventListener('click', function(e) {
            e.preventDefault();
            form.reset();
            // Перенаправляем на страницу без параметров
            const url = window.location.pathname.split('?')[0];
            window.location.href = url;
        });
    }
});