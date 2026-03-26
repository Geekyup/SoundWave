import { apiFetch, clearTokens } from '../api/client.js';

export function createDownloadController() {
  const downloadedFiles = new Set();

  function parseFilename(contentDisposition, fallbackHref) {
    const fallback = (() => {
      try {
        return decodeURIComponent(new URL(fallbackHref, window.location.origin).pathname.split('/').pop() || 'download');
      } catch (_) {
        return 'download';
      }
    })();

    if (!contentDisposition) return fallback;
    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) {
      try {
        return decodeURIComponent(utfMatch[1].replace(/["']/g, ''));
      } catch (_) {
        return utfMatch[1].replace(/["']/g, '') || fallback;
      }
    }

    const regularMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
    if (regularMatch?.[1]) {
      return regularMatch[1].trim();
    }

    return fallback;
  }

  async function handleDownload(btn, type) {
    const href = btn.getAttribute('href');
    if (!href) return;

    const card = btn.closest('.sample-card');
    const cardId = card?.dataset?.cardId || '';
    const key = cardId ? `${type}_${cardId}` : `${type}_${href}`;
    if (downloadedFiles.has(key)) return;

    try {
      const response = await apiFetch(href, { method: 'GET' });
      if (response.status === 401 || response.status === 403) {
        clearTokens();
        alert('Ошибка: Требуется авторизация. Войдите снова.');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const filename = parseFilename(response.headers.get('Content-Disposition'), href);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      downloadedFiles.add(key);

      if (!cardId) return;
      const numEl = document.getElementById(`downloads-count-${cardId}`)?.querySelector('.downloads-num');
      if (!numEl) return;

      const currentValue = parseInt(numEl.textContent, 10) || 0;
      numEl.textContent = String(currentValue + 1);
      const downloadsEl = numEl.closest(`#downloads-count-${cardId}`);
      if (!downloadsEl) return;

      downloadsEl.style.animation = 'pulse 0.6s ease-out';
      setTimeout(() => {
        downloadsEl.style.animation = '';
      }, 600);
    } catch (_) {
      alert('Ошибка: не удалось скачать файл. Попробуйте снова.');
    }
  }

  return {
    handleDownload,
  };
}
