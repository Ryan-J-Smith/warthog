// Pure-JS DSP toolkit for the WARTHOG audio build.
// Mono signals are Float32Array; multichannel signals are Float32Array[] (one array per channel).
// Everything runs at a fixed sample rate (SR) so recipes can think in seconds.

export const SR = 44100;

/** Seconds → samples. */
export const secs = (s) => Math.max(0, Math.round(s * SR));
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => 20 * Math.log10(Math.max(1e-12, g));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) so every build is reproducible.
// ---------------------------------------------------------------------------
export class Rng {
  constructor(seed) {
    this.s = seed >>> 0;
  }
  next() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
  gauss() {
    const u = Math.max(1e-12, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

// ---------------------------------------------------------------------------
// Buffers
// ---------------------------------------------------------------------------
export const zeros = (n) => new Float32Array(Math.max(0, Math.round(n)));
export const silence = (seconds) => zeros(secs(seconds));

export function copy(x) {
  return Float32Array.from(x);
}

/** Slice by seconds (clamped). */
export function slice(x, t0, t1 = x.length / SR) {
  return x.slice(clamp(secs(t0), 0, x.length), clamp(secs(t1), 0, x.length));
}

export function concat(...parts) {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Add `src * g` into `dst` starting at sample `offset` (clipped to dst). Returns dst. */
export function mixInto(dst, src, offset = 0, g = 1) {
  const o = Math.round(offset);
  const start = Math.max(0, -o);
  const end = Math.min(src.length, dst.length - o);
  for (let i = start; i < end; i++) dst[i + o] += src[i] * g;
  return dst;
}

/** Like mixInto but wraps around the end of dst (for building seamless loops). */
export function mixIntoWrap(dst, src, offset = 0, g = 1) {
  const n = dst.length;
  let o = ((Math.round(offset) % n) + n) % n;
  for (let i = 0; i < src.length; i++) {
    dst[o] += src[i] * g;
    o++;
    if (o === n) o = 0;
  }
  return dst;
}

/** Mix a list of [signal, offsetSeconds, gain] into a new buffer of the given length (seconds). */
export function mix(lengthSec, layers) {
  const out = silence(lengthSec);
  for (const [sig, at = 0, g = 1] of layers) mixInto(out, sig, secs(at), g);
  return out;
}

export function scale(x, g) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
  return out;
}

export function add(a, b) {
  const out = new Float32Array(Math.max(a.length, b.length));
  out.set(a);
  for (let i = 0; i < b.length; i++) out[i] += b[i];
  return out;
}

export function multiply(a, b) {
  const n = Math.min(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] * b[i];
  return out;
}

export function reverse(x) {
  return Float32Array.from(x).reverse();
}

export function peak(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > m) m = a;
  }
  return m;
}

export function peakAll(chs) {
  return Math.max(...chs.map(peak));
}

export function rms(x) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, x.length));
}

export function normalize(x, targetDb = -1) {
  const p = peak(x);
  return p > 0 ? scale(x, dbToGain(targetDb) / p) : copy(x);
}

/** Resize (truncate or zero-pad) to n samples. */
export function fit(x, n) {
  const out = new Float32Array(n);
  out.set(x.subarray(0, Math.min(n, x.length)));
  return out;
}

// ---------------------------------------------------------------------------
// Envelopes & fades
// ---------------------------------------------------------------------------

/** Linear fade in over `sec` seconds (in place copy). */
export function fadeIn(x, sec, shape = 'sine') {
  const out = copy(x);
  const n = Math.min(out.length, secs(sec));
  for (let i = 0; i < n; i++) out[i] *= fadeCurve(i / n, shape);
  return out;
}

export function fadeOut(x, sec, shape = 'sine') {
  const out = copy(x);
  const n = Math.min(out.length, secs(sec));
  for (let i = 0; i < n; i++) out[out.length - 1 - i] *= fadeCurve(i / n, shape);
  return out;
}

function fadeCurve(t, shape) {
  if (shape === 'lin') return t;
  if (shape === 'exp') return t * t;
  return Math.sin((t * Math.PI) / 2);
}

/**
 * Multiply by a piecewise-linear envelope given as [[timeSec, value], ...].
 * Values before the first / after the last point hold.
 */
