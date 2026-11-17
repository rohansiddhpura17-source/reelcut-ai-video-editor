import { TimeInterval } from '../types';

/**
 * The renderer caps the reel at 60s: it keeps retained intervals in order
 * and trims the interval that crosses 60s (only if more than 0.5s remains),
 * dropping everything after it. This mirrors that logic exactly so the UI
 * can warn, before rendering, which kept footage will be dropped.
 */
export interface CapResult {
  keptDuration: number;
  dropped: TimeInterval[];
}

export function capTo60(intervals: TimeInterval[]): CapResult {
  let acc = 0;
  const dropped: TimeInterval[] = [];
  for (const iv of intervals) {
    const d = iv.end - iv.start;
    if (acc + d <= 60) {
      acc += d;
    } else {
      const remain = 60 - acc;
      if (remain > 0.5) {
        acc = 60;
        dropped.push({ start: iv.start + remain, end: iv.end });
      } else {
        dropped.push({ start: iv.start, end: iv.end });
      }
    }
  }
  return { keptDuration: Math.min(60, acc), dropped };
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
}
