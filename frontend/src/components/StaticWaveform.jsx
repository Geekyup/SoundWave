function compressPeaks(peaks, barsCount) {
  if (!Array.isArray(peaks) || !peaks.length) return [];

  const safeBarsCount = Math.max(16, Math.min(96, Number(barsCount) || 56));
  const bucketSize = Math.max(1, Math.ceil(peaks.length / safeBarsCount));
  const output = [];

  for (let start = 0; start < peaks.length; start += bucketSize) {
    const slice = peaks.slice(start, start + bucketSize);
    let maxPeak = 0;
    for (let index = 0; index < slice.length; index += 1) {
      const value = Math.abs(Number(slice[index]) || 0);
      if (value > maxPeak) maxPeak = value;
    }
    output.push(Math.max(0.04, Math.min(1, maxPeak)));
  }

  return output.slice(0, safeBarsCount);
}

export default function StaticWaveform({
  peaks,
  className = '',
  barsCount = 56,
}) {
  const bars = compressPeaks(peaks, barsCount);
  if (!bars.length) return null;

  const barWidth = 100 / bars.length;
  const pathData = bars.map((peak, index) => {
    const height = Math.max(10, peak * 76);
    const y = (100 - height) / 2;
    const width = Math.max(0.8, barWidth * 0.48);
    const x = index * barWidth + ((barWidth - width) / 2);
    const xEnd = x + width;
    const yEnd = y + height;
    return `M${x.toFixed(3)} ${y.toFixed(3)}H${xEnd.toFixed(3)}V${yEnd.toFixed(3)}H${x.toFixed(3)}Z`;
  }).join('');

  return (
    <div className={`static-waveform ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" shapeRendering="crispEdges">
        <path className="static-waveform-shape" d={pathData} />
      </svg>
    </div>
  );
}