export function envelope(x, points) {
  const out = copy(x);
  const pts = points.map(([t, v]) => [t * SR, v]);
  let k = 0;
  for (let i = 0; i < out.length; i++) {
    while (k < pts.length - 2 && i > pts[k + 1][0]) k++;
    const [t0, v0] = pts[k];
    const [t1, v1] = pts[Math.min(k + 1, pts.length - 1)];
    let v;
    if (i <= t0) v = v0;
    else if (i >= t1) v = v1;
    else v = v0 + ((v1 - v0) * (i - t0)) / (t1 - t0);
    out[i] *= v;
  }
  return out;
}

/** Envelope curve as a signal: attack (linear) then exponential decay with time constant tau. */
export function adEnv(lengthSec, attackSec, tauSec) {
  const n = secs(lengthSec);
  const a = Math.max(1, secs(attackSec));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = i < a ? i / a : Math.exp(-(i - a) / (tauSec * SR));
  }
  return out;
}

export function applyEnv(x, env) {
  return multiply(x, env.length >= x.length ? env : fit(env, x.length));
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function whiteNoise(lengthSec, rng) {
  const out = silence(lengthSec);
  for (let i = 0; i < out.length; i++) out[i] = rng.next() * 2 - 1;
  return out;
}

/** Pink noise (Paul Kellet's economy filter). */
export function pinkNoise(lengthSec, rng) {
  const out = silence(lengthSec);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rng.next() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
  }
  return out;
}

/** Brown (red) noise, leaky-integrated white noise. */
export function brownNoise(lengthSec, rng) {
  const out = silence(lengthSec);
  let v = 0;
  for (let i = 0; i < out.length; i++) {
    v = v * 0.998 + (rng.next() * 2 - 1) * 0.06;
    out[i] = v;
  }
  return out;
}

function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

/**
 * Band-limited oscillator.
 * @param {number} lengthSec
 * @param {number | ((t: number) => number)} freq Hz, constant or function of time (seconds)
 * @param {'sine'|'saw'|'square'|'tri'} type
 * @param {number} [phase0] initial phase in cycles
 * @param {number} [pulseWidth] duty cycle for square
 */
export function osc(lengthSec, freq, type = 'sine', phase0 = 0, pulseWidth = 0.5) {
  const out = silence(lengthSec);
  const f = typeof freq === 'function' ? freq : () => freq;
  let ph = phase0 % 1;
  // Start the integrated-square triangle at its true value for the initial phase (no DC transient).
  let tri = ph < 0.5 ? -1 + 4 * ph : 3 - 4 * ph;
  for (let i = 0; i < out.length; i++) {
    const hz = f(i / SR);
    const dt = Math.min(0.5, Math.abs(hz) / SR);
    let v;
    switch (type) {
      case 'sine':
        v = Math.sin(2 * Math.PI * ph);
        break;
      case 'saw':
        v = 2 * ph - 1 - polyBlep(ph, dt);
        break;
      case 'square': {
        v = ph < pulseWidth ? 1 : -1;
        v += polyBlep(ph, dt);
        v -= polyBlep((ph + 1 - pulseWidth) % 1, dt);
        break;
      }
      case 'tri': {
        let sq = ph < 0.5 ? 1 : -1;
        sq += polyBlep(ph, dt);
        sq -= polyBlep((ph + 0.5) % 1, dt);
        tri = dt * sq * 4 + (1 - dt * 0.05) * tri; // leaky integrated square
        v = tri;
        break;
      }
      default:
        throw new Error(`unknown osc type ${type}`);
    }
    out[i] = v;
    ph += hz / SR;
    ph -= Math.floor(ph);
  }
  return out;
}

