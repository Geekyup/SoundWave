import { useSearchParams } from 'react-router-dom';

const DEFAULT_PAGE_SIZE = 12;

function buildPageRange(current, total) {
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);
  const pages = [];
  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }
  return pages;
}

export default function Pagination({ count }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');
  const totalPages = Math.max(1, Math.ceil(count / DEFAULT_PAGE_SIZE));

  if (totalPages <= 1) return null;

  const pageRange = buildPageRange(currentPage, totalPages);

  const goToPage = page => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next, { replace: true });
  };

  return (
    <nav className="pagination" role="navigation" aria-label="Pagination">
      <ul className="pagination-list">
        {currentPage > 1 ? (
          <li className="pagination-item">
            <button
              className="pagination-link btn btn-secondary page-prev"
              onClick={() => goToPage(currentPage - 1)}
              aria-label="Previous page"
              type="button"
            >
              ‹
            </button>
          </li>
        ) : null}

        {pageRange.map(page => (
          <li className="pagination-item" key={page}>
            {page === currentPage ? (
              <span className="pagination-link btn btn-primary current" aria-current="page">
                {page}
              </span>
            ) : (
              <button
                className="pagination-link btn btn-secondary page"
                onClick={() => goToPage(page)}
                type="button"
              >
                {page}
              </button>
            )}
          </li>
        ))}

        {currentPage < totalPages ? (
          <li className="pagination-item">
            <button
              className="pagination-link btn btn-secondary page-next"
              onClick={() => goToPage(currentPage + 1)}
              aria-label="Next page"
              type="button"
            >
              ›
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
