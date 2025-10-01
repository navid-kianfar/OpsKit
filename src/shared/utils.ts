export function nowMs() { return Date.now(); }
export function toMs(s: string | number) {
  if (typeof s === 'number') return s;
  const m = /^(\d+)(ms|s|m|h)$/.exec(s);
  if (!m) throw new Error(`Invalid duration: ${s}`);
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case 'ms': return n;
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
  }
  return n;
}
export function jitter(baseMs: number, pct = 0.2) {
  const delta = baseMs * pct;
  return baseMs + (Math.random() * 2 - 1) * delta;
}
