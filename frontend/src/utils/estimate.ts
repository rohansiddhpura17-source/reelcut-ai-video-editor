/**
 * Realistic render-size estimate, calibrated against real renders.
 *
 * Model: bits-per-pixel. The output is a re-encode of the same footage,
 * so its bitrate tracks the SOURCE's bits-per-pixel (source bitrate /
 * source pixel rate) times the OUTPUT pixel rate (width x height x
 * effective fps). Two corrections matter:
 *
 * 1. Effective fps is capped at the source fps. When the output fps is
 *    higher than the source (e.g. 30fps source -> 60fps output) the
 *    extra frames are near-free duplicates, so the pixel rate must not
 *    double. Ignoring this was the old formula's other error (it
 *    ignored fps entirely, so a 720p/60fps render came out ~1.7x larger
 *    than estimated).
 * 2. The quality spread is real: on the same 720p/60fps footage crf 18
 *    (high) produced 42% more bytes than crf 22 (balanced), so the
 *    factors are 1.7 / 1.2 / 0.8, not a token 10% spread.
 *
 * Calibration (talking_head_test.mp4, 11,753,433 bytes, 144.14s,
 * 1920x1080 30fps -> source 652 kbps, 0.01049 bits/px):
 *  - 720x1280 60fps, crf 18 (high), 60.03s: actual 4,134,632 bytes;
 *    this model estimates ~3.70 MB (-10.6%).
 *  - 720x1280 60fps, crf 22 (balanced), 60.0s: actual 2,908,136 bytes;
 *    this model estimates ~2.61 MB (-10.3%).
 *  - 1080x1920 30fps, crf 22 (balanced), 60.03s: actual 5,061,536 bytes;
 *    this model estimates ~5.87 MB (+16.0%).
 * All three are inside +/-25%. The bits-per-pixel value is clamped so
 * an unusual source can never produce an absurd estimate.
 */

export interface EstimateInput {
  sourceSizeBytes?: number;
  sourceDurationSec?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceFps?: number;
  outWidth: number;
  outHeight: number;
  outFps: number;
  qualityPreset: 'high' | 'balanced' | 'compact';
  durationSec: number;
}

const QUALITY_FACTOR: Record<EstimateInput['qualityPreset'], number> = {
  high: 1.7,
  balanced: 1.2,
  compact: 0.8,
};

// Nominal bits-per-pixel when the source metadata is missing, and the
// clamp applied to a source-derived value. 0.01 bits/px is what the two
// calibration renders measured (0.0100 / 0.0108).
const NOMINAL_BPP = 0.01;
const MIN_BPP = 0.004;
const MAX_BPP = 0.025;

export function estimateRenderSizeBytes(input: EstimateInput): number {
  const { sourceSizeBytes, sourceDurationSec, sourceWidth, sourceHeight, sourceFps } = input;
  // Effective fps: upsampling past the source fps only duplicates
  // frames, which cost almost nothing, so the pixel rate uses the
  // lower of the two. Unknown source fps -> no cap.
  const effFps = sourceFps && sourceFps > 0
    ? Math.min(input.outFps, sourceFps)
    : input.outFps;
  const outPxRate = input.outWidth * input.outHeight * effFps;
  const duration = Math.max(0, input.durationSec);
  if (outPxRate <= 0 || duration <= 0) return 0;

  let bpp = NOMINAL_BPP;
  if (
    sourceSizeBytes && sourceSizeBytes > 0 &&
    sourceDurationSec && sourceDurationSec > 0 &&
    sourceWidth && sourceWidth > 0 &&
    sourceHeight && sourceHeight > 0 &&
    sourceFps && sourceFps > 0
  ) {
    const srcBps = (sourceSizeBytes * 8) / sourceDurationSec;
    const srcPxRate = sourceWidth * sourceHeight * sourceFps;
    bpp = Math.min(MAX_BPP, Math.max(MIN_BPP, srcBps / srcPxRate));
  }

  const factor = QUALITY_FACTOR[input.qualityPreset] ?? 1.0;
  return (bpp * outPxRate * factor * duration) / 8;
}
