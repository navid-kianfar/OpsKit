export const METRICS_ENABLED = process.env.N8N_METRICS === 'true' || process.env.OPSKIT_METRICS === 'true';

export function metric(event: string, labels: Record<string, string | number> = {}) {
  if (!METRICS_ENABLED) return;
  const payload = JSON.stringify({ event, ...labels });
  // eslint-disable-next-line no-console
  console.log(`[OPSKIT_METRIC] ${payload}`);
}
