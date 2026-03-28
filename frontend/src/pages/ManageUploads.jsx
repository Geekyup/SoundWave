import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getAccessToken } from '../api/client.js';
import { deleteDrumKit } from '../api/drumKits.js';
import { deleteLoop } from '../api/loops.js';
import { listMyUploads } from '../api/myUploads.js';
import { deleteSample } from '../api/samples.js';
import CatalogPageLayout from '../components/CatalogPageLayout.jsx';
import DrumKitCard from '../components/DrumKitCard.jsx';
import { DrumKitSkeletonGrid, LoopCardSkeletonList, SampleSquareSkeletonGrid } from '../components/LibrarySkeletons.jsx';
import LoopCard from '../components/LoopCard.jsx';
import { scheduleMediaPlayerInit, stopAllMediaPlayers } from '../media-player/runtime.js';
import Pagination from '../components/Pagination.jsx';
import SampleCard from '../components/SampleCard.jsx';
import { formatDate } from '../utils/date.js';
import { patchSearchParams } from '../utils/searchParams.js';

const MANAGE_PAGE_SIZE = 12;
const MANAGE_TABS = [
  { value: 'loop', label: 'Loops' },
  { value: 'sample', label: 'Samples' },
  { value: 'drumkit', label: 'Drum Kits' },
];
const EMPTY_COUNTS = {
  loop: 0,
  sample: 0,
  drumkit: 0,
};

export default function ManageUploads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
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
      setItems([]);
      setCount(0);
      setCounts(EMPTY_COUNTS);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    listMyUploads({
      type: activeTab,
      page,
      ...(activeTab === 'sample' ? { include_waveform: '1' } : {}),
    })
      .then(data => {
        if (!active) return;
        setItems(data.results || []);
        setCount(data.count || 0);
        setCounts(data.counts || EMPTY_COUNTS);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
        setCount(0);
        setCounts(EMPTY_COUNTS);
        setError('Failed to load your uploads.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab, isAuth, page]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => {
      setNotice('');
      setNoticeType('');
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (activeTab === 'drumkit' || !items.length) {
      stopAllMediaPlayers({ destroy: true });
      return;
    }

    scheduleMediaPlayerInit();
  }, [activeTab, items]);

  const totalUploads = counts.loop + counts.sample + counts.drumkit;
  const activeTabLabel = MANAGE_TABS.find(tab => tab.value === activeTab)?.label || 'Loops';
  const totalPages = Math.max(1, Math.ceil(count / MANAGE_PAGE_SIZE));

  useEffect(() => {
    if (page <= totalPages) return;
    setSearchParams(
      patchSearchParams(searchParams, { page: '1' }),
      { replace: true },
    );
  }, [page, totalPages, searchParams, setSearchParams]);

  const setTab = tab => {
    setSearchParams(
      patchSearchParams(searchParams, {
        tab,
        page: '1',
      }),
      { replace: true },
    );
  };

  const handleDeleteItem = async ({
    confirmText,
    rowKey,
    request,
    predicate,
    countKey,
    successText,
    errorText,
  }) => {
    if (!window.confirm(confirmText)) return;

    setDeletingKey(rowKey);
    setNotice('');

    try {
      await request();
      setItems(prev => prev.filter(predicate));
      setCount(prev => Math.max(0, prev - 1));
      setCounts(prev => ({
        ...prev,
        [countKey]: Math.max(0, prev[countKey] - 1),
      }));
      setNoticeType('success');
      setNotice(successText);
    } catch (_) {
      setNoticeType('error');
      setNotice(errorText);
    } finally {
      setDeletingKey('');
    }
  };

  const handleDeleteLoop = loopId => handleDeleteItem({
    confirmText: 'Delete this loop?',
    rowKey: `loop-${loopId}`,
    request: () => deleteLoop(loopId),
    predicate: item => item.id !== loopId,
    countKey: 'loop',
    successText: 'Loop deleted.',
    errorText: 'Failed to delete loop.',
  });

  const handleDeleteSample = sampleId => handleDeleteItem({
    confirmText: 'Delete this sample?',
    rowKey: `sample-${sampleId}`,
    request: () => deleteSample(sampleId),
    predicate: item => item.id !== sampleId,
    countKey: 'sample',
    successText: 'Sample deleted.',
    errorText: 'Failed to delete sample.',
  });

  const handleDeleteDrumKit = slug => handleDeleteItem({
    confirmText: 'Delete this drum kit?',
    rowKey: `drumkit-${slug}`,
    request: () => deleteDrumKit(slug),
    predicate: item => item.slug !== slug,
    countKey: 'drumkit',
    successText: 'Drum kit deleted.',
    errorText: 'Failed to delete drum kit.',
  });

  const renderLoadingContent = () => {
    if (activeTab === 'sample') {
      return <div className="sample-grid samples-grid manage-uploads-grid"><SampleSquareSkeletonGrid /></div>;
    }

    if (activeTab === 'drumkit') {
      return <div className="drumkits-grid manage-uploads-grid"><DrumKitSkeletonGrid /></div>;
    }

    return <div className="sample-grid manage-uploads-grid"><LoopCardSkeletonList /></div>;
  };

  const renderCards = () => {
    if (activeTab === 'sample') {
      if (!items.length) return <p className="manage-uploads-empty">No samples uploaded yet.</p>;

      return (
        <div className="sample-grid samples-grid manage-uploads-grid">
          {items.map(sample => (
            <SampleCard
              key={`sample-${sample.id}`}
              className="manage-uploads-card"
              sample={sample}
              secondaryAction={(
                <button
                  type="button"
                  className="sample-delete-btn"
                  disabled={deletingKey === `sample-${sample.id}`}
                  onClick={() => handleDeleteSample(sample.id)}
                >
                  {deletingKey === `sample-${sample.id}` ? 'Deleting...' : 'Delete'}
                </button>
              )}
            />
          ))}
        </div>
      );
    }

    if (activeTab === 'drumkit') {
      if (!items.length) return <p className="manage-uploads-empty">No drum kits uploaded yet.</p>;

      return (
        <div className="drumkits-grid manage-uploads-grid">
          {items.map(kit => (
            <DrumKitCard
              key={kit.slug || kit.id}
              kit={kit}
              className="manage-uploads-drumkit-card"
              action={(
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
              )}
            />
          ))}
        </div>
      );
    }

    if (!items.length) return <p className="manage-uploads-empty">No loops uploaded yet.</p>;

    return (
      <div className="sample-grid manage-uploads-grid">
        {items.map(loop => (
          <LoopCard
            key={`loop-${loop.id}`}
            loop={loop}
            metaContent={<span className="upload-date">{formatDate(loop.uploaded_at)}</span>}
            primaryAction={(
              <button
                type="button"
                className="delete-btn-rect manage-delete-btn"
                disabled={deletingKey === `loop-${loop.id}`}
                onClick={() => handleDeleteLoop(loop.id)}
              >
                {deletingKey === `loop-${loop.id}` ? 'Deleting...' : 'Delete'}
              </button>
            )}
          />
        ))}
      </div>
    );
  };

  if (!isAuth) {
    return (
      <CatalogPageLayout
        active=""
        showCatalogNav={false}
        showSearch={false}
        showUploadLink={false}
        showFooter={false}
        contentClassName="profile-compact-content"
        mainClassName="profile-compact-main"
      >
        <section className="profile-compact-card profile-auth-card">
          <p className="profile-auth-kicker">Account Required</p>
          <h1>Manage uploads after login</h1>
          <p className="profile-auth-text">Sign in to review and delete your uploaded content.</p>
          <div className="profile-auth-actions">
            <Link to="/login" className="btn btn-primary">Login</Link>
            <Link to="/register" className="btn btn-secondary">Register</Link>
          </div>
        </section>
      </CatalogPageLayout>
    );
  }

  return (
    <CatalogPageLayout
      active=""
      showCatalogNav={false}
      showSearch={false}
      showUploadLink={false}
      showFooter={false}
      wrapperClassName="manage-uploads-page"
      contentClassName="manage-uploads-content"
      mainClassName="manage-uploads-main"
    >
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
          <strong>{counts.loop}</strong>
        </article>
        <article className="manage-uploads-metric">
          <span className="manage-uploads-metric-label">Samples</span>
          <strong>{counts.sample}</strong>
        </article>
        <article className="manage-uploads-metric">
          <span className="manage-uploads-metric-label">Drum kits</span>
          <strong>{counts.drumkit}</strong>
        </article>
      </section>

      {loading ? (
        <section className="manage-uploads-panel">
          {renderLoadingContent()}
          <div className="pagination-slot" aria-hidden="true">
            <div className="pagination-skeleton"></div>
          </div>
        </section>
      ) : null}

      {!loading && error ? (
        <div className="manage-uploads-panel empty-state">
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && !error ? (
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
              <span>{count} items</span>
              <strong>{activeTabLabel}</strong>
            </div>
          </div>

          {notice ? (
            <div className={`manage-uploads-notice ${noticeType === 'error' ? 'error' : 'success'}`}>
              {notice}
            </div>
          ) : null}

          <div className="manage-uploads-panel-body">
            {renderCards()}
            {count > MANAGE_PAGE_SIZE ? (
              <Pagination count={count} isLoading={loading} />
            ) : null}
          </div>
        </section>
      ) : null}
    </CatalogPageLayout>
  );
}
