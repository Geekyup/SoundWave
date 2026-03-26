import { Link } from 'react-router-dom';
import StaticWaveform from './StaticWaveform.jsx';
import { cx } from '../utils/classNames.js';

function DownloadCount({ sampleId, downloads }) {
  return (
    <span className="downloads-count sample-downloads-top" id={`downloads-count-${sampleId}`}>
      <svg className="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span className="downloads-num">{downloads}</span>
    </span>
  );
}

export default function SampleCard({
  sample,
  className = '',
  authorHref = null,
  authorName,
  authorLinkTitle,
  secondaryAction = null,
}) {
  const resolvedAuthorName = (authorName || sample.author || '').trim() || 'Unknown';

  return (
    <div
      className={cx('sample-card', 'sample-square', 'sample-item', className)}
      id={`card-${sample.id}`}
      data-card-id={sample.id}
      data-url={sample.play_url || sample.audio_file}
      data-kind="samples"
      data-waveform-peaks={sample.waveform?.peaks?.length ? JSON.stringify(sample.waveform.peaks) : ''}
      data-waveform-duration={sample.waveform?.duration || ''}
      data-type={sample.sample_type}
      data-genre={sample.genre}
    >
      <DownloadCount sampleId={sample.id} downloads={sample.downloads} />

      <div className="sample-info">
        <h3 className="sample-title">{sample.name}</h3>
        <p className="sample-type">{sample.sample_type_display}</p>
        <p className="sample-author">
          <span className="sample-author-prefix">by </span>
          {authorHref ? (
            <Link to={authorHref} className="sample-author-link" title={authorLinkTitle}>
              {resolvedAuthorName}
            </Link>
          ) : (
            <span className="sample-author-muted">{resolvedAuthorName}</span>
          )}
        </p>
      </div>

      <div className="sample-waveform-container">
        <div className="sample-waveform" id={`waveform-${sample.id}`}>
          <StaticWaveform peaks={sample.waveform?.peaks} barsCount={52} />
        </div>
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
        {secondaryAction}
      </div>
    </div>
  );
}
