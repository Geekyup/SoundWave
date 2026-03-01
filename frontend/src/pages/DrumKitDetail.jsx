import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { getDrumKit } from '../api/drumKits.js';
import { getAccessToken } from '../api/client.js';
import SiteHeader from '../components/SiteHeader.jsx';

function renderFolderNodes(nodes, activeFolder, onSelectFolder) {
  if (!nodes?.length) return null;
  return nodes.map(node => (
    <div className="drumkit-folder-node" key={node.path || node.name}>
      <button
        type="button"
        className={`drumkit-folder-btn ${activeFolder === node.path ? 'active' : ''}`}
        onClick={() => onSelectFolder(node.path)}
      >
        {node.name}
      </button>
      {node.children?.length ? (
        <div className="drumkit-folder-children">
          {renderFolderNodes(node.children, activeFolder, onSelectFolder)}
        </div>
      ) : null}
    </div>
  ));
}

export default function DrumKitDetail() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingFileId, setPlayingFileId] = useState(null);
  const audioRef = useRef(null);
  const isAuthenticated = Boolean(getAccessToken());

  const selectedFolder = searchParams.get('folder') || '';

  useEffect(() => {
    const audio = new Audio();
    const onEnded = () => setPlayingFileId(null);
    audio.addEventListener('ended', onEnded);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    setError('');

    getDrumKit(slug)
      .then(data => {
        if (!active) return;
        setKit(data);

        if (!searchParams.get('folder') && data.files?.length) {
          const firstFolder = data.files[0].folder_path || '';
          const next = new URLSearchParams(searchParams);
          if (firstFolder) {
            next.set('folder', firstFolder);
          }
          setSearchParams(next, { replace: true });
        }
      })
      .catch(() => {
        if (!active) return;
        setKit(null);
        setError('Failed to load drum kit.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  const visibleFiles = useMemo(() => {
    if (!kit?.files?.length) return [];
    return kit.files.filter(file => (file.folder_path || '') === selectedFolder);
  }, [kit, selectedFolder]);

  const handleSelectFolder = folder => {
    const next = new URLSearchParams(searchParams);
    if (folder) {
      next.set('folder', folder);
    } else {
      next.delete('folder');
    }
    setSearchParams(next, { replace: true });
  };

  const handleTogglePlay = async file => {
    const audio = audioRef.current;
    if (!audio || !file?.audio_url) return;

    if (playingFileId === file.id && !audio.paused) {
      audio.pause();
      setPlayingFileId(null);
      return;
    }

    try {
      if (audio.src !== file.audio_url) {
        audio.src = file.audio_url;
      }
      await audio.play();
      setPlayingFileId(file.id);
    } catch (_) {
      setPlayingFileId(null);
    }
  };

  return (
    <div className="page-wrapper">
      <SiteHeader
        active="drum-kits"
        searchContent={<input type="text" disabled value={kit?.title || 'Drum kit'} readOnly />}
      />

      <div className="content-wrapper drumkit-detail-wrapper">
        <main className="main-content drumkit-detail-main">
          {loading ? (
            <div className="empty-state"><p>Loading kit...</p></div>
          ) : null}

          {!loading && error ? (
            <div className="empty-state"><p>{error}</p></div>
          ) : null}

          {!loading && !error && kit ? (
            <>
              <section className="drumkit-detail-header">
                <div className="drumkit-detail-top">
                  <div className="drumkit-detail-cover">
                    {kit.cover_url ? (
                      <img src={kit.cover_url} alt={kit.title} />
                    ) : (
                      <span className="drumkit-detail-cover-fallback">
                        {kit.title.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="drumkit-detail-info">
                    <a href="/drum-kits" className="drumkit-back-link">← Back to kits</a>
                    <div className="drumkit-detail-title-row">
                      <h1>{kit.title}</h1>
                    </div>
                    <p className="drumkit-detail-meta">
                      {kit.author ? `by ${kit.author}` : 'Unknown author'} • {kit.genre_display || kit.genre || 'Other'} • {kit.files_count} files
                    </p>
                    {kit.description ? <p className="drumkit-detail-description">{kit.description}</p> : null}
                    {kit.download_url ? (
                      <div className="drumkit-detail-actions">
                        {isAuthenticated ? (
                          <a href={kit.download_url} className="btn btn-primary drumkit-download-btn">Download Kit</a>
                        ) : (
                          <a href="/login" className="btn btn-secondary drumkit-download-btn">Login</a>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="drumkit-browser">
                <aside className="drumkit-sidebar">
                  <button
                    type="button"
                    className={`drumkit-folder-btn ${selectedFolder === '' ? 'active' : ''}`}
                    onClick={() => handleSelectFolder('')}
                  >
                    Root
                  </button>
                  <div className="drumkit-folder-tree">
                    {renderFolderNodes(kit.folders_tree, selectedFolder, handleSelectFolder)}
                  </div>
                </aside>

                <div className="drumkit-files">
                  <header className="drumkit-files-header">
                    <h2>{selectedFolder || 'Root'}</h2>
                    <span>{visibleFiles.length} files</span>
                  </header>

                  {visibleFiles.length ? (
                    <div className="drumkit-file-list">
                      {visibleFiles.map(file => (
                        <button
                          type="button"
                          className={`drumkit-file-row ${playingFileId === file.id ? 'playing' : ''}`}
                          key={file.id}
                          onClick={() => handleTogglePlay(file)}
                        >
                          <div className="drumkit-file-meta">
                            <p className="drumkit-file-name">{file.name}</p>
                            <p className="drumkit-file-path">{file.relative_path}</p>
                          </div>
                          <div className="drumkit-file-side">
                            <span className="drumkit-file-state">
                              {playingFileId === file.id ? 'Playing' : 'Click to play'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No audio files in this folder.</p>
                    </div>
                  )}
                </div>
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
