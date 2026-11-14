/** "45 s", "12 min", "3 h 05 min", "2 d 4 h": short enough for a dense table cell. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${String(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)} h ${String(minutes % 60).padStart(2, "0")} min`;
  return `${String(Math.floor(hours / 24))} d ${String(hours % 24)} h`;
}

/** Whole numbers stay whole; shared wins (1/k) get up to two decimals. */
export const formatCount = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export const formatPercent = (fraction: number) => `${String(Math.round(fraction * 100))}%`;
