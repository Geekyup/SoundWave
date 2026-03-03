import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listLoops } from '../api/loops.js';
import { listSamples } from '../api/samples.js';
import { getAccessToken } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';
import Select from '../components/Select.jsx';
import SiteHeader from '../components/SiteHeader.jsx';
import { GENRE_CHOICES, SAMPLE_TYPE_CHOICES } from '../constants.js';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getProfileHref(author) {
  const username = (author || '').trim();
  if (!username) return null;
  return `/profile/${encodeURIComponent(username)}`;
}

function extractKeywordTags(value, max = 5) {
  const raw = (value || '').trim();
  if (!raw) return [];

  const byDelimiter = raw.split(/[,;|]+/).map(item => item.trim()).filter(Boolean);
  const tokens = byDelimiter.length > 1
    ? byDelimiter
    : raw.split(/\s+/).map(item => item.trim()).filter(Boolean);

  const seen = new Set();
  const result = [];
  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(token);
    if (result.length >= max) break;
  }
  return result;
}

export default function Home({ tab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [loops, setLoops] = useState([]);
  const [samples, setSamples] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loopForm, setLoopForm] = useState({
    genre: '',
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
    bpm_min: searchParams.get('bpm_min') || '',
    bpm_max: searchParams.get('bpm_max') || '',
    author: searchParams.get('author') || '',
    keywords: searchParams.get('keywords') || '',
    sort: searchParams.get('sort') || '',
  }), [searchParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const fetchData = async () => {
      if (isSamples) {
        const params = {
          ...sampleFilters,
          page: currentPage,
        };
        if (query) params.search = query;
        const data = await listSamples(params);
        if (!active) return;
        setSamples(data.results || []);
        setCount(data.count || 0);
      } else {
        const params = { page: currentPage };
        if (loopFilters.genre) params.genre = loopFilters.genre;
        if (loopFilters.bpm_min) params.bpm_min = loopFilters.bpm_min;
        if (loopFilters.bpm_max) params.bpm_max = loopFilters.bpm_max;
        if (loopFilters.author) params.author = loopFilters.author;
        if (loopFilters.keywords) params.keywords = loopFilters.keywords;
        if (loopFilters.sort) params.ordering = loopFilters.sort;
        if (query) params.search = query;
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
    if (window.__swInit) {
      window.__swInit();
    }
  }, [loops, samples]);

  const handleSampleFilterChange = (field, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(field, value);
    } else {
      next.delete(field);
    }
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleSearchSubmit = e => {
    e.preventDefault();
    const value = searchText.trim();
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleSampleReset = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('sample_type');
    next.delete('genre');
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleLoopFormChange = (field, value) => {
    setLoopForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyLoopFilters = e => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    ['genre', 'bpm_min', 'bpm_max', 'author', 'keywords', 'sort'].forEach(key => {
      if (loopForm[key]) {
        next.set(key, loopForm[key]);
      } else {
        next.delete(key);
      }
    });
    next.set('page', '1');
    setSearchParams(next, { replace: true });
    setModalOpen(false);
  };

  const resetLoopFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['genre', 'bpm_min', 'bpm_max', 'author', 'keywords', 'sort'].forEach(key => {
      next.delete(key);
    });
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="page-wrapper">
      <SiteHeader
        active={isSamples ? 'samples' : 'loops'}
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
      />

      <div className="content-wrapper" id="catalog">
        <main className="main-content">
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
                {loading ? (
                  <div className="empty-state">
                    <p>Loading samples...</p>
                  </div>
                ) : samples.length ? (
                  samples.map(sample => {
                    const sampleAuthor = sample.author?.trim() || 'Unknown';
                    const sampleAuthorHref = getProfileHref(sample.author);

                    return (
                      <div
                        className="sample-card sample-square sample-item"
                        id={`card-${sample.id}`}
                        data-card-id={sample.id}
                        data-url={sample.audio_file}
                        data-kind="samples"
                        data-waveform-peaks={sample.waveform?.peaks?.length ? JSON.stringify(sample.waveform.peaks) : ''}
                        data-waveform-duration={sample.waveform?.duration || ''}
                        data-type={sample.sample_type}
                        data-genre={sample.genre}
                        key={sample.id}
                      >
                        <span className="downloads-count sample-downloads-top" id={`downloads-count-${sample.id}`}>
                          <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          <span className="downloads-num">{sample.downloads}</span>
                        </span>

                        <div className="sample-info">
                          <h3 className="sample-title">{sample.name}</h3>
                          <p className="sample-type">{sample.sample_type_display}</p>
                          <p className="sample-author">
                            <span className="sample-author-prefix">by </span>
                            {sampleAuthorHref ? (
                              <a href={sampleAuthorHref} className="sample-author-link" title={`View ${sampleAuthor} profile`}>
                                {sampleAuthor}
                              </a>
                            ) : (
                              <span className="sample-author-muted">{sampleAuthor}</span>
                            )}
                          </p>
                        </div>

                        <div className="sample-waveform-container">
                          <div className="sample-waveform" id={`waveform-${sample.id}`}></div>
                        </div>

                        <div className="sample-controls">
                          <button
                            className="play-btn-main sample-play-btn"
                            data-card-id={sample.id}
                            data-url={sample.audio_file}
                            title="Play"
                            type="button"
                          >
                            <svg className="play-icon" viewBox="0 0 24 24" fill="white">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>

                          {isAuthenticated ? (
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
                            <a
                              href="/login"
                              className="download-btn-bottom download-btn-bottom-login auth-required-download"
                              title="Login to download"
                            >
                              Login
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <p>No uploaded samples.</p>
                  </div>
                )}
              </div>

              <Pagination count={count} />
            </>
          ) : (
            <section className="section">
              <header className="section-header section-header--flex">
                <h2>Popular Tracks</h2>
                <button className="btn btn-secondary" id="loop-filter-btn" type="button" onClick={() => setModalOpen(true)}>
                  Filter
                </button>
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

              <div className="sample-grid">
                {loading ? (
                  <div className="empty-state">
                    <p>Loading loops...</p>
                  </div>
                ) : loops.length ? (
                  loops.map(loop => {
                    const loopAuthor = loop.author?.trim() || 'Unknown';
                    const loopAuthorHref = getProfileHref(loop.author);
                    const keywordTags = extractKeywordTags(loop.keywords, 5);

                    return (
                      <div
                        className="sample-card"
                        id={`card-${loop.id}`}
                        data-card-id={loop.id}
                        data-url={loop.audio_file}
                        data-kind="loops"
                        data-waveform-peaks={loop.waveform?.peaks?.length ? JSON.stringify(loop.waveform.peaks) : ''}
                        data-waveform-duration={loop.waveform?.duration || ''}
                        key={loop.id}
                      >
                        <div className="card-header">
                          <div className="card-info">
                            <h3 className="card-title">{loop.name}</h3>
                            <div className="card-author">
                              <div className="card-author-wrapper">
                                <div className="card-author-avatar">
                                  {loopAuthor.charAt(0).toUpperCase()}
                                </div>
                                {loopAuthorHref ? (
                                  <a href={loopAuthorHref} className="author-link">{loopAuthor}</a>
                                ) : (
                                  <span className="author-link">{loopAuthor}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="card-meta-top">
                            <span className="upload-date">{formatDate(loop.uploaded_at)}</span>
                          </div>
                        </div>

                        <div className="card-waveform">
                          <div className="waveform-container" id={`waveform-${loop.id}`}></div>
                        </div>

                        <div className="card-controls">
                          <div className="controls-right">
                            <span className="downloads-count" id={`downloads-count-${loop.id}`}>
                              <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                              </svg>
                              <span className="downloads-num">{loop.downloads}</span>
                            </span>
                          </div>

                          <div className="controls-actions">
                            {isAuthenticated ? (
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
                              <a
                                href="/login"
                                className="download-btn-rect auth-required-download"
                                title="Login to download"
                              >
                                Login
                              </a>
                            )}
                            <button className="play-btn-rect" data-card-id={loop.id} data-url={loop.audio_file} type="button">
                              Play
                            </button>
                          </div>
                        </div>

                        <div className="card-tags">
                          <span className="tag bpm-tag">{loop.bpm} bpm</span>
                          <span className="tag genre-tag">{loop.genre_display}</span>
                          <span className="tag size-tag">{loop.file_size}</span>
                          {keywordTags.map(tag => (
                            <span className="tag keyword-tag" key={`${loop.id}-${tag}`}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state">
                    <p>
                      No uploaded tracks.
                      <a href="/upload">Upload the first</a>
                    </p>
                  </div>
                )}
              </div>

              <Pagination count={count} />
            </section>
          )}
        </main>
      </div>

      <footer className="footer">
        <div className="footer-bottom">
          <p>&copy; 2025 SoundWave. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
