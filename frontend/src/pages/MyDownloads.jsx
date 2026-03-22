import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getAccessToken } from '../api/client.js';
import { listMyDownloads } from '../api/myDownloads.js';
import Pagination from '../components/Pagination.jsx';
import SiteHeader from '../components/SiteHeader.jsx';

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

const DOWNLOAD_TABS = [
  { value: 'loop', label: 'Loops' },
  { value: 'sample', label: 'Samples' },
  { value: 'drumkit', label: 'Drum Kits' },
];

export default function MyDownloads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAuthenticated = Boolean(getAccessToken());
  const type = (searchParams.get('type') || 'loop').trim().toLowerCase();
  const activeType = DOWNLOAD_TABS.some(item => item.value === type) ? type : 'loop';
  const page = searchParams.get('page') || '1';

  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    setLoading(true);
    setError('');

    listMyDownloads({
      type: activeType,
      page,
      ...(activeType !== 'drumkit' ? { include_waveform: '1' } : {}),
    })
      .then(data => {
        if (!active) return;
        setItems(data.results || []);
        setCount(data.count || 0);
      })
      .catch(err => {
        if (!active) return;
        setItems([]);
        setCount(0);
        setError(err.message || 'Failed to load downloads.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated, activeType, page]);

  useEffect(() => {
    if (activeType === 'drumkit') return;
    if (window.__swInit) {
      window.__swInit();
    }
  }, [items, activeType]);

  const setType = nextType => {
    const next = new URLSearchParams(searchParams);
    next.set('type', nextType);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  if (!isAuthenticated) {
    return (
      <div className="page-wrapper downloads-library-page">
        <SiteHeader active="" showCatalogNav={false} />
        <div className="content-wrapper downloads-library-wrapper">
          <main className="main-content downloads-library-main">
            <section className="profile-compact-card downloads-library-guard">
              <p className="downloads-library-kicker">Library</p>
              <h1>Log in to view your downloads</h1>
              <p>Your personal download library is available after sign in.</p>
              <Link to="/login" className="btn btn-primary">Login</Link>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper downloads-library-page">
      <SiteHeader
        active=""
        showCatalogNav={false}
        searchContent={<input type="text" readOnly value="My downloads" aria-label="My downloads" />}
      />

      <div className="content-wrapper downloads-library-wrapper">
        <main className="main-content downloads-library-main">
          <section className="downloads-library-header">
            <div className="downloads-library-header-copy">
              <p className="downloads-library-kicker">Library</p>
              <h1>My Downloads</h1>
            </div>
          </section>

          <section className="downloads-library-toolbar">
            <div className="downloads-library-tabs" role="tablist" aria-label="Download types">
              {DOWNLOAD_TABS.map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  className={`downloads-library-tab ${activeType === tab.value ? 'active' : ''}`}
                  onClick={() => setType(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="downloads-library-count">
              {count} items
            </span>
          </section>

          {loading ? (
            <div className="downloads-library-panel empty-state">
              <p>Loading downloads...</p>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="downloads-library-panel empty-state">
              <p>{error}</p>
            </div>
          ) : null}

          {!loading && !error ? (
            <section className="downloads-library-panel">
              {activeType === 'sample' ? (
                items.length ? (
                  <div className="sample-grid samples-grid" id="samples-grid">
                    {items.map(sample => {
                      const sampleAuthor = sample.author?.trim() || 'Unknown';
                      const sampleAuthorHref = getProfileHref(sample.author);

                      return (
                        <div
                          className="sample-card sample-square sample-item"
                          id={`card-${sample.id}`}
                          data-card-id={sample.id}
                          data-url={sample.play_url || sample.audio_file}
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
                                <Link to={sampleAuthorHref} className="sample-author-link" title={`View ${sampleAuthor} profile`}>
                                  {sampleAuthor}
                                </Link>
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
                              data-url={sample.play_url || sample.audio_file}
                              title="Play"
                              type="button"
                            >
                              <svg className="play-icon" viewBox="0 0 24 24" fill="white">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </button>

                            <a
                              href={sample.download_url}
                              className="download-btn-bottom"
                              title="Download sample"
                            >
                              <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                              </svg>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No downloaded samples yet.</p>
                  </div>
                )
              ) : null}

              {activeType === 'loop' ? (
                items.length ? (
                  <div className="sample-grid">
                    {items.map(loop => {
                      const loopAuthor = loop.author?.trim() || 'Unknown';
                      const loopAuthorHref = getProfileHref(loop.author);
                      const keywordTags = extractKeywordTags(loop.keywords, 5);

                      return (
                        <div
                          className="sample-card"
                          id={`card-${loop.id}`}
                          data-card-id={loop.id}
                          data-url={loop.play_url || loop.audio_file}
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
                                    <Link to={loopAuthorHref} className="author-link">{loopAuthor}</Link>
                                  ) : (
                                    <span className="author-link">{loopAuthor}</span>
                                  )}
                                </div>
                              </div>
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
                              <a
                                href={loop.download_url}
                                className="download-btn-rect"
                                title="Download loop"
                              >
                                <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
                                  <line x1="4" y1="20" x2="20" y2="20" />
                                </svg>
                                Download
                              </a>
                              <button className="play-btn-rect" data-card-id={loop.id} data-url={loop.play_url || loop.audio_file} type="button">
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
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No downloaded loops yet.</p>
                  </div>
                )
              ) : null}

              {activeType === 'drumkit' ? (
                items.length ? (
                  <div className="drumkits-grid">
                    {items.map(kit => {
                      const kitTitle = (kit.title || 'Drum Kit').trim() || 'Drum Kit';
                      const kitHref = kit.slug ? `/drum-kits/${kit.slug}` : '/drum-kits';

                      return (
                        <article className="drumkit-card" key={kit.id}>
                          <Link to={kitHref} className="drumkit-card-link">
                            <div className="drumkit-cover">
                              {kit.cover_url ? (
                                <img src={kit.cover_url} alt={kitTitle} loading="lazy" />
                              ) : (
                                <span className="drumkit-cover-fallback">
                                  {kitTitle.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="drumkit-card-body">
                              <div className="drumkit-title-row">
                                <h3>{kitTitle}</h3>
                                <span className="drumkit-genre">{kit.genre_display || kit.genre || 'Other'}</span>
                              </div>
                              <p className="drumkit-meta">
                                {kit.author ? `by ${kit.author}` : 'Unknown author'}
                              </p>
                            </div>
                          </Link>
                          <a
                            href={kit.download_url}
                            className="drumkit-download-btn"
                            title="Download drum kit"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 3v14" />
                              <path d="M7 12l5 5 5-5" />
                              <path d="M5 19h14" />
                            </svg>
                            Download
                          </a>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No downloaded drum kits yet.</p>
                  </div>
                )
              ) : null}

              {count > 12 ? (
                <Pagination count={count} isLoading={loading} />
              ) : null}
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
