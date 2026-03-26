import { Link } from 'react-router-dom';

import { cx } from '../utils/classNames.js';

export function resolveDrumKitTitle(kit) {
  const raw = typeof kit?.title === 'string' ? kit.title.trim() : '';
  return raw || 'Drum Kit';
}

function getDrumKitHref(kit) {
  return kit?.slug ? `/drum-kits/${kit.slug}` : '/drum-kits';
}

export default function DrumKitCard({ kit, action = null, className = '' }) {
  const title = resolveDrumKitTitle(kit);

  return (
    <article className={cx('drumkit-card', className)}>
      <Link to={getDrumKitHref(kit)} className="drumkit-card-link">
        <div className="drumkit-cover">
          {kit?.cover_url ? (
            <img src={kit.cover_url} alt={title} loading="lazy" />
          ) : (
            <span className="drumkit-cover-fallback">
              {title.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <div className="drumkit-card-body">
          <div className="drumkit-title-row">
            <h3>{title}</h3>
            <span className="drumkit-genre">{kit?.genre_display || kit?.genre || 'Other'}</span>
          </div>
          <p className="drumkit-meta">
            {kit?.author ? `by ${kit.author}` : 'Unknown author'}
          </p>
        </div>
      </Link>

      {action}
    </article>
  );
}