/** Sum of sine partials: [[ratio, amp, decayTauSec?], ...] over a fundamental. Good for bells/chimes. */
export function additive(lengthSec, f0, partials) {
  const out = silence(lengthSec);
  for (const [ratio, amp, tau] of partials) {
    const w = (2 * Math.PI * f0 * ratio) / SR;
    for (let i = 0; i < out.length; i++) {
      const e = tau ? Math.exp(-i / (tau * SR)) : 1;
      out[i] += Math.sin(w * i) * amp * e;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Filters (RBJ biquads, transposed direct form II)
// ---------------------------------------------------------------------------

function biquadCoeffs(type, freq, q, gainDb) {
  const f = clamp(freq, 10, SR * 0.49);
  const w0 = (2 * Math.PI * f) / SR;
  const cw = Math.cos(w0);
  const sw = Math.sin(w0);
  const alpha = sw / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lowpass':
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
      break;
    case 'highpass':
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
      break;
    case 'bandpass':
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
      break;
    case 'notch':
      b0 = 1; b1 = -2 * cw; b2 = 1;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
      break;
    case 'peaking':
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
      break;
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 - (A - 1) * cw + s);
      b1 = 2 * A * (A - 1 - (A + 1) * cw);
      b2 = A * (A + 1 - (A - 1) * cw - s);
      a0 = A + 1 + (A - 1) * cw + s;
      a1 = -2 * (A - 1 + (A + 1) * cw);
      a2 = A + 1 + (A - 1) * cw - s;
      break;
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * (A + 1 + (A - 1) * cw + s);
      b1 = -2 * A * (A - 1 + (A + 1) * cw);
      b2 = A * (A + 1 + (A - 1) * cw - s);
      a0 = A + 1 - (A - 1) * cw + s;
      a1 = 2 * (A - 1 - (A + 1) * cw);
      a2 = A + 1 - (A - 1) * cw - s;
      break;
    }
    default:
      throw new Error(`unknown filter type ${type}`);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/**
 * Biquad filter. `freq` may be a function of time (seconds) for sweeps
 * (coefficients are recomputed every 16 samples).
 */
export function filter(x, type, freq, q = Math.SQRT1_2, gainDb = 0) {
  const out = new Float32Array(x.length);
  const dynamic = typeof freq === 'function';
  let [b0, b1, b2, a1, a2] = biquadCoeffs(type, dynamic ? freq(0) : freq, q, gainDb);
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    if (dynamic && (i & 15) === 0) [b0, b1, b2, a1, a2] = biquadCoeffs(type, freq(i / SR), q, gainDb);
    const v = x[i];
    const y = b0 * v + z1;
    z1 = b1 * v - a1 * y + z2;
    z2 = b2 * v - a2 * y;
    out[i] = y;
  }
  return out;
}

export const lowpass = (x, f, q) => filter(x, 'lowpass', f, q);
export const highpass = (x, f, q) => filter(x, 'highpass', f, q);
export const bandpass = (x, f, q = 1) => filter(x, 'bandpass', f, q);
export const peakEq = (x, f, gainDb, q = 1) => filter(x, 'peaking', f, q, gainDb);
export const lowShelf = (x, f, gainDb, q = Math.SQRT1_2) => filter(x, 'lowshelf', f, q, gainDb);
export const highShelf = (x, f, gainDb, q = Math.SQRT1_2) => filter(x, 'highshelf', f, q, gainDb);

/** Steeper 4th-order Butterworth-ish lowpass/highpass (two cascaded biquads). */
export const lowpass4 = (x, f) => lowpass(lowpass(x, f, 0.5412), f, 1.3066);
export const highpass4 = (x, f) => highpass(highpass(x, f, 0.5412), f, 1.3066);

// ---------------------------------------------------------------------------
// Non-linear
// ---------------------------------------------------------------------------

/** tanh saturation with makeup so small signals keep unity gain. */
export function saturate(x, drive = 2, mixAmt = 1) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const s = Math.tanh(x[i] * drive) / drive;
    out[i] = x[i] * (1 - mixAmt) + s * mixAmt;
  }
  return out;
}

/** Asymmetric saturation (adds even harmonics, "tearing" character). */
export function saturateAsym(x, drive = 2, bias = 0.3) {
  const out = new Float32Array(x.length);
  const off = Math.tanh(bias);
  for (let i = 0; i < x.length; i++) out[i] = (Math.tanh(x[i] * drive + bias) - off) / drive;
  return out;
}

export function hardClip(x, ceil = 1) {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = clamp(x[i], -ceil, ceil);
  return out;
}

