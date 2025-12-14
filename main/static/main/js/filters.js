document.addEventListener('DOMContentLoaded', () => {
    
    const filterSelect = document.getElementById('sample-type-filter');
    const genreSelect = document.getElementById('sample-genre-filter');
    const resetButton = document.getElementById('reset-filters');

    function setSelectFromParams(select, param) {
        if (!select) return;
        const val = new URLSearchParams(window.location.search).get(param) || '';
        select.value = val;
        updateCustomSelectDisplay(select);
    }

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

    function applySampleFilters() {
        const params = new URLSearchParams(window.location.search);
        const typeVal = filterSelect?.value || '';
        const genreVal = genreSelect?.value || '';
        typeVal ? params.set('sample_type', typeVal) : params.delete('sample_type');
        genreVal ? params.set('genre', genreVal) : params.delete('genre');
        params.set('page', '1');
        window.location.search = '?' + params.toString();
    }

    if (filterSelect) {
        setSelectFromParams(filterSelect, 'sample_type');
        filterSelect.addEventListener('change', () => {
            updateCustomSelectDisplay(filterSelect);
            applySampleFilters();
        });
    }
    if (genreSelect) {
        setSelectFromParams(genreSelect, 'genre');
        genreSelect.addEventListener('change', () => {
            updateCustomSelectDisplay(genreSelect);
            applySampleFilters();
        });
    }
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            const params = new URLSearchParams(window.location.search);
            params.delete('sample_type');
            params.delete('genre');
            params.set('page', '1');
            if (filterSelect) filterSelect.value = '';
            if (genreSelect) genreSelect.value = '';
            updateCustomSelectDisplay(filterSelect);
            updateCustomSelectDisplay(genreSelect);
            window.location.search = '?' + params.toString();
        });
    }

    // --- LOOPS FILTERS (MODAL) ---
    const filterBtn = document.getElementById('loop-filter-btn');
    const modal = document.getElementById('loop-filter-modal');
    const closeBtn = document.getElementById('close-loop-filter');
    const form = document.getElementById('loop-filter-form');
    const resetBtn = document.getElementById('reset-loop-filters');

    if (filterBtn && modal) {
        filterBtn.addEventListener('click', e => {
            e.preventDefault();
            modal.classList.add('show');
        });
    }
    if (closeBtn && modal) {
        closeBtn.addEventListener('click', e => {
            e.preventDefault();
            modal.classList.remove('show');
        });
    }
    if (modal) {
        window.addEventListener('click', event => {
            if (event.target === modal) modal.classList.remove('show');
        });
    }
    if (form) {
        form.addEventListener('submit', e => {
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
    if (resetBtn && form) {
        resetBtn.addEventListener('click', e => {
            e.preventDefault();
            form.reset();
            window.location.href = window.location.pathname.split('?')[0];
        });
    }
});