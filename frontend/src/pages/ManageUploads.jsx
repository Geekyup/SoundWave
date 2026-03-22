import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { logout } from '../api/auth.js';
import { getAccessToken } from '../api/client.js';
import { listDrumKits, deleteDrumKit } from '../api/drumKits.js';
import { deleteLoop, listLoops } from '../api/loops.js';
import { getMe } from '../api/me.js';
import { deleteSample, listSamples } from '../api/samples.js';
import Pagination from '../components/Pagination.jsx';
import SiteHeader from '../components/SiteHeader.jsx';

const MAX_PROFILE_FETCH_PAGES = 30;
const MANAGE_PAGE_SIZE = 12;
const MANAGE_TABS = [
  { value: 'loop', label: 'Loops' },
  { value: 'sample', label: 'Samples' },
  { value: 'drumkit', label: 'Drum Kits' },
];

async function fetchAllAuthorItems(listFn, username, baseParams = {}) {
  if (!username) return [];

  const all = [];
  let page = 1;

  for (let index = 0; index < MAX_PROFILE_FETCH_PAGES; index += 1) {
    const data = await listFn({
      ...baseParams,
      author: username,
      page,
    });
    const chunk = Array.isArray(data?.results) ? data.results : [];
    all.push(...chunk);
    if (!data?.next || chunk.length === 0) break;
    page += 1;
  }

  return all;
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString();
}

