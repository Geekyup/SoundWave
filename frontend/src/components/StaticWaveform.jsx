function getSafeBarsCount(barsCount) {
  return Math.max(16, Math.min(240, Number(barsCount) || 56));
}

function compressPeaks(peaks, barsCount) {
  if (!Array.isArray(peaks) || !peaks.length) return [];

  const safeBarsCount = getSafeBarsCount(barsCount);
  const bucketSize = Math.max(1, Math.ceil(peaks.length / safeBarsCount));
  const output = [];

  for (let start = 0; start < peaks.length; start += bucketSize) {
    const slice = peaks.slice(start, start + bucketSize);
    let maxPeak = 0;
    for (let index = 0; index < slice.length; index += 1) {
      const value = Math.abs(Number(slice[index]) || 0);
      if (value > maxPeak) maxPeak = value;
    }
    output.push(Math.max(0.004, Math.min(1, maxPeak)));
  }

  const trimmedOutput = output.slice(0, safeBarsCount);
  let ceiling = 0;
  for (let index = 0; index < trimmedOutput.length; index += 1) {
    const value = trimmedOutput[index];
    if (value > ceiling) ceiling = value;
  }

  if (ceiling <= 0) {
    return trimmedOutput;
  }

  return trimmedOutput.map(value => (
    Math.max(0.004, Math.min(1, Number((value / ceiling).toFixed(6))))
  ));
}

function buildMonotoneBars(barsCount, level = 'mid') {
  const safeBarsCount = getSafeBarsCount(barsCount);
  const isHighLevel = level === 'high';

  return Array.from({ length: safeBarsCount }, (_, index) => {
    const position = index / Math.max(1, safeBarsCount - 1);
    const crest = Math.cos(position * Math.PI * 10.5);
    const shimmer = Math.sin((position * Math.PI * 2.8) + (Math.PI / 3));
    const baseHeight = isHighLevel ? 0.9 : 0.5;
    const crestRange = isHighLevel ? 0.045 : 0.045;
    const shimmerRange = isHighLevel ? 0.02 : 0.02;
    const minHeight = isHighLevel ? 0.9 : 0.5;
    const maxHeight = isHighLevel ? 0.975 : 0.575;
    const height = baseHeight + (((crest + 1) / 2) * crestRange) + (((shimmer + 1) / 2) * shimmerRange);
    return Math.max(minHeight, Math.min(maxHeight, Number(height.toFixed(4))));
  });
}

export default function StaticWaveform({
  peaks,
  className = '',
  barsCount = 56,
  fill = null,
  variant = 'peaks',
  monotoneLevel = 'mid',
}) {
  const bars = variant === 'monotone'
    ? buildMonotoneBars(barsCount, monotoneLevel)
    : compressPeaks(peaks, barsCount);

  if (!bars.length) return null;

  const barWidth = 100 / bars.length;
  const pathData = bars.map((peak, index) => {
    const scaledPeak = Math.pow(Math.max(0, peak), 0.58);
    const height = Math.min(100, Math.max(3.2, scaledPeak * 112));
    const y = (100 - height) / 2;
    const width = Math.max(0.14, Math.min(0.92, barWidth * 0.54));
    const x = index * barWidth + ((barWidth - width) / 2);
    const xEnd = x + width;
    const yEnd = y + height;
    return `M${x.toFixed(3)} ${y.toFixed(3)}H${xEnd.toFixed(3)}V${yEnd.toFixed(3)}H${x.toFixed(3)}Z`;
  }).join('');

  return (
    <div className={`static-waveform ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" shapeRendering="crispEdges">
        <path className="static-waveform-shape" d={pathData} style={fill ? { fill } : undefined} />
      </svg>
    </div>
  );
}
