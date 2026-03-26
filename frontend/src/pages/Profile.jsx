import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { logout } from '../api/auth.js';
import { getAccessToken } from '../api/client.js';
import SimpleBrandHeader from '../components/SimpleBrandHeader.jsx';
import { getProfileSummary } from '../api/profile.js';
import { formatDate } from '../utils/date.js';

function getInitial(username) {
  const raw = (username || '').trim();
  return raw ? raw.charAt(0).toUpperCase() : 'U';
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
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = getAccessToken();
  const isAuth = Boolean(token);
  const requestedUsername = (username || '').trim();

  useEffect(() => {
    if (!requestedUsername && !isAuth) {
      setSummary(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    setSummary(null);

    getProfileSummary(
      requestedUsername ? { username: requestedUsername } : {},
      { skipAuth: !isAuth },
    )
      .then(data => {
        if (!active) return;
        setSummary(data);
      })
      .catch(err => {
        if (!active) return;
        setError(err.message || 'Failed to load profile data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuth, requestedUsername]);

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

  const isOwnProfile = Boolean(summary?.is_own_profile);
  const displayUsername = summary?.username || requestedUsername || 'User';
  const profileBio = isOwnProfile ? (summary?.bio || '').trim() : '';
  const counts = summary?.counts || {};
  const totalLoops = counts.loop || 0;
  const totalSamples = counts.sample || 0;
  const totalDrumKits = counts.drumkit || 0;
  const totalUploads = summary?.total_uploads || 0;
  const hasUploads = totalUploads > 0;
  const totalDownloads = summary?.total_downloads || 0;
  const uploadsLast30 = summary?.uploads_last_30 || 0;
  const latestUploadAt = summary?.latest_upload_at || '';
  const topGenre = summary?.top_genre || '-';
  const topLoops = summary?.top_loops || [];
  const topSamples = summary?.top_samples || [];

  return (
    <div className="page-wrapper profile-page simple-page-shell">
      <SimpleBrandHeader />

      <div className="content-wrapper profile-compact-content">
        <main className="main-content profile-compact-main">
          {loading ? (
            <div className="profile-compact-card empty-state">
              <p>Loading profile...</p>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="profile-compact-card empty-state">
              <p>{error}</p>
              <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
          ) : null}

          {!loading && !error ? (
            <>
              <section className={`profile-compact-card profile-summary ${isOwnProfile ? 'is-own' : ''}`}>
                <div className={`profile-summary-main ${isOwnProfile ? 'has-about' : ''}`}>
                  <div className="profile-summary-avatar">
                    {isOwnProfile && summary?.avatar_url ? (
                      <img src={summary.avatar_url} alt={`${displayUsername} avatar`} />
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
