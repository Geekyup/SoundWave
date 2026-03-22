import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { logout } from '../api/auth.js';
import { getAccessToken } from '../api/client.js';
import { listDrumKits } from '../api/drumKits.js';
import { listLoops } from '../api/loops.js';
import { getMe } from '../api/me.js';
import { listSamples } from '../api/samples.js';

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
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loops, setLoops] = useState([]);
  const [samples, setSamples] = useState([]);
  const [drumKits, setDrumKits] = useState([]);

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
        fetchAllAuthorItems(listLoops, profileUsername, { ordering: '-uploaded_at', include_waveform: '1' }),
        fetchAllAuthorItems(listSamples, profileUsername, { ordering: '-uploaded_at', include_waveform: '1' }),
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

  useEffect(() => {
    if (window.__swInit) {
      window.__swInit();
    }
  }, [loops, samples]);

  if (!isAuth && !requestedUsername) {
    return (
      <main className="profile-compact-layout profile-auth-guard">
        <div className="profile-compact-card profile-auth-card">
          <p className="profile-auth-kicker">Account Required</p>
          <h1>Profile is available after login</h1>
          <p className="profile-auth-text">Please sign in to view and manage your profile.</p>
          <div className="profile-auth-actions">
            <Link to="/login" className="btn btn-primary">Login</Link>
            <Link to="/register" className="btn btn-secondary">Register</Link>
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
  const uploadsLast30 = countRecentUploads(allItems, 30);
  const latestUploadAt = getLatestDate(allItems);
  const topGenre = getTopGenre(allItems);
  const topLoops = useMemo(
    () => [...loops].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 5),
    [loops],
  );
  const topSamples = useMemo(
    () => [...samples].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 5),
    [samples],
  );

  return (
    <div className="page-wrapper profile-page">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <Link to="/">SoundWave</Link>
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
              <Link to="/" className="btn btn-secondary">Back to Home</Link>
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
                    <Link to="/profile/edit" className="profile-summary-edit-btn">Edit profile</Link>
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
                  label="Main genre"
                  value={topGenre}
                  icon={(
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                      <path d="M4 7h16M4 12h10M4 17h13"></path>
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
                    <Link to="/upload" className="btn btn-primary">Upload track</Link>
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
                <Link to="/" className="btn btn-secondary profile-action-btn">Home</Link>
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="btn btn-secondary profile-action-btn"
                    onClick={() => {
                      logout();
                      navigate('/');
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
