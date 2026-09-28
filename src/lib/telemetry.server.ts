import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-message stage timing. A trace lives in AsyncLocalStorage for the
 * duration of one queued job, so deep helpers can record stages without
 * threading a parameter through every call. Telemetry never throws.
 */
export type Trace = {
  start: number;
  stages: Record<string, number>;
  meta: Record<string, unknown>;
};

const als = new AsyncLocalStorage<Trace>();

export function runWithTrace<T>(fn: () => Promise<T>): { trace: Trace; result: Promise<T> } {
  const trace: Trace = { start: Date.now(), stages: {}, meta: {} };
  return { trace, result: als.run(trace, fn) };
}

export function currentTrace(): Trace | undefined {
  try {
    return als.getStore();
  } catch {
    return undefined;
  }
}

export function addStage(stage: string, ms: number) {
  const t = currentTrace();
  if (!t || !Number.isFinite(ms)) return;
  t.stages[stage] = Math.round((t.stages[stage] ?? 0) + ms);
}

export function setTraceMeta(key: string, value: unknown) {
  const t = currentTrace();
  if (t) t.meta[key] = value;
}

export async function traceTime<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  const s = Date.now();
  try {
    return await fn();
  } finally {
    addStage(stage, Date.now() - s);
  }
}

/** Serialize: stages + meta + queue_ms and total_ms. "db" absorbs untracked time. */
export function traceToJSON(trace: Trace, queuedAt?: string | null) {
  try {
    const work = Date.now() - trace.start;
    const tracked = Object.values(trace.stages).reduce((a, b) => a + b, 0);
    const queue = queuedAt ? Math.max(0, trace.start - new Date(queuedAt).getTime()) : 0;
    const stages = { ...trace.stages };
    stages.db = (stages.db ?? 0) + Math.max(0, work - tracked);
    return { queue_ms: queue, ...Object.fromEntries(Object.entries(stages).map(([k, v]) => [`${k}_ms`, v])), work_ms: work, total_ms: queue + work, ...trace.meta };
  } catch {
    return null;
  }
}