/** Bit/sample-rate crush for radio grit. */
export function crush(x, bits = 8, holdSamples = 1) {
  const out = new Float32Array(x.length);
  const q = Math.pow(2, bits - 1);
  let held = 0;
  for (let i = 0; i < x.length; i++) {
    if (i % holdSamples === 0) held = Math.round(x[i] * q) / q;
    out[i] = held;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resampling / pitch
// ---------------------------------------------------------------------------

function hermite(x, pos) {
  const i = Math.floor(pos);
  const f = pos - i;
  const xm1 = x[i - 1] ?? 0, x0 = x[i] ?? 0, x1 = x[i + 1] ?? 0, x2 = x[i + 2] ?? 0;
  const c = (x1 - xm1) * 0.5;
  const v = x0 - x1;
  const w = c + v;
  const a = w + v + (x2 - x0) * 0.5;
  const b = w + a;
  return ((a * f - b) * f + c) * f + x0;
}

/**
 * Play the signal back at `rate` (2 = one octave up and half as long).
 * Anti-aliased with a lowpass when rate > 1.
 */
export function resample(x, rate) {
  const src = rate > 1 ? lowpass4(x, (SR / 2 / rate) * 0.9) : x;
  const n = Math.floor(x.length / rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = hermite(src, i * rate);
  return out;
}

/** Variable-rate playback: rateFn(t) gives the playback rate at output time t (seconds). */
export function varispeed(x, rateFn, maxLengthSec = 60) {
  const out = [];
  let pos = 0;
  let i = 0;
  const lim = secs(maxLengthSec);
  while (pos < x.length - 1 && i < lim) {
    out.push(hermite(x, pos));
    pos += rateFn(i / SR);
    i++;
  }
  return Float32Array.from(out);
}

// ---------------------------------------------------------------------------
// Delay & reverb
// ---------------------------------------------------------------------------

/** Feedback echo (mono). */
export function echo(x, delaySec, feedback = 0.35, wet = 0.4, tailSec = 1.5, lpHz = 4000) {
  const d = Math.max(1, secs(delaySec));
  const out = fit(x, x.length + secs(tailSec));
  const buf = new Float32Array(d);
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * lpHz) / SR);
  for (let i = 0; i < out.length; i++) {
    const delayed = buf[i % d];
    lp = delayed * (1 - a) + lp * a;
    buf[i % d] = (i < x.length ? x[i] : 0) + lp * feedback;
    out[i] = (i < x.length ? x[i] : 0) + lp * wet;
  }
  return out;
}

const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNING = [556, 441, 341, 225];
const STEREO_SPREAD = 23;

/**
 * Freeverb (Jezar's public-domain algorithm). Mono or stereo in → stereo out.
 * @param {Float32Array | Float32Array[]} input
 * @param {{ room?: number, damp?: number, wet?: number, dry?: number, width?: number, tailSec?: number, preDelaySec?: number }} o
 * @returns {Float32Array[]} [L, R]
 */
export function reverb(input, o = {}) {
  const chs = Array.isArray(input) ? input : [input];
  const inL = chs[0];
  const inR = chs[1] ?? chs[0];
  const room = (o.room ?? 0.6) * 0.28 + 0.7;
  const damp = (o.damp ?? 0.4) * 0.4;
  const wet = o.wet ?? 0.3;
  const dry = o.dry ?? 1;
  const width = o.width ?? 1;
  const pre = secs(o.preDelaySec ?? 0);
  const n = inL.length + secs(o.tailSec ?? 2) + pre;
  const wet1 = wet * (width / 2 + 0.5);
  const wet2 = wet * ((1 - width) / 2);
  const mk = (spread) => ({
    combs: COMB_TUNING.map((t) => ({ buf: new Float32Array(t + spread), i: 0, store: 0 })),
    aps: ALLPASS_TUNING.map((t) => ({ buf: new Float32Array(t + spread), i: 0 })),
  });
  const L = mk(0);
  const R = mk(STEREO_SPREAD);
  const run = (net, v) => {
    let acc = 0;
    for (const c of net.combs) {
      const y = c.buf[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = v + c.store * room;
      if (++c.i >= c.buf.length) c.i = 0;
      acc += y;
    }
    for (const a of net.aps) {
      const b = a.buf[a.i];
      const y = -acc + b;
      a.buf[a.i] = acc + b * 0.5;
      if (++a.i >= a.buf.length) a.i = 0;
      acc = y;
    }
    return acc;
  };
  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i - pre;
    const l = j >= 0 && j < inL.length ? inL[j] : 0;
    const r = j >= 0 && j < inR.length ? inR[j] : 0;
    const v = (l + r) * 0.015;
    const yl = run(L, v);
    const yr = run(R, v);
    const dl = i < inL.length ? inL[i] : 0;
    const dr = i < inR.length ? inR[i] : 0;
    outL[i] = yl * wet1 + yr * wet2 + dl * dry;
    outR[i] = yr * wet1 + yl * wet2 + dr * dry;
  }
  return [outL, outR];
}

/** Collapse stereo to mono. */
export function toMono(chs) {
  if (!Array.isArray(chs)) return chs;
  if (chs.length === 1) return chs[0];
  const out = new Float32Array(chs[0].length);
  for (let i = 0; i < out.length; i++) out[i] = (chs[0][i] + chs[1][i]) * 0.5;
  return out;
}

/** Equal-power pan of a mono signal: pan in [-1, 1]. */
export function pan(x, p = 0) {
  const a = ((p + 1) * Math.PI) / 4;
  return [scale(x, Math.cos(a) * Math.SQRT2), scale(x, Math.sin(a) * Math.SQRT2)];
}

/** Apply a mono → mono function to each channel. */
export function eachChannel(chs, fn) {
  return chs.map((c, i) => fn(c, i));
}

/** Mix stereo layers: [[L,R] | mono, offsetSec, gain][] into a stereo buffer. */
export function mixStereo(lengthSec, layers) {
  const L = silence(lengthSec);
  const R = silence(lengthSec);
  for (const [sig, at = 0, g = 1] of layers) {
    const chs = Array.isArray(sig) ? sig : [sig, sig];
    mixInto(L, chs[0], secs(at), g);
    mixInto(R, chs[1] ?? chs[0], secs(at), g);
  }
  return [L, R];
}

// ---------------------------------------------------------------------------
// Dynamics
// ---------------------------------------------------------------------------

/**
 * Look-ahead brickwall limiter over all channels (linked).
 * @param {Float32Array[]} chs
 * @param {number} ceilingDb
 * @param {number} lookaheadMs
 * @param {number} releaseMs
 */
export function limit(chs, ceilingDb = -1, lookaheadMs = 2, releaseMs = 60) {
  const n = chs[0].length;
  const ceil = dbToGain(ceilingDb);
  const la = Math.max(1, Math.round((lookaheadMs / 1000) * SR));
  const req = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const c of chs) m = Math.max(m, Math.abs(c[i]));
    req[i] = m > ceil ? ceil / m : 1;
  }
  // Forward-looking min filter (monotonic deque): mn[i] = min(req[i .. i+la]).
  const mn = new Float32Array(n);
  const dq = new Int32Array(n + la + 1);
  let head = 0, tail = 0;
  for (let j = 0; j < n + la; j++) {
    if (j < n) {
      while (tail > head && req[dq[tail - 1]] >= req[j]) tail--;
      dq[tail++] = j;
    }
    const i = j - la;
    if (i >= 0) {
      while (dq[head] < i) head++;
      mn[i] = req[dq[head]];
    }
  }
  // Moving average over the trailing la samples smooths the attack while staying ≤ required gain.
  const sm = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += mn[i];
    if (i >= la) acc -= mn[i - la];
    sm[i] = acc / Math.min(i + 1, la);
  }
  const rel = Math.exp(-1 / ((releaseMs / 1000) * SR));
  let env = 1;
  const out = chs.map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const target = Math.min(sm[i], mn[i]);
    env = target < env ? target : target + (env - target) * rel;
    for (let c = 0; c < chs.length; c++) out[c][i] = clamp(chs[c][i] * env, -ceil, ceil);
  }
  return out;
}

