interface PerformanceMetric {
  count: number;
  totalMs: number;
  maxMs: number;
}

interface PerformanceDebugApi {
  endMeasure: (name: string, startTime: number) => void;
  incrementCounter: (name: string, amount?: number) => void;
  printPerformanceReport: () => void;
  resetPerformanceReport: () => void;
  startMeasure: () => number;
}

declare global {
  interface Window {
    __GAME_PERF_DEBUG__?: PerformanceDebugApi;
  }
}

const metrics = new Map<string, PerformanceMetric>();
const isDev = import.meta.env.DEV;

const getMetric = (name: string) => {
  const existingMetric = metrics.get(name);
  if (existingMetric) return existingMetric;

  const nextMetric = {
    count: 0,
    totalMs: 0,
    maxMs: 0,
  };
  metrics.set(name, nextMetric);
  return nextMetric;
};

export const startMeasure = () => (isDev ? performance.now() : 0);

export const endMeasure = (name: string, startTime: number) => {
  if (!isDev) return;

  const duration = performance.now() - startTime;
  const metric = getMetric(name);
  metric.count += 1;
  metric.totalMs += duration;
  metric.maxMs = Math.max(metric.maxMs, duration);
};

export const incrementCounter = (name: string, amount = 1) => {
  if (!isDev) return;

  const metric = getMetric(name);
  metric.count += amount;
};

export const resetPerformanceReport = () => {
  if (!isDev) return;

  metrics.clear();
};

export const printPerformanceReport = () => {
  if (!isDev) return;

  const rows = Array.from(metrics.entries())
    .sort(([firstName], [secondName]) => firstName.localeCompare(secondName))
    .map(([name, metric]) => ({
      name,
      count: metric.count,
      totalMs: Number(metric.totalMs.toFixed(2)),
      avgMs: metric.count
        ? Number((metric.totalMs / metric.count).toFixed(3))
        : 0,
      maxMs: Number(metric.maxMs.toFixed(3)),
    }));

  console.table(rows);
};

const createPerformanceDebugApi = (): PerformanceDebugApi => ({
  endMeasure,
  incrementCounter,
  printPerformanceReport,
  resetPerformanceReport,
  startMeasure,
});

if (isDev && typeof window !== 'undefined') {
  window.__GAME_PERF_DEBUG__ ??= createPerformanceDebugApi();
}
