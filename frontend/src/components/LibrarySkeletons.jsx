const LOOP_SKELETON_ITEMS = Array.from({ length: 6 }, (_, index) => index);
const SAMPLE_SKELETON_ITEMS = Array.from({ length: 8 }, (_, index) => index);
const DRUMKIT_SKELETON_ITEMS = Array.from({ length: 6 }, (_, index) => index);

export function LoopCardSkeletonList() {
  return LOOP_SKELETON_ITEMS.map(item => (
    <div className="sample-card sample-card-skeleton" key={`loop-skeleton-${item}`} aria-hidden="true">
      <div className="card-header">
        <div className="card-info">
          <div className="skeleton-line skeleton-line-title"></div>
          <div className="skeleton-line skeleton-line-author"></div>
        </div>
        <div className="card-meta-top">
          <div className="skeleton-line skeleton-line-date"></div>
        </div>
      </div>
      <div className="card-waveform skeleton-waveform"></div>
      <div className="card-controls">
        <div className="skeleton-pill"></div>
        <div className="controls-actions">
          <div className="skeleton-btn skeleton-btn-download"></div>
          <div className="skeleton-btn skeleton-btn-play"></div>
        </div>
      </div>
      <div className="card-tags">
        <span className="tag skeleton-tag"></span>
        <span className="tag skeleton-tag"></span>
        <span className="tag skeleton-tag"></span>
      </div>
    </div>
  ));
}

export function SampleSquareSkeletonGrid() {
  return SAMPLE_SKELETON_ITEMS.map(item => (
    <div className="sample-card sample-square sample-card-skeleton sample-square-skeleton-card" key={`sample-skeleton-${item}`} aria-hidden="true">
      <div className="sample-info sample-square-skeleton-info">
        <div className="sample-square-skeleton-block sample-square-skeleton-title"></div>
        <div className="sample-square-skeleton-block sample-square-skeleton-type"></div>
        <div className="sample-square-skeleton-block sample-square-skeleton-author"></div>
      </div>
      <div className="sample-waveform-container">
        <div className="sample-waveform skeleton-waveform sample-square-skeleton-waveform"></div>
      </div>
      <div className="sample-controls sample-square-skeleton-controls">
        <div className="skeleton-btn sample-square-skeleton-btn"></div>
        <div className="skeleton-btn sample-square-skeleton-btn"></div>
      </div>
    </div>
  ));
}

export function DrumKitSkeletonGrid() {
  return DRUMKIT_SKELETON_ITEMS.map(item => (
    <article className="drumkit-card drumkit-card-skeleton" key={`drumkit-skeleton-${item}`} aria-hidden="true">
      <div className="drumkit-card-link">
        <div className="drumkit-cover drumkit-skeleton-cover"></div>
        <div className="drumkit-card-body">
          <div className="drumkit-title-row">
            <div className="skeleton-line drumkit-skeleton-title"></div>
            <div className="skeleton-pill drumkit-skeleton-genre"></div>
          </div>
          <div className="skeleton-line drumkit-skeleton-meta"></div>
        </div>
      </div>
      <div className="skeleton-btn drumkit-skeleton-action"></div>
    </article>
  ));
}