/** Simple feed-forward compressor (RMS detector), linked across channels. */
export function compress(chs, thresholdDb = -18, ratio = 4, attackMs = 5, releaseMs = 120, makeupDb = 0) {
  const n = chs[0].length;
  const at = Math.exp(-1 / ((attackMs / 1000) * SR));
  const rt = Math.exp(-1 / ((releaseMs / 1000) * SR));
  let env = 0;
  const mk = dbToGain(makeupDb);
  const out = chs.map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const c of chs) s = Math.max(s, c[i] * c[i]);
    const coef = s > env ? at : rt;
    env = s + (env - s) * coef;
    const lvl = 10 * Math.log10(env + 1e-12);
    const over = lvl - thresholdDb;
    const g = over > 0 ? dbToGain(-over * (1 - 1 / ratio)) : 1;
    for (let c = 0; c < chs.length; c++) out[c][i] = chs[c][i] * g * mk;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Loops
// ---------------------------------------------------------------------------

/**
 * Run `fn` on a periodic signal so filter/reverb state wraps around seamlessly:
 * the loop is tiled `reps` times, processed, and the last period returned.
 * `fn` maps Float32Array[] → Float32Array[] (same length or longer).
 */
export function processPeriodic(chs, fn, reps = 3) {
  const n = chs[0].length;
  const tiled = chs.map((c) => {
    const t = new Float32Array(n * reps);
    for (let r = 0; r < reps; r++) t.set(c, r * n);
    return t;
  });
  const y = fn(tiled);
  // Fold any tail beyond the tiled length back onto the period as well.
  return y.map((c) => {
    const out = new Float32Array(n);
    out.set(c.subarray((reps - 1) * n, reps * n));
    for (let i = reps * n; i < c.length; i++) out[(i - reps * n) % n] += c[i];
    return out;
  });
}