export default function ManageUploads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loops, setLoops] = useState([]);
  const [samples, setSamples] = useState([]);
  const [drumKits, setDrumKits] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('');
  const [deletingKey, setDeletingKey] = useState('');

  const token = getAccessToken();
  const isAuth = Boolean(token);
  const tabParam = (searchParams.get('tab') || 'loop').toLowerCase();
  const activeTab = MANAGE_TABS.some(item => item.value === tabParam) ? tabParam : 'loop';
  const page = Number(searchParams.get('page') || '1');

  useEffect(() => {
    if (!isAuth) {
      setMe(null);
      setMeLoading(false);
      return;
    }

    let active = true;
    setMeLoading(true);

    getMe()
      .then(profile => {
        if (!active) return;
        setMe(profile);
      })
      .catch(() => {
        if (!active) return;
        logout();
        setMe(null);
      })
      .finally(() => {
        if (!active) return;
        setMeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuth]);

  useEffect(() => {
    const username = (me?.username || '').trim();
    if (!username) {
      setLoops([]);
      setSamples([]);
      setDrumKits([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    const listOwnedDrumKits = params => listDrumKits(params, { skipAuth: false });

    Promise.all([
      fetchAllAuthorItems(listLoops, username, { ordering: '-uploaded_at', include_waveform: '1' }),
      fetchAllAuthorItems(listSamples, username, { ordering: '-uploaded_at', include_waveform: '1' }),
      fetchAllAuthorItems(listOwnedDrumKits, username, { ordering: '-created_at' }),
    ])
      .then(([authorLoops, authorSamples, authorDrumKits]) => {
        if (!active) return;
        setLoops(authorLoops);
        setSamples(authorSamples);
        setDrumKits(authorDrumKits);
      })
      .catch(() => {
        if (!active) return;
        setLoops([]);
        setSamples([]);
        setDrumKits([]);
        setError('Failed to load your uploads.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [me]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => {
      setNotice('');
      setNoticeType('');
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (activeTab === 'drumkit') return;
    if (window.__swInit) {
      window.__swInit();
    }
  }, [loops, samples, activeTab]);

  const setTab = tab => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const activeItems = useMemo(() => {
    if (activeTab === 'sample') return samples;
    if (activeTab === 'drumkit') return drumKits;
    return loops;
  }, [activeTab, loops, samples, drumKits]);
  const totalUploads = loops.length + samples.length + drumKits.length;
  const tabCounts = {
    loop: loops.length,
    sample: samples.length,
    drumkit: drumKits.length,
  };
  const activeTabLabel = MANAGE_TABS.find(tab => tab.value === activeTab)?.label || 'Loops';

  const offset = Math.max(0, (page - 1) * MANAGE_PAGE_SIZE);
  const pagedItems = activeItems.slice(offset, offset + MANAGE_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(activeItems.length / MANAGE_PAGE_SIZE));

  useEffect(() => {
    if (page <= totalPages) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  }, [page, totalPages, searchParams, setSearchParams]);

  const handleDeleteLoop = async loopId => {
    if (!window.confirm('Delete this loop?')) return;
    const rowKey = `loop-${loopId}`;
    setDeletingKey(rowKey);
    setNotice('');
    try {
      await deleteLoop(loopId);
      setLoops(prev => prev.filter(item => item.id !== loopId));
      setNoticeType('success');
      setNotice('Loop deleted.');
    } catch (_) {
      setNoticeType('error');
      setNotice('Failed to delete loop.');
    } finally {
      setDeletingKey('');
    }
  };

  const handleDeleteSample = async sampleId => {
    if (!window.confirm('Delete this sample?')) return;
    const rowKey = `sample-${sampleId}`;
    setDeletingKey(rowKey);
    setNotice('');
    try {
      await deleteSample(sampleId);
      setSamples(prev => prev.filter(item => item.id !== sampleId));
      setNoticeType('success');
      setNotice('Sample deleted.');
    } catch (_) {
      setNoticeType('error');
      setNotice('Failed to delete sample.');
    } finally {
      setDeletingKey('');
    }
  };

  const handleDeleteDrumKit = async slug => {
    if (!window.confirm('Delete this drum kit?')) return;
    const rowKey = `drumkit-${slug}`;
    setDeletingKey(rowKey);
    setNotice('');
    try {
      await deleteDrumKit(slug);
      setDrumKits(prev => prev.filter(item => item.slug !== slug));
      setNoticeType('success');
      setNotice('Drum kit deleted.');
    } catch (_) {
      setNoticeType('error');
      setNotice('Failed to delete drum kit.');
    } finally {
      setDeletingKey('');
    }
  };

  const renderCards = () => {
    if (activeTab === 'sample') {
      if (!samples.length) return <p className="profile-manage-empty">No samples uploaded yet.</p>;
      return (
        <div className="sample-grid samples-grid profile-manage-grid">
          {pagedItems.map(sample => (
            <div
              className="sample-card sample-square sample-item profile-manage-card"
              key={`sample-${sample.id}`}
              id={`card-${sample.id}`}
              data-card-id={sample.id}
              data-url={sample.play_url || sample.audio_file}
              data-kind="samples"
              data-waveform-peaks={sample.waveform?.peaks?.length ? JSON.stringify(sample.waveform.peaks) : ''}
              data-waveform-duration={sample.waveform?.duration || ''}
              data-type={sample.sample_type}
              data-genre={sample.genre}
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
                  <span className="sample-author-muted">{sample.author || 'Unknown'}</span>
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
                <button
                  type="button"
                  className="sample-delete-btn"
                  disabled={deletingKey === `sample-${sample.id}`}
                  onClick={() => handleDeleteSample(sample.id)}
                >
                  {deletingKey === `sample-${sample.id}` ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'drumkit') {
      if (!drumKits.length) return <p className="profile-manage-empty">No drum kits uploaded yet.</p>;
      return (
        <div className="drumkits-grid profile-manage-grid">
          {pagedItems.map(kit => (
            <article className="drumkit-card profile-drumkit-card" key={kit.slug || kit.id}>
              <Link to={kit.slug ? `/drum-kits/${kit.slug}` : '/drum-kits'} className="drumkit-card-link">
                <div className="drumkit-cover">
                  {kit.cover_url ? (
                    <img src={kit.cover_url} alt={kit.title} loading="lazy" />
                  ) : (
                    <span className="drumkit-cover-fallback">
                      {(kit.title || 'DK').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="drumkit-card-body">
                  <div className="drumkit-title-row">
                    <h3>{kit.title}</h3>
                    <span className="drumkit-genre">{kit.genre_display || kit.genre || 'Other'}</span>
                  </div>
                  <p className="drumkit-meta">
                    {kit.author ? `by ${kit.author}` : 'Unknown author'}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                className="drumkit-delete-btn"
                disabled={deletingKey === `drumkit-${kit.slug}`}
                onClick={() => handleDeleteDrumKit(kit.slug)}
              >
                {deletingKey === `drumkit-${kit.slug}` ? null : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v5" />
                    <path d="M14 11v5" />
                  </svg>
                )}
                {deletingKey === `drumkit-${kit.slug}` ? 'Deleting...' : 'Delete'}
              </button>
            </article>
          ))}
        </div>
      );
    }

    if (!loops.length) return <p className="profile-manage-empty">No loops uploaded yet.</p>;
    return (
      <div className="sample-grid profile-manage-grid">
        {pagedItems.map(loop => (
          <div
            className="sample-card"
            id={`card-${loop.id}`}
            data-card-id={loop.id}
            data-url={loop.play_url || loop.audio_file}
            data-kind="loops"
            data-waveform-peaks={loop.waveform?.peaks?.length ? JSON.stringify(loop.waveform.peaks) : ''}
            data-waveform-duration={loop.waveform?.duration || ''}
            key={`loop-${loop.id}`}
          >
            <div className="card-header">
              <div className="card-info">
                <h3 className="card-title">{loop.name}</h3>
                <div className="card-author">
                  <div className="card-author-wrapper">
                    <div className="card-author-avatar">
                      {(loop.author || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="author-link">{loop.author || 'Unknown'}</span>
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
                <button
                  type="button"
                  className="delete-btn-rect manage-delete-btn"
                  disabled={deletingKey === `loop-${loop.id}`}
                  onClick={() => handleDeleteLoop(loop.id)}
                >
                  {deletingKey === `loop-${loop.id}` ? 'Deleting...' : 'Delete'}
                </button>
                <button className="play-btn-rect" data-card-id={loop.id} data-url={loop.play_url || loop.audio_file} type="button">
                  Play
                </button>
              </div>
            </div>

            <div className="card-tags">
              <span className="tag bpm-tag">{loop.bpm} bpm</span>
              <span className="tag genre-tag">{loop.genre_display}</span>
              <span className="tag size-tag">{loop.file_size}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isAuth) {
    return (
      <div className="page-wrapper">
        <SiteHeader active="" />
        <div className="content-wrapper profile-compact-content">
          <main className="main-content profile-compact-main">
            <section className="profile-compact-card profile-auth-card">
              <p className="profile-auth-kicker">Account Required</p>
              <h1>Manage uploads after login</h1>
              <p className="profile-auth-text">Sign in to review and delete your uploaded content.</p>
              <div className="profile-auth-actions">
                <Link to="/login" className="btn btn-primary">Login</Link>
                <Link to="/register" className="btn btn-secondary">Register</Link>
              </div>
            </section>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper manage-uploads-page">
      <SiteHeader
        active=""
        showCatalogNav={false}
        searchContent={<input type="text" readOnly value="Manage uploads" aria-label="Manage uploads" />}
      />

      <div className="content-wrapper manage-uploads-content">
        <main className="main-content manage-uploads-main">
          <header className="manage-uploads-header">
            <div className="manage-uploads-header-copy">
              <p className="manage-uploads-kicker">Creator workspace</p>
              <h1>Manage Uploads</h1>
            </div>
          </header>

          <section className="manage-uploads-metrics" aria-label="Upload metrics">
            <article className="manage-uploads-metric">
              <span className="manage-uploads-metric-label">Total</span>
              <strong>{totalUploads}</strong>
            </article>
            <article className="manage-uploads-metric">
              <span className="manage-uploads-metric-label">Loops</span>
              <strong>{tabCounts.loop}</strong>
            </article>
            <article className="manage-uploads-metric">
              <span className="manage-uploads-metric-label">Samples</span>
              <strong>{tabCounts.sample}</strong>
            </article>
            <article className="manage-uploads-metric">
              <span className="manage-uploads-metric-label">Drum kits</span>
              <strong>{tabCounts.drumkit}</strong>
            </article>
          </section>

          {loading || meLoading ? (
            <div className="manage-uploads-panel empty-state">
              <p>Loading uploads...</p>
            </div>
          ) : null}

          {!loading && !meLoading && error ? (
            <div className="manage-uploads-panel empty-state">
              <p>{error}</p>
            </div>
          ) : null}

          {!loading && !meLoading && !error ? (
            <section className="manage-uploads-panel">
              <div className="manage-uploads-toolbar">
                <div className="manage-uploads-tabs" role="tablist" aria-label="Manage uploads">
                  {MANAGE_TABS.map(tab => (
                    <button
                      key={tab.value}
                      type="button"
                      className={`manage-uploads-tab ${activeTab === tab.value ? 'active' : ''}`}
                      onClick={() => setTab(tab.value)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="manage-uploads-toolbar-meta">
                  <span>{activeItems.length} items</span>
                  <strong>{activeTabLabel}</strong>
                </div>
              </div>

              {notice ? (
                <div className={`profile-manage-notice ${noticeType === 'error' ? 'error' : 'success'}`}>
                  {notice}
                </div>
              ) : null}

              <div className="manage-uploads-panel-body">
                {renderCards()}
                {activeItems.length > MANAGE_PAGE_SIZE ? (
                  <Pagination count={activeItems.length} isLoading={loading} />
                ) : null}
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
