import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { listLoops } from '../api/loops.js';
import { listSamples } from '../api/samples.js';
import { getAccessToken } from '../api/client.js';
import CatalogPageLayout from '../components/CatalogPageLayout.jsx';
import { LoopCardSkeletonList, SampleSquareSkeletonGrid } from '../components/LibrarySkeletons.jsx';
import LoopCard from '../components/LoopCard.jsx';
import { scheduleMediaPlayerInit, stopAllMediaPlayers } from '../media-player/runtime.js';
import Pagination from '../components/Pagination.jsx';
import SampleCard from '../components/SampleCard.jsx';
import Select from '../components/Select.jsx';
import { GENRE_CHOICES, SAMPLE_TYPE_CHOICES } from '../constants.js';
import { formatDateTime } from '../utils/date.js';
import { patchSearchParams, removeSearchParams } from '../utils/searchParams.js';
import { extractKeywordTags, getProfileHref } from '../utils/library.js';

const LOOP_DATE_WINDOW_CHOICES = [
  { value: '', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '48h', label: 'Last 48 hours' },
  { value: 'week', label: 'Last week' },
  { value: 'month', label: 'Last month' },
];
const LOOP_FILTER_FIELDS = ['genre', 'date_window', 'bpm_min', 'bpm_max', 'author', 'keywords', 'sort'];

