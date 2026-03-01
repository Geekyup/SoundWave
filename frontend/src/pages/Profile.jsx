import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getMe } from '../api/me.js';
import { listLoops } from '../api/loops.js';
import { listSamples } from '../api/samples.js';
import { getAccessToken } from '../api/client.js';
import { logout } from '../api/auth.js';

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
    const raw = item.uploaded_at || '';
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
    const date = new Date(item.uploaded_at || '').getTime();
    return Number.isFinite(date) && date >= threshold;
  }).length;
}

async function fetchAllAuthorItems(listFn, username) {
  const normalized = normalizeAuthor(username);
  if (!normalized) return [];

  const all = [];
  let page = 1;

  for (let index = 0; index < MAX_PROFILE_FETCH_PAGES; index += 1) {
    const data = await listFn({
      author: username,
      ordering: '-uploaded_at',
      include_waveform: '0',
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
  const [topLoops, setTopLoops] = useState([]);
  const [topSamples, setTopSamples] = useState([]);

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
      setTopLoops([]);
      setTopSamples([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');

    const fetchData = async () => {
      const [authorLoops, authorSamples] = await Promise.all([
        fetchAllAuthorItems(listLoops, profileUsername),
        fetchAllAuthorItems(listSamples, profileUsername),
      ]);

      if (!active) return;
      setLoops(authorLoops);
      setSamples(authorSamples);
      setTopLoops(
        [...authorLoops]
          .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
          .slice(0, 5),
      );
      setTopSamples(
        [...authorSamples]
          .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
          .slice(0, 5),
      );
    };

    fetchData()
      .catch(() => {
        if (!active) return;
        setLoops([]);
        setSamples([]);
        setTopLoops([]);
        setTopSamples([]);
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
      <main className="profile-compact-layout">
        <div className="profile-compact-card empty-state">
          <p>Please log in to view your profile.</p>
          <a href="/login" className="btn btn-primary">Login</a>
        </div>
      </main>
    );
  }

  const displayUsername = profileUsername || 'User';
  const isPageLoading = loading || (!requestedUsername && isAuth && meLoading);
  const totalLoops = loops.length;
  const totalSamples = samples.length;
  const totalUploads = totalLoops + totalSamples;
  const hasUploads = totalUploads > 0;
  const allItems = [...loops, ...samples];
  const totalDownloads = sumDownloads(loops) + sumDownloads(samples);
  const averageDownloads = totalUploads ? (totalDownloads / totalUploads).toFixed(1) : '0';
  const uploadsLast30 = countRecentUploads(allItems, 30);
  const latestUploadAt = getLatestDate(allItems);
  const topDownloads = Math.max(topLoops[0]?.downloads || 0, topSamples[0]?.downloads || 0);
  const topGenre = getTopGenre(allItems);
  const bpmValues = loops
    .map(item => Number(item.bpm))
    .filter(value => Number.isFinite(value) && value > 0);
  const medianLoopBpm = getMedian(bpmValues);

  return (
    <div className="page-wrapper profile-page">
      <header className="header">
        <div className="logo">
          <a href="/">SoundWave</a>
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
              <section className="profile-compact-card profile-summary">
                <div className="profile-summary-main">
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
                      <span>{totalUploads} tracks</span>
                      <span>{totalDownloads} downloads</span>
                    </div>
                  </div>
                </div>
                {isOwnProfile ? (
                  <div className="profile-summary-side">
                    <a href="/profile/edit" className="btn btn-secondary profile-summary-edit-btn">Edit profile</a>
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
                  label="Avg downloads / track"
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
                      ? 'Upload your first loop or sample to see analytics here.'
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

              <section className="profile-bottom-actions">
                <a href="/" className="btn btn-secondary profile-action-btn">Home</a>
                {isOwnProfile ? (
                  <>
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
                  </>
                ) : null}
              </section>
            </>
          ) : null}
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
