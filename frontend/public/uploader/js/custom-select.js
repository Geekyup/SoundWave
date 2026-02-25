class CustomSelect {
    constructor(selectElement) {
        this.select = selectElement;
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-select-wrapper';
        
        this.trigger = document.createElement('button');
        this.trigger.className = 'select-trigger';
        this.trigger.type = 'button';
        this.trigger.setAttribute('aria-haspopup', 'listbox');
        this.trigger.setAttribute('aria-expanded', 'false');
        
        this.optionsList = document.createElement('ul');
        this.optionsList.className = 'select-options';
        this.optionsList.setAttribute('role', 'listbox');
        
        // Определяем направление открытия
        this.direction = this.getDirection();
        
        this.init();
    }
    
    getDirection() {
        // Если это фильтр жанра на главной странице - открываем вниз
        if (document.getElementById('sample-genre-filter') === this.select) {
            return 'down';
        }
        // Если это фильтр типа на главной странице - открываем вниз
        if (document.getElementById('sample-type-filter') === this.select) {
            return 'down';
        }
        // Если это фильтр жанра в модалке loops - открываем вниз
        if (document.getElementById('genre-filter') === this.select) {
            return 'down';
        }
        // Для остальных (загрузка) - открываем вверх
        return 'up';
    }
    
    init() {
        this.select.style.display = 'none';
        this.select.parentNode.insertBefore(this.wrapper, this.select);
        
        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';
        
        // Добавляем класс для направления
        if (this.direction === 'down') {
            customSelect.classList.add('select-down');
        } else {
            customSelect.classList.add('select-up');
        }
        
        this.wrapper.appendChild(customSelect);
        customSelect.appendChild(this.trigger);
        customSelect.appendChild(this.optionsList);
        customSelect.appendChild(this.select);
        
        this.updateTrigger();
        this.populateOptions();
        this.attachEvents();
    }
    
    populateOptions() {
        this.optionsList.innerHTML = '';
        
        Array.from(this.select.options).forEach((option, index) => {
            const li = document.createElement('li');
            li.className = 'select-option';
            li.textContent = option.text;
            li.dataset.value = option.value;
            li.setAttribute('role', 'option');
            li.setAttribute('data-index', index);
            li.setAttribute('tabindex', '0');
            
            if (option.selected) {
                li.classList.add('selected');
                li.setAttribute('aria-selected', 'true');
            }
            
            li.addEventListener('click', () => this.selectOption(option.value, option.text, li));
            li.addEventListener('keydown', (e) => this.handleKeyPress(e, li));
            this.optionsList.appendChild(li);
        });
    }
    
    updateTrigger() {
        const selectedOption = this.select.options[this.select.selectedIndex];
        this.trigger.textContent = selectedOption ? selectedOption.text : 'Выберите опцию';
    }
    
    selectOption(value, text, li) {
        this.select.value = value;
        
        document.querySelectorAll('.select-option').forEach(opt => {
            opt.classList.remove('selected');
            opt.setAttribute('aria-selected', 'false');
        });
        
        li.classList.add('selected');
        li.setAttribute('aria-selected', 'true');
        
        this.updateTrigger();
        this.closeDrop();
        
        // Событие для дополнительной функциональности
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    handleKeyPress(e, li) {
        const options = Array.from(this.optionsList.querySelectorAll('.select-option'));
        const currentIndex = options.indexOf(li);
        
        switch(e.key) {
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    options[currentIndex - 1].focus();
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < options.length - 1) {
                    options[currentIndex + 1].focus();
                }
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                this.selectOption(li.dataset.value, li.textContent, li);
                break;
            case 'Escape':
                e.preventDefault();
                this.closeDrop();
                this.trigger.focus();
                break;
        }
    }
    
    toggleDrop() {
        this.trigger.classList.toggle('active');
        this.optionsList.classList.toggle('show');
        
        const isOpen = this.trigger.classList.contains('active');
        this.trigger.setAttribute('aria-expanded', isOpen);
        
        if (isOpen) {
            // Фокусируем первый выбранный элемент
            const selectedOption = this.optionsList.querySelector('.select-option.selected');
            if (selectedOption) {
                selectedOption.focus();
            }
        }
    }
    
    closeDrop() {
        this.trigger.classList.remove('active');
        this.optionsList.classList.remove('show');
        this.trigger.setAttribute('aria-expanded', 'false');
    }
    
    attachEvents() {
        this.trigger.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleDrop();
        });
        
        this.trigger.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowDown':
                case 'ArrowUp':
                case ' ':
                case 'Enter':
                    e.preventDefault();
                    this.toggleDrop();
                    break;
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.closeDrop();
            }
        });
    }
}

// Инициализация всех select элементов
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('select').forEach(select => {
        new CustomSelect(select);
    });
});