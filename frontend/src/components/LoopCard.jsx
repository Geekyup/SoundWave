import { Link } from 'react-router-dom';
import StaticWaveform from './StaticWaveform.jsx';
import { cx } from '../utils/classNames.js';

function DownloadsCount({ loopId, downloads }) {
  return (
    <span className="downloads-count" id={`downloads-count-${loopId}`}>
      <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span className="downloads-num">{downloads}</span>
    </span>
  );
}

function LoopTag({ className, onClick, title, children }) {
  if (onClick) {
    return (
      <button type="button" className={cx('tag', className, 'tag-button')} onClick={onClick} title={title}>
        {children}
      </button>
    );
  }

  return <span className={cx('tag', className)}>{children}</span>;
}

export default function LoopCard({
  loop,
  className = '',
  authorHref = null,
  authorName,
  metaContent = null,
  primaryAction = null,
  keywordTags = [],
  onGenreClick = null,
  onKeywordClick = null,
}) {
  const resolvedAuthorName = (authorName || loop.author || '').trim() || 'Unknown';

  return (
    <div
      className={cx('sample-card', 'loop-item', className)}
      id={`card-${loop.id}`}
      data-card-id={loop.id}
      data-url={loop.play_url || loop.audio_file}
      data-kind="loops"
      data-waveform-peaks={loop.waveform?.peaks?.length ? JSON.stringify(loop.waveform.peaks) : ''}
      data-waveform-duration={loop.waveform?.duration || ''}
    >
      <div className="card-header">
        <div className="card-info">
          <h3 className="card-title">{loop.name}</h3>
          <div className="card-author">
            <div className="card-author-wrapper">
              <div className="card-author-avatar">
                {resolvedAuthorName.charAt(0).toUpperCase()}
              </div>
              {authorHref ? (
                <Link to={authorHref} className="author-link">{resolvedAuthorName}</Link>
              ) : (
                <span className="author-link">{resolvedAuthorName}</span>
              )}
            </div>
          </div>
        </div>
        {metaContent ? <div className="card-meta-top">{metaContent}</div> : null}
      </div>

      <div className="card-waveform">
        <div className="waveform-container" id={`waveform-${loop.id}`}>
          <StaticWaveform peaks={loop.waveform?.peaks} barsCount={24} />
        </div>
      </div>

      <div className="card-controls">
        <div className="controls-right">
          <DownloadsCount loopId={loop.id} downloads={loop.downloads} />
        </div>

        <div className="controls-actions">
          {primaryAction}
          <button className="play-btn-rect" data-card-id={loop.id} data-url={loop.play_url || loop.audio_file} type="button">
            Play
          </button>
        </div>
      </div>

      <div className="card-tags">
        <span className="tag bpm-tag">{loop.bpm} bpm</span>
        <LoopTag
          className="genre-tag"
          onClick={onGenreClick ? () => onGenreClick(loop.genre) : null}
          title={onGenreClick ? `Filter by genre: ${loop.genre_display}` : undefined}
        >
          {loop.genre_display}
        </LoopTag>
        <span className="tag size-tag">{loop.file_size}</span>
        {keywordTags.map(tag => (
          <LoopTag
            key={`${loop.id}-${tag}`}
            className="keyword-tag"
            onClick={onKeywordClick ? () => onKeywordClick(tag) : null}
            title={onKeywordClick ? `Filter by keyword: ${tag}` : undefined}
          >
            {tag}
          </LoopTag>
        ))}
      </div>
    </div>
  );
}