/**
 * Cut a seamless loop of `loopLen` samples from a longer render by crossfading
 * the material after the loop end into the loop start (equal power).
 */
export function loopCrossfade(chs, loopLen, xfadeLen) {
  return chs.map((c) => {
    if (c.length < loopLen + xfadeLen) throw new Error('loopCrossfade: input too short');
    const out = c.slice(0, loopLen);
    for (let i = 0; i < xfadeLen; i++) {
      const t = i / xfadeLen;
      const gin = Math.sin((t * Math.PI) / 2);
      const gout = Math.cos((t * Math.PI) / 2);
      out[i] = c[i] * gin + c[loopLen + i] * gout;
    }
    return out;
  });
}

// ---------------------------------------------------------------------------
// Trimming
// ---------------------------------------------------------------------------

/** Remove leading samples quieter than thresholdDb (relative to full scale), keeping `keepMs` of pre-roll. */
export function trimLeading(chs, thresholdDb = -60, keepMs = 1) {
  const th = dbToGain(thresholdDb);
  const n = chs[0].length;
  let first = n;
  for (const c of chs) {
    for (let i = 0; i < n; i++) {
      if (Math.abs(c[i]) > th) {
        first = Math.min(first, i);
        break;
      }
    }
  }
  const start = Math.max(0, first - Math.round((keepMs / 1000) * SR));
  return chs.map((c) => c.slice(start));
}

/** Remove trailing samples quieter than thresholdDb and fade the last `fadeMs`. */
export function trimTrailing(chs, thresholdDb = -66, fadeMs = 20) {
  const th = dbToGain(thresholdDb);
  const n = chs[0].length;
  let last = 0;
  for (const c of chs) {
    for (let i = n - 1; i >= 0; i--) {
      if (Math.abs(c[i]) > th) {
        last = Math.max(last, i);
        break;
      }
    }
  }
  const end = Math.min(n, last + 1 + Math.round((fadeMs / 1000) * SR));
  return chs.map((c) => fadeOut(c.slice(0, end), fadeMs / 1000, 'lin'));
}

/** Drop everything before the first sample within `relDb` of the peak (keeping `preMs` of pre-roll). */
export function trimStart(x, relDb = -30, preMs = 1) {
  const th = peak(x) * dbToGain(relDb);
  let i = 0;
  while (i < x.length && Math.abs(x[i]) < th) i++;
  return x.slice(Math.max(0, i - Math.round((preMs / 1000) * SR)));
}

/** Synthesized sub "boom": a sine sweeping from f0 down to f1 with exponential decay. */
export function subBoom(lengthSec, f0 = 90, f1 = 35, sweepTau = 0.08, decayTau = 0.35) {
  const s = osc(lengthSec, (t) => f1 + (f0 - f1) * Math.exp(-t / sweepTau), 'sine');
  return applyEnv(s, adEnv(lengthSec, 0.003, decayTau));
}

/** Granular debris patter: sparse random clicks through a band-pass, decaying. */
export function debris(lengthSec, rng, { density = 0.015, lowHz = 1200, highHz = 7000, tau = 0.3 } = {}) {
  const n = secs(lengthSec);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) if (rng.next() < density) x[i] = rng.range(-1, 1);
  const shaped = lowpass(highpass(x, lowHz), highHz);
  return applyEnv(shaped, adEnv(lengthSec, 0.02, tau));
}
