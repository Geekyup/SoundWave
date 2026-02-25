import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getMe } from '../api/me.js';
import { listLoops } from '../api/loops.js';
import { listSamples } from '../api/samples.js';
import { getAccessToken } from '../api/client.js';
import { logout } from '../api/auth.js';

function sumDownloads(items) {
  return items.reduce((total, item) => total + (item.downloads || 0), 0);
}

export default function Profile() {
  const { username } = useParams();
  const [me, setMe] = useState(null);
  const [loops, setLoops] = useState([]);
  const [samples, setSamples] = useState([]);
  const [topLoops, setTopLoops] = useState([]);
  const [topSamples, setTopSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ loops: 0, samples: 0 });

  const isAuth = Boolean(getAccessToken());
  const profileUsername = useMemo(() => username || me?.username, [username, me]);

  useEffect(() => {
    if (!isAuth) {
      setLoading(false);
      return;
    }
    getMe()
      .then(profile => setMe(profile))
      .catch(() => setMe(null));
  }, [isAuth]);

  useEffect(() => {
    if (!profileUsername) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    const fetchData = async () => {
      const [loopsData, samplesData, topLoopsData, topSamplesData] = await Promise.all([
        listLoops({ author: profileUsername, page: 1 }),
        listSamples({ author: profileUsername, page: 1 }),
        listLoops({ author: profileUsername, ordering: 'downloads', page: 1 }),
        listSamples({ author: profileUsername, ordering: 'downloads', page: 1 }),
      ]);

      if (!active) return;
      setLoops(loopsData.results || []);
      setSamples(samplesData.results || []);
      setTopLoops((topLoopsData.results || []).slice(0, 5));
      setTopSamples((topSamplesData.results || []).slice(0, 5));
      setCounts({
        loops: loopsData.count || 0,
        samples: samplesData.count || 0,
      });
    };

    fetchData()
      .catch(() => {
        if (active) {
          setLoops([]);
          setSamples([]);
          setTopLoops([]);
          setTopSamples([]);
          setCounts({ loops: 0, samples: 0 });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [profileUsername]);

  if (!isAuth) {
    return (
      <main className="profile-wrapper">
        <div className="profile-container">
          <div className="empty-state">
            <p>Please log in to view your profile.</p>
            <a href="/login" className="btn btn-primary">Login</a>
          </div>
        </div>
      </main>
    );
  }

  const totalUploads = counts.loops + counts.samples;
  const totalDownloads = sumDownloads(loops) + sumDownloads(samples);

  return (
    <div>
      <header className="header">
        <div className="logo">
          <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>SoundWave</a>
        </div>
      </header>

      <main className="profile-wrapper">
        <div className="profile-hero">
          <div className="profile-hero-bg"></div>
          <div className="profile-hero-content">
            <div className="profile-avatar-large">
              {me?.avatar_url ? (
                <img src={me.avatar_url} alt={`${profileUsername} avatar`} className="avatar-img-large" />
              ) : (
                <div className="avatar-circle-large">{profileUsername?.charAt(0)?.toUpperCase() || 'U'}</div>
              )}
            </div>
            <div className="profile-info-hero">
              <p className="profile-verified">PROFILE</p>
              <h1>{profileUsername || 'User'}</h1>
              <p className="profile-meta-hero">
                {totalUploads} track{totalUploads === 1 ? '' : 's'} • Member since —
              </p>
            </div>
          </div>
        </div>

        <div className="profile-container">
          <div className="stats-overview">
            <div className="stat-item stat-item-featured">
              <div className="stat-icon-container">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </div>
              <div className="stat-content-wrapper">
                <div className="stat-number">{totalDownloads}</div>
                <div className="stat-text">Downloads</div>
              </div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-icon-container">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              <div className="stat-content-wrapper">
                <div className="stat-number">{totalUploads}</div>
                <div className="stat-text">Uploads</div>
              </div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-icon-container">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div className="stat-content-wrapper">
                <div className="stat-number">{counts.loops}</div>
                <div className="stat-text">Loops</div>
              </div>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-icon-container">
                <svg className="stat-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
              <div className="stat-content-wrapper">
                <div className="stat-number">{counts.samples}</div>
                <div className="stat-text">Samples</div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <p>Loading profile...</p>
            </div>
          ) : null}

          {topLoops.length || topSamples.length ? (
            <section className="profile-section">
              <div className="section-title-wrapper">
                <h2 className="section-title">Most Popular</h2>
                <p className="section-description">Your most downloaded tracks</p>
              </div>
              {topLoops.length ? (
                <div className="tracks-container">
                  <h3 className="tracks-category">Loops</h3>
                  <div className="tracks-list">
                    {topLoops.map((loop, index) => (
                      <div className="track-item" data-rank={index + 1} key={loop.id}>
                        <div className="track-rank">{index + 1}</div>
                        <div className="track-info">
                          <div className="track-name">{loop.name}</div>
                          <div className="track-details">
                            <span className="track-badge">{loop.genre_display}</span>
                            <span className="track-badge track-bpm">{loop.bpm} BPM</span>
                          </div>
                        </div>
                        <div className="track-metrics">
                          <div className="metric-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>{loop.downloads}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {topSamples.length ? (
                <div className="tracks-container">
                  <h3 className="tracks-category">Samples</h3>
                  <div className="tracks-list">
                    {topSamples.map((sample, index) => (
                      <div className="track-item" data-rank={index + 1} key={sample.id}>
                        <div className="track-rank">{index + 1}</div>
                        <div className="track-info">
                          <div className="track-name">{sample.name}</div>
                          <div className="track-details">
                            <span className="track-badge">{sample.sample_type_display}</span>
                            <span className="track-badge">{sample.genre_display}</span>
                          </div>
                        </div>
                        <div className="track-metrics">
                          <div className="metric-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>{sample.downloads}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {loops.length || samples.length ? (
            <section className="profile-section">
              <div className="section-title-wrapper">
                <h2 className="section-title">Recent Uploads</h2>
                <p className="section-description">Your latest additions</p>
              </div>
              {loops.length ? (
                <div className="tracks-container">
                  <h3 className="tracks-category">Loops</h3>
                  <div className="tracks-list">
                    {loops.slice(0, 8).map(loop => (
                      <div className="track-item" key={loop.id}>
                        <div className="track-info">
                          <div className="track-name">{loop.name}</div>
                          <div className="track-details">
                            <span className="track-date">{loop.uploaded_at ? new Date(loop.uploaded_at).toLocaleDateString() : ''}</span>
                            <span className="track-badge">{loop.genre_display}</span>
                          </div>
                        </div>
                        <div className="track-metrics">
                          <div className="metric-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>{loop.downloads}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {samples.length ? (
                <div className="tracks-container">
                  <h3 className="tracks-category">Samples</h3>
                  <div className="tracks-list">
                    {samples.slice(0, 8).map(sample => (
                      <div className="track-item" key={sample.id}>
                        <div className="track-info">
                          <div className="track-name">{sample.name}</div>
                          <div className="track-details">
                            <span className="track-date">{sample.uploaded_at ? new Date(sample.uploaded_at).toLocaleDateString() : ''}</span>
                            <span className="track-badge">{sample.sample_type_display}</span>
                          </div>
                        </div>
                        <div className="track-metrics">
                          <div className="metric-item">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            <span>{sample.downloads}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="profile-actions">
            <a href="/" className="btn-profile btn-home">Back to Home</a>
            <button
              type="button"
              className="btn-profile btn-logout"
              onClick={() => {
                logout();
                window.location.href = '/';
              }}
            >
              Logout
            </button>
            <a href="/profile/edit" className="btn-profile btn-edit">Edit profile</a>
          </div>
        </div>
      </main>
    </div>
  );
}
