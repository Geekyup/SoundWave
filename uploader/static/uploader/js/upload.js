const fileInput = document.querySelector('input[type="file"]');
const fileLabel = document.querySelector('.file-input-label');
const fileName = document.querySelector('.file-input-name');
const nameInput = document.querySelector('input[name="name"]') || 
                  document.getElementById('id_name');

fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        const file = e.target.files[0];
        fileName.textContent = `✓ ${file.name}`;
        fileName.classList.add('show');
        fileLabel.classList.add('active');
        
        const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
        if (nameInput) {
            nameInput.value = fileNameWithoutExtension;
        }
    }
});

fileLabel?.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileLabel.style.borderColor = 'var(--color-success)';
});

fileLabel?.addEventListener('dragleave', () => {
    fileLabel.style.borderColor = 'var(--color-accent)';
});

fileLabel?.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        fileInput.files = e.dataTransfer.files;
        fileName.textContent = `✓ ${file.name}`;
        fileName.classList.add('show');
        fileLabel.classList.add('active');
        
        const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
        if (nameInput) {
            nameInput.value = fileNameWithoutExtension;
        }
    }
});