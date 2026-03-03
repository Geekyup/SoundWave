import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { logout } from '../api/auth.js';
import { getAccessToken } from '../api/client.js';
import { deleteDrumKit, listDrumKits } from '../api/drumKits.js';
import { deleteLoop, listLoops } from '../api/loops.js';
import { getMe } from '../api/me.js';
import { deleteSample, listSamples } from '../api/samples.js';

const MAX_PROFILE_FETCH_PAGES = 30;

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString();
}

function getInitial(username) {
  const raw = (username || '').trim();
  return raw ? raw.charAt(0).toUpperCase() : 'U';
}

function normalizeAuthor(value) {
  return (value || '').trim().toLowerCase();
}

function getItemTimestamp(item) {
  return item?.uploaded_at || item?.created_at || '';
}

function sumDownloads(items) {
  return items.reduce((total, item) => total + (item.downloads || 0), 0);
}

function getMedian(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
  }
  return sorted[middle];
}

function getTopGenre(items) {
  const map = new Map();
  items.forEach(item => {
    const genre = (item.genre_display || '').trim();
    if (!genre) return;
    map.set(genre, (map.get(genre) || 0) + 1);
  });
  let bestGenre = '';
  let bestCount = 0;
  map.forEach((count, genre) => {
    if (count > bestCount) {
      bestGenre = genre;
      bestCount = count;
    }
  });
  return bestGenre || '-';
}

function getLatestDate(items) {
  let latest = '';
  items.forEach(item => {
    const raw = getItemTimestamp(item);
    if (!raw) return;
    if (!latest || new Date(raw) > new Date(latest)) {
      latest = raw;
    }
  });
  return latest;
}

function countRecentUploads(items, days = 30) {
  const now = Date.now();
  const threshold = now - (days * 24 * 60 * 60 * 1000);
  return items.filter(item => {
    const date = new Date(getItemTimestamp(item)).getTime();
    return Number.isFinite(date) && date >= threshold;
  }).length;
}

async function fetchAllAuthorItems(listFn, username, baseParams = {}) {
  const normalized = normalizeAuthor(username);
  if (!normalized) return [];

  const all = [];
  let page = 1;

  for (let index = 0; index < MAX_PROFILE_FETCH_PAGES; index += 1) {
    const data = await listFn({
      ...baseParams,
      author: username,
      page,
    });
    const chunk = Array.isArray(data?.results) ? data.results : [];
    all.push(...chunk.filter(item => normalizeAuthor(item.author) === normalized));
    if (!data?.next || chunk.length === 0) break;
    page += 1;
  }

  return all;
}

function StatCard({ icon, label, value }) {
  return (
    <article className="profile-compact-card profile-stat-card">
      <div className="profile-stat-head">
        <span className="profile-stat-icon" aria-hidden="true">
          {icon}
        </span>
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
    </article>
  );
}

export default function Profile() {
  const { username } = useParams();
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loops, setLoops] = useState([]);
  const [samples, setSamples] = useState([]);
  const [drumKits, setDrumKits] = useState([]);
  const [activeManageTab, setActiveManageTab] = useState('sample');
  const [manageNotice, setManageNotice] = useState('');
  const [manageNoticeType, setManageNoticeType] = useState('');
  const [deletingKey, setDeletingKey] = useState('');

  const token = getAccessToken();
  const isAuth = Boolean(token);
  const requestedUsername = (username || '').trim();

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

  const profileUsername = useMemo(() => {
    if (requestedUsername) return requestedUsername;
    return me?.username || '';
  }, [requestedUsername, me]);

  const isOwnProfile = Boolean(
    me?.username && profileUsername && me.username.toLowerCase() === profileUsername.toLowerCase(),
  );

  useEffect(() => {
    if (!profileUsername) {
      setLoops([]);
      setSamples([]);
      setDrumKits([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    const fetchData = async () => {
      const listOwnedDrumKits = params => listDrumKits(params, { skipAuth: false });
      const [authorLoops, authorSamples, authorDrumKits] = await Promise.all([
        fetchAllAuthorItems(listLoops, profileUsername, { ordering: '-uploaded_at', include_waveform: '0' }),
        fetchAllAuthorItems(listSamples, profileUsername, { ordering: '-uploaded_at', include_waveform: '0' }),
        fetchAllAuthorItems(listOwnedDrumKits, profileUsername, { ordering: '-created_at' }),
      ]);

      if (!active) return;
      setLoops(authorLoops);
      setSamples(authorSamples);
      setDrumKits(authorDrumKits);
    };

    fetchData()
      .catch(() => {
        if (!active) return;
        setLoops([]);
        setSamples([]);
        setDrumKits([]);
        setError('Failed to load profile data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profileUsername]);

  if (!isAuth && !requestedUsername) {
    return (
      <main className="profile-compact-layout profile-auth-guard">
        <div className="profile-compact-card profile-auth-card">
          <p className="profile-auth-kicker">Account Required</p>
          <h1>Profile is available after login</h1>
          <p className="profile-auth-text">Please sign in to view and manage your profile.</p>
          <div className="profile-auth-actions">
            <a href="/login" className="btn btn-primary">Login</a>
            <a href="/register" className="btn btn-secondary">Register</a>
          </div>
        </div>
      </main>
    );
  }

  const displayUsername = profileUsername || 'User';
  const profileBio = isOwnProfile ? (me?.bio || '').trim() : '';
  const isPageLoading = loading || (!requestedUsername && isAuth && meLoading);
  const totalLoops = loops.length;
  const totalSamples = samples.length;
  const totalDrumKits = drumKits.length;
  const totalUploads = totalLoops + totalSamples + totalDrumKits;
  const hasUploads = totalUploads > 0;
  const allItems = [...loops, ...samples, ...drumKits];
  const totalDownloads = sumDownloads(loops) + sumDownloads(samples) + sumDownloads(drumKits);
  const averageDownloads = totalUploads ? (totalDownloads / totalUploads).toFixed(1) : '0';
  const uploadsLast30 = countRecentUploads(allItems, 30);
  const latestUploadAt = getLatestDate(allItems);
  const topDownloads = allItems.reduce((acc, item) => Math.max(acc, item.downloads || 0), 0);
  const topGenre = getTopGenre(allItems);
  const bpmValues = loops
    .map(item => Number(item.bpm))
    .filter(value => Number.isFinite(value) && value > 0);
  const medianLoopBpm = getMedian(bpmValues);
  const topLoops = useMemo(
    () => [...loops].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 5),
    [loops],
  );
  const topSamples = useMemo(
    () => [...samples].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 5),
    [samples],
  );

  const handleDeleteLoop = async loopId => {
    if (!isOwnProfile) return;
    if (!window.confirm('Delete this loop?')) return;
    const rowKey = `loop-${loopId}`;
    setDeletingKey(rowKey);
    setManageNotice('');
    try {
      await deleteLoop(loopId);
      setLoops(prev => prev.filter(item => item.id !== loopId));
      setManageNoticeType('success');
      setManageNotice('Loop deleted.');
    } catch (_) {
      setManageNoticeType('error');
      setManageNotice('Failed to delete loop.');
    } finally {
      setDeletingKey('');
    }
  };

  const handleDeleteSample = async sampleId => {
    if (!isOwnProfile) return;
    if (!window.confirm('Delete this sample?')) return;
    const rowKey = `sample-${sampleId}`;
    setDeletingKey(rowKey);
    setManageNotice('');
    try {
      await deleteSample(sampleId);
      setSamples(prev => prev.filter(item => item.id !== sampleId));
      setManageNoticeType('success');
      setManageNotice('Sample deleted.');
    } catch (_) {
      setManageNoticeType('error');
      setManageNotice('Failed to delete sample.');
    } finally {
      setDeletingKey('');
    }
  };

  const handleDeleteDrumKit = async slug => {
    if (!isOwnProfile) return;
    if (!window.confirm('Delete this drum kit?')) return;
    const rowKey = `drumkit-${slug}`;
    setDeletingKey(rowKey);
    setManageNotice('');
    try {
      await deleteDrumKit(slug);
      setDrumKits(prev => prev.filter(item => item.slug !== slug));
      setManageNoticeType('success');
      setManageNotice('Drum kit deleted.');
    } catch (_) {
      setManageNoticeType('error');
      setManageNotice('Failed to delete drum kit.');
    } finally {
      setDeletingKey('');
    }
  };

  const renderManageContent = () => {
    if (activeManageTab === 'sample') {
      if (!samples.length) return <p className="profile-manage-empty">No samples uploaded yet.</p>;
      return (
        <ul className="profile-manage-list">
          {samples.map(sample => (
            <li key={`sample-${sample.id}`} className="profile-manage-row">
              <div className="profile-manage-meta">
                <strong>{sample.name}</strong>
                <span>{formatDate(sample.uploaded_at)} • {sample.downloads || 0} downloads</span>
              </div>
              <button
                type="button"
                className="profile-manage-delete-btn"
                disabled={deletingKey === `sample-${sample.id}`}
                onClick={() => handleDeleteSample(sample.id)}
              >
                {deletingKey === `sample-${sample.id}` ? 'Deleting...' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      );
    }

    if (activeManageTab === 'loop') {
      if (!loops.length) return <p className="profile-manage-empty">No loops uploaded yet.</p>;
      return (
        <ul className="profile-manage-list">
          {loops.map(loop => (
            <li key={`loop-${loop.id}`} className="profile-manage-row">
              <div className="profile-manage-meta">
                <strong>{loop.name}</strong>
                <span>{formatDate(loop.uploaded_at)} • {loop.downloads || 0} downloads</span>
              </div>
              <button
                type="button"
                className="profile-manage-delete-btn"
                disabled={deletingKey === `loop-${loop.id}`}
                onClick={() => handleDeleteLoop(loop.id)}
              >
                {deletingKey === `loop-${loop.id}` ? 'Deleting...' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      );
    }

    if (!drumKits.length) return <p className="profile-manage-empty">No drum kits uploaded yet.</p>;
    return (
      <ul className="profile-manage-list">
        {drumKits.map(kit => (
          <li key={`drumkit-${kit.slug}`} className="profile-manage-row">
            <div className="profile-manage-meta">
              <strong>{kit.title}</strong>
              <span>{formatDate(kit.created_at)} • {kit.files_count || 0} files</span>
            </div>
            <button
              type="button"
              className="profile-manage-delete-btn"
              disabled={deletingKey === `drumkit-${kit.slug}`}
              onClick={() => handleDeleteDrumKit(kit.slug)}
            >
              {deletingKey === `drumkit-${kit.slug}` ? 'Deleting...' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="page-wrapper profile-page">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <a href="/">SoundWave</a>
          </div>
        </div>
      </header>

      <div className="content-wrapper profile-compact-content">
        <main className="main-content profile-compact-main">
          {isPageLoading ? (
            <div className="profile-compact-card empty-state">
              <p>Loading profile...</p>
            </div>
          ) : null}

          {!isPageLoading && error ? (
            <div className="profile-compact-card empty-state">
              <p>{error}</p>
              <a href="/" className="btn btn-secondary">Back to Home</a>
            </div>
          ) : null}

          {!isPageLoading && !error ? (
            <>
              <section className={`profile-compact-card profile-summary ${isOwnProfile ? 'is-own' : ''}`}>
                <div className={`profile-summary-main ${isOwnProfile ? 'has-about' : ''}`}>
                  <div className="profile-summary-avatar">
                    {isOwnProfile && me?.avatar_url ? (
                      <img src={me.avatar_url} alt={`${displayUsername} avatar`} />
                    ) : (
                      <span>{getInitial(displayUsername)}</span>
                    )}
                  </div>
                  <div className="profile-summary-meta">
                    <h1>{displayUsername}</h1>
                    <p>{isOwnProfile ? 'Personal dashboard' : 'Public profile statistics'}</p>
                    <span>Last upload: {formatDate(latestUploadAt)}</span>
                    <div className="profile-summary-badges">
                      <span>{totalUploads} uploads</span>
                      <span>{totalDownloads} downloads</span>
                    </div>
                  </div>
                  {isOwnProfile ? (
                    <div className="profile-summary-about">
                      <p className="profile-summary-about-label">Description</p>
                      <p className={`profile-summary-about-text ${profileBio ? '' : 'is-empty'}`}>
                        {profileBio || 'No description yet. Add it in Edit profile.'}
                      </p>
                    </div>
                  ) : null}
                </div>
                {isOwnProfile ? (
                  <div className="profile-summary-side">
                    <a href="/profile/edit" className="profile-summary-edit-btn">Edit profile</a>
                  </div>
                ) : null}
              </section>

              <div className="profile-section-title">
                <h2>Key Metrics</h2>
              </div>
              <section className="profile-stats-grid">
                <StatCard
                  label="Total uploads"
                  value={totalUploads}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M12 4v12"></path>
                      <path d="M8 8l4-4 4 4"></path>
                      <path d="M4 20h16"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Total downloads"
                  value={totalDownloads}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M12 4v12"></path>
                      <path d="M8 12l4 4 4-4"></path>
                      <path d="M4 20h16"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Avg downloads / upload"
                  value={averageDownloads}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M4 18l5-5 4 3 7-8"></path>
                      <path d="M20 8v4h-4"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Uploads in 30 days"
                  value={uploadsLast30}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                      <path d="M8 3v4M16 3v4M3 10h18"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Loops"
                  value={totalLoops}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <circle cx="6" cy="18" r="2.5"></circle>
                      <circle cx="18" cy="16" r="2.5"></circle>
                      <path d="M8.5 18V7l12-2v11"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Samples"
                  value={totalSamples}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M5 12h2l2-4 4 8 2-4h4"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Drum kits"
                  value={totalDrumKits}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                      <path d="M3 9h18M8 4v16"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Top downloads"
                  value={topDownloads}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M12 17l-5 3 1.5-5.5L4 10.5h5.6L12 5l2.4 5.5H20l-4.5 4 1.5 5.5z"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Main genre"
                  value={topGenre}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M4 7h16M4 12h10M4 17h13"></path>
                    </svg>
                  )}
                />
                <StatCard
                  label="Median loop BPM"
                  value={medianLoopBpm ?? '-'}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M3 12h3l2-5 4 10 3-7 2 4h4"></path>
                    </svg>
                  )}
                />
              </section>

              {!hasUploads ? (
                <section className="profile-compact-card profile-empty-upload">
                  <h2>Profile is empty</h2>
                  <p>
                    {isOwnProfile
                      ? 'Upload your first loop, sample or drum kit to see analytics here.'
                      : 'This user has no public uploads yet.'}
                  </p>
                  {isOwnProfile ? (
                    <a href="/upload" className="btn btn-primary">Upload track</a>
                  ) : null}
                </section>
              ) : (
                <>
                  <div className="profile-section-title">
                    <h2>Top Content</h2>
                  </div>
                  <section className="profile-top-grid">
                    <article className="profile-compact-card profile-top-card">
                      <h2>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                          <circle cx="6" cy="18" r="2.5"></circle>
                          <circle cx="18" cy="16" r="2.5"></circle>
                          <path d="M8.5 18V7l12-2v11"></path>
                        </svg>
                        Top Loops
                      </h2>
                      {topLoops.length ? (
                        <ul>
                          {topLoops.map(loop => (
                            <li key={loop.id}>
                              <span>{loop.name}</span>
                              <strong>{loop.downloads}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No loop stats yet.</p>
                      )}
                    </article>

                    <article className="profile-compact-card profile-top-card">
                      <h2>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                          <path d="M4 7h16M4 12h10M4 17h13"></path>
                        </svg>
                        Top Samples
                      </h2>
                      {topSamples.length ? (
                        <ul>
                          {topSamples.map(sample => (
                            <li key={sample.id}>
                              <span>{sample.name}</span>
                              <strong>{sample.downloads}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No sample stats yet.</p>
                      )}
                    </article>
                  </section>
                </>
              )}

              {isOwnProfile ? (
                <section className="profile-compact-card profile-manage-panel">
                  <div className="profile-manage-head">
                    <h2>Manage Uploads</h2>
                    <p>Delete your content from profile.</p>
                  </div>
                  <div className="profile-manage-tabs" role="tablist" aria-label="My uploads">
                    <button
                      type="button"
                      className={`profile-manage-tab ${activeManageTab === 'sample' ? 'active' : ''}`}
                      onClick={() => setActiveManageTab('sample')}
                    >
                      My Sample
                    </button>
                    <button
                      type="button"
                      className={`profile-manage-tab ${activeManageTab === 'loop' ? 'active' : ''}`}
                      onClick={() => setActiveManageTab('loop')}
                    >
                      My Loop
                    </button>
                    <button
                      type="button"
                      className={`profile-manage-tab ${activeManageTab === 'drumkit' ? 'active' : ''}`}
                      onClick={() => setActiveManageTab('drumkit')}
                    >
                      My Drum Kit
                    </button>
                  </div>

                  {manageNotice ? (
                    <div className={`profile-manage-notice ${manageNoticeType === 'error' ? 'error' : 'success'}`}>
                      {manageNotice}
                    </div>
                  ) : null}

                  {renderManageContent()}
                </section>
              ) : null}

              <section className="profile-bottom-actions">
                <a href="/" className="btn btn-secondary profile-action-btn">Home</a>
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="btn btn-secondary profile-action-btn"
                    onClick={() => {
                      logout();
                      window.location.href = '/';
                    }}
                  >
                    Logout
                  </button>
                ) : null}
              </section>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
