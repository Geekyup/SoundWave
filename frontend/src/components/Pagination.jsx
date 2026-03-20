import { useSearchParams } from 'react-router-dom';

const DEFAULT_PAGE_SIZE = 12;

function buildPageRange(current, total) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }

  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, idx) => start + idx);
}

export default function Pagination({ count, isLoading = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');
  const totalPages = Math.max(1, Math.ceil(count / DEFAULT_PAGE_SIZE));

  if (totalPages <= 1) return null;

  const pageRange = buildPageRange(currentPage, totalPages);

  const scrollToCatalogTop = () => {
    if (typeof window === 'undefined') return;
    const catalog = document.getElementById('catalog');
    if (catalog) {
      const offset = 92;
      const top = Math.max(0, catalog.getBoundingClientRect().top + window.scrollY - offset);
      window.scrollTo({ top, behavior: 'auto' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const goToPage = page => {
    if (page === currentPage) return;
    if (typeof window !== 'undefined' && typeof window.__swStopAll === 'function') {
      window.__swStopAll({ destroy: true });
    }
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollToCatalogTop);
    } else {
      scrollToCatalogTop();
    }
  };

  return (
    <nav className="pagination" role="navigation" aria-label="Pagination" data-loading={isLoading ? 'true' : 'false'}>
      <ul className="pagination-list">
        <li className="pagination-item">
          <button
            className="pagination-link btn btn-secondary page-prev"
            onClick={() => goToPage(currentPage - 1)}
            aria-label="Previous page"
            type="button"
            disabled={isLoading || currentPage <= 1}
            aria-disabled={isLoading || currentPage <= 1}
          >
            ‹
          </button>
        </li>

        {pageRange.map((page, index) => (
          <li className="pagination-item" key={`${page}-${index}`}>
            {page === currentPage ? (
              <span className="pagination-link btn btn-primary current" aria-current="page">
                {page}
              </span>
            ) : (
              <button
                className="pagination-link btn btn-secondary page"
                onClick={() => goToPage(page)}
                type="button"
                disabled={isLoading}
                aria-disabled={isLoading}
              >
                {page}
              </button>
            )}
          </li>
        ))}

        <li className="pagination-item">
          <button
            className="pagination-link btn btn-secondary page-next"
            onClick={() => goToPage(currentPage + 1)}
            aria-label="Next page"
            type="button"
            disabled={isLoading || currentPage >= totalPages}
            aria-disabled={isLoading || currentPage >= totalPages}
          >
            ›
          </button>
        </li>
      </ul>
    </nav>
  );
}