export default function Home({ tab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [loops, setLoops] = useState([]);
  const [samples, setSamples] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loopsPageReady, setLoopsPageReady] = useState(tab === 'samples');
  const [modalOpen, setModalOpen] = useState(false);
  const [loopForm, setLoopForm] = useState({
    genre: '',
    date_window: '',
    bpm_min: '',
    bpm_max: '',
    author: '',
    keywords: '',
    sort: '',
  });

  const isSamples = tab === 'samples';
  const isAuthenticated = Boolean(getAccessToken());
  const currentPage = searchParams.get('page') || '1';
  const query = searchParams.get('q') || '';

  useEffect(() => {
    setSearchText(query);
  }, [query]);

  useEffect(() => {
    setLoopForm({
      genre: searchParams.get('genre') || '',
      date_window: searchParams.get('date_window') || '',
      bpm_min: searchParams.get('bpm_min') || '',
      bpm_max: searchParams.get('bpm_max') || '',
      author: searchParams.get('author') || '',
      keywords: searchParams.get('keywords') || '',
      sort: searchParams.get('sort') || '',
    });
  }, [searchParams]);

  const sampleFilters = useMemo(() => ({
    sample_type: searchParams.get('sample_type') || '',
    genre: searchParams.get('genre') || '',
  }), [searchParams]);

  const loopFilters = useMemo(() => ({
    genre: searchParams.get('genre') || '',
    date_window: searchParams.get('date_window') || '',
    bpm_min: searchParams.get('bpm_min') || '',
    bpm_max: searchParams.get('bpm_max') || '',
    author: searchParams.get('author') || '',
    keywords: searchParams.get('keywords') || '',
    sort: searchParams.get('sort') || '',
  }), [searchParams]);

  const genreLabelByValue = useMemo(
    () => Object.fromEntries(GENRE_CHOICES.map(item => [item.value, item.label])),
    [],
  );

  const activeLoopGenreLabel = loopFilters.genre
    ? (genreLabelByValue[loopFilters.genre] || loopFilters.genre)
    : '';
  const activeLoopKeywordLabel = loopFilters.keywords.trim();
  const showLoopsLoadingState = !isSamples && (loading || !loopsPageReady);
  const showLoopsPrerender = !isSamples && !loading && !loopsPageReady;

  useEffect(() => {
    let active = true;
    setLoading(true);
    if (isSamples) {
      setLoopsPageReady(true);
    } else {
      setLoopsPageReady(false);
    }

    const fetchData = async () => {
      if (isSamples) {
        const params = {
          ...sampleFilters,
          page: currentPage,
        };
        if (query) params.search = query;
        params.include_waveform = '1';
        const data = await listSamples(params);
        if (!active) return;
        setSamples(data.results || []);
        setCount(data.count || 0);
      } else {
        const params = { page: currentPage };
        if (loopFilters.genre) params.genre = loopFilters.genre;
        if (loopFilters.date_window) params.date_window = loopFilters.date_window;
        if (loopFilters.bpm_min) params.bpm_min = loopFilters.bpm_min;
        if (loopFilters.bpm_max) params.bpm_max = loopFilters.bpm_max;
        if (loopFilters.author) params.author = loopFilters.author;
        if (loopFilters.keywords) params.keywords = loopFilters.keywords;
        if (loopFilters.sort) params.ordering = loopFilters.sort;
        if (query) params.search = query;
        params.include_waveform = '1';
        const data = await listLoops(params);
        if (!active) return;
        setLoops(data.results || []);
        setCount(data.count || 0);
      }
    };

    fetchData()
      .catch(() => {
        if (active) {
          setLoops([]);
          setSamples([]);
          setCount(0);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSamples, sampleFilters, loopFilters, currentPage, query]);

  useEffect(() => {
    if (isSamples) {
      setLoopsPageReady(true);
      return undefined;
    }
    if (loading) return undefined;

    let active = true;
    let revealFrame = null;
    let revealFrameNested = null;
    let revealTimeout = null;

    const reveal = () => {
      if (!active) return;
      setLoopsPageReady(true);
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      revealFrame = window.requestAnimationFrame(() => {
        revealFrameNested = window.requestAnimationFrame(reveal);
      });
    } else if (typeof window !== 'undefined') {
      revealTimeout = window.setTimeout(reveal, 32);
    } else {
      reveal();
    }

    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        if (revealFrame !== null && typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(revealFrame);
        }
        if (revealFrameNested !== null && typeof window.cancelAnimationFrame === 'function') {
          window.cancelAnimationFrame(revealFrameNested);
        }
        if (revealTimeout !== null) {
          window.clearTimeout(revealTimeout);
        }
      }
    };
  }, [isSamples, loading, loops.length]);

  useEffect(() => {
    if (!isSamples && !loopsPageReady) {
      stopAllMediaPlayers({ destroy: true });
      return;
    }

    if (isSamples) {
      if (!samples.length) {
        stopAllMediaPlayers({ destroy: true });
        return;
      }
    } else if (!loops.length) {
      stopAllMediaPlayers({ destroy: true });
      return;
    }

    scheduleMediaPlayerInit(
      isSamples
        ? {}
        : { idleTimeout: 140, fallbackDelay: 16 },
    );
  }, [isSamples, loops.length, loopsPageReady, samples.length]);

  const renderLoopCards = extraClassName => (
    <div className={`sample-grid ${extraClassName || ''}`.trim()}>
      {loops.length ? (
        loops.map(loop => {
          const loopAuthor = loop.author?.trim() || 'Unknown';
          const loopAuthorHref = getProfileHref(loop.author);
          const keywordTags = extractKeywordTags(loop.keywords, 3);

          return (
            <LoopCard
              key={loop.id}
              loop={loop}
              authorName={loopAuthor}
              authorHref={loopAuthorHref}
              metaContent={<span className="upload-date">{formatDateTime(loop.uploaded_at)}</span>}
              keywordTags={keywordTags}
              onGenreClick={applyLoopGenreFilter}
              onKeywordClick={applyLoopKeywordFilter}
              primaryAction={isAuthenticated ? (
                <a
                  href={`/api/loops/${loop.id}/download/`}
                  className="download-btn-rect"
                  title="Download loop"
                >
                  <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
                    <line x1="4" y1="20" x2="20" y2="20" />
                  </svg>
                  Download
                </a>
              ) : (
                <Link
                  to="/login"
                  className="download-btn-rect auth-required-download"
                  title="Login to download"
                >
                  Login
                </Link>
              )}
            />
          );
        })
      ) : (
        <div className="empty-state">
          <p>
            No uploaded tracks.
            <Link to="/upload">Upload the first</Link>
          </p>
        </div>
      )}
    </div>
  );

  const handleSampleFilterChange = (field, value) => {
    setSearchParams(
      patchSearchParams(searchParams, {
        [field]: value || null,
        page: '1',
      }),
      { replace: true },
    );
  };

  const handleSearchSubmit = e => {
    e.preventDefault();
    setSearchParams(
      patchSearchParams(searchParams, {
        q: searchText.trim() || null,
        page: '1',
      }),
      { replace: true },
    );
  };

  const handleSampleReset = () => {
    setSearchParams(
      removeSearchParams(searchParams, ['sample_type', 'genre'], { page: '1' }),
      { replace: true },
    );
  };

  const handleLoopFormChange = (field, value) => {
    setLoopForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyLoopGenreFilter = genreValue => {
    setSearchParams(
      patchSearchParams(searchParams, {
        genre: genreValue || null,
        page: '1',
      }),
      { replace: true },
    );
  };

  const applyLoopKeywordFilter = keywordValue => {
    const normalized = (keywordValue || '').trim();
    setSearchParams(
      patchSearchParams(searchParams, {
        keywords: normalized || null,
        page: '1',
      }),
      { replace: true },
    );
  };

  const applyLoopFilters = e => {
    e.preventDefault();
    const nextValues = LOOP_FILTER_FIELDS.reduce((accumulator, key) => ({
      ...accumulator,
      [key]: loopForm[key] || null,
    }), { page: '1' });

    setSearchParams(
      patchSearchParams(searchParams, nextValues),
      { replace: true },
    );
    setModalOpen(false);
  };

  const resetLoopFilters = () => {
    setSearchParams(
      removeSearchParams(searchParams, LOOP_FILTER_FIELDS, { page: '1' }),
      { replace: true },
    );
  };

  return (
    <CatalogPageLayout
      active={isSamples ? 'samples' : 'loops'}
      contentId="catalog"
      searchContent={(
        <form onSubmit={handleSearchSubmit}>
          <input
            type="text"
            name="q"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder={isSamples ? 'Search samples...' : 'Search loops...'}
          />
        </form>
      )}
    >
      {isSamples ? (
        <>
              <div className="filters-container">
                <div className="filter-group">
                  <label className="filter-label">Sample Type</label>
                  <Select
                    ariaLabel="Sample type"
                    value={sampleFilters.sample_type}
                    onChange={value => handleSampleFilterChange('sample_type', value)}
                    placeholder="All"
                    options={[
                      { value: '', label: 'All' },
                      ...SAMPLE_TYPE_CHOICES,
                    ]}
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Genre</label>
                  <Select
                    ariaLabel="Genre"
                    value={sampleFilters.genre}
                    onChange={value => handleSampleFilterChange('genre', value)}
                    placeholder="All"
                    options={[
                      { value: '', label: 'All' },
                      ...GENRE_CHOICES,
                    ]}
                  />
                </div>

                <button className="btn-reset-filters" id="reset-filters" onClick={handleSampleReset} type="button">
                  Reset
                </button>
              </div>

              <div className="sample-grid samples-grid" id="samples-grid">
                {loading && samples.length ? (
                  <div className="list-loading-overlay" aria-hidden="true">
                    <span className="list-loading-text">Loading samples...</span>
                  </div>
                ) : null}
                {loading && !samples.length ? (
                  <SampleSquareSkeletonGrid />
                ) : samples.length ? (
                  samples.map(sample => {
                    const sampleAuthor = sample.author?.trim() || 'Unknown';
                    const sampleAuthorHref = getProfileHref(sample.author);

                    return (
                      <SampleCard
                        key={sample.id}
                        sample={sample}
                        authorName={sampleAuthor}
                        authorHref={sampleAuthorHref}
                        authorLinkTitle={`View ${sampleAuthor} profile`}
                        secondaryAction={isAuthenticated ? (
                          <a
                            href={`/api/samples/${sample.id}/download/`}
                            className="download-btn-bottom"
                            title="Download sample"
                          >
                            <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </a>
                        ) : (
                          <Link
                            to="/login"
                            className="download-btn-bottom download-btn-bottom-login auth-required-download"
                            title="Login to download"
                          >
                            Login
                          </Link>
                        )}
                      />
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <p>No uploaded samples.</p>
                  </div>
                )}
              </div>

              <Pagination count={count} isLoading={loading} />
        </>
      ) : (
        <section className="section">
          <header className="section-header section-header--flex">
            <h2>Popular Tracks</h2>
            <div className="section-header-actions">
              {activeLoopGenreLabel ? (
                <div className="active-loop-genre-chip" title={`Genre filter: ${activeLoopGenreLabel}`}>
                  <span className="active-loop-genre-chip-value">{activeLoopGenreLabel}</span>
                  <button
                    type="button"
                    className="active-loop-genre-chip-clear"
                    onClick={() => applyLoopGenreFilter('')}
                    aria-label="Clear genre filter"
                  >
                    ×
                  </button>
                </div>
              ) : null}
              {activeLoopKeywordLabel ? (
                <div className="active-loop-genre-chip active-loop-keyword-chip" title={`Keyword filter: ${activeLoopKeywordLabel}`}>
                  <span className="active-loop-genre-chip-value">{activeLoopKeywordLabel}</span>
                  <button
                    type="button"
                    className="active-loop-genre-chip-clear"
                    onClick={() => applyLoopKeywordFilter('')}
                    aria-label="Clear keyword filter"
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <button className="btn btn-secondary" id="loop-filter-btn" type="button" onClick={() => setModalOpen(true)}>
                Filter
              </button>
            </div>
          </header>

          <div id="loop-filter-modal" className={`modal ${modalOpen ? 'show' : ''}`}>
            <div className="modal-content">
              <button
                type="button"
                className="modal-close-btn"
                id="close-loop-filter"
                onClick={() => setModalOpen(false)}
                aria-label="Close filter modal"
              >
                <span className="modal-close-icon" aria-hidden="true">×</span>
              </button>
              <h3>Loop Filters</h3>
              <form id="loop-filter-form" onSubmit={applyLoopFilters}>
                <div className="filter-group">
                  <label htmlFor="genre-filter">Genre</label>
                  <Select
                    ariaLabel="Genre"
                    value={loopForm.genre}
                    onChange={value => handleLoopFormChange('genre', value)}
                    placeholder="All"
                    options={[
                      { value: '', label: 'All' },
                      ...GENRE_CHOICES,
                    ]}
                    direction="down"
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="date-window-filter">Date</label>
                  <Select
                    ariaLabel="Date window"
                    value={loopForm.date_window}
                    onChange={value => handleLoopFormChange('date_window', value)}
                    placeholder="Any time"
                    options={LOOP_DATE_WINDOW_CHOICES}
                    direction="down"
                  />
                </div>
                <div className="filter-group filter-group-bpm">
                  <label htmlFor="bpm-min-filter">BPM</label>
                  <div className="bpm-range-inputs">
                    <input
                      type="number"
                      name="bpm_min"
                      id="bpm-min-filter"
                      min="0"
                      placeholder="from"
                      value={loopForm.bpm_min}
                      onChange={e => handleLoopFormChange('bpm_min', e.target.value)}
                    />
                    <input
                      type="number"
                      name="bpm_max"
                      id="bpm-max-filter"
                      min="0"
                      placeholder="to"
                      value={loopForm.bpm_max}
                      onChange={e => handleLoopFormChange('bpm_max', e.target.value)}
                    />
                  </div>
                </div>
                <div className="filter-group">
                  <label htmlFor="author-filter">Author</label>
                  <input
                    type="text"
                    name="author"
                    id="author-filter"
                    value={loopForm.author}
                    onChange={e => handleLoopFormChange('author', e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="keywords-filter">Keywords</label>
                  <input
                    type="text"
                    name="keywords"
                    id="keywords-filter"
                    placeholder="Search tags..."
                    value={loopForm.keywords}
                    onChange={e => handleLoopFormChange('keywords', e.target.value)}
                  />
                </div>
                <div className="filter-group">
                  <label htmlFor="sort-filter">Sort by</label>
                  <Select
                    ariaLabel="Sort by"
                    value={loopForm.sort}
                    onChange={value => handleLoopFormChange('sort', value)}
                    placeholder="Newest"
                    options={[
                      { value: '', label: 'Newest' },
                      { value: 'downloads', label: 'Most downloaded' },
                    ]}
                    direction="up"
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="loop-filter-btn loop-filter-btn-secondary" id="reset-loop-filters" onClick={resetLoopFilters}>
                    Reset
                  </button>
                  <button type="submit" className="loop-filter-btn loop-filter-btn-primary">Apply</button>
                </div>
              </form>
            </div>
          </div>

          {loading ? (
            <div className="sample-grid">
              <LoopCardSkeletonList />
            </div>
          ) : showLoopsPrerender ? (
            <div className="loop-page-stage">
              {renderLoopCards('loop-page-results is-prerendering')}
              <div className="loop-page-loading-cover" aria-hidden="true">
                <LoopCardSkeletonList />
              </div>
            </div>
          ) : (
            renderLoopCards()
          )}

          <div className="pagination-slot">
            {!showLoopsLoadingState ? (
              <Pagination count={count} isLoading={loading} />
            ) : null}
          </div>
        </section>
      )}
    </CatalogPageLayout>
  );
}
