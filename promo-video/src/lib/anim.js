// Timing helpers. Every animated value in the film is a pure function of time,
// so any frame can be rendered independently (and in any order).

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, t0, t1) => clamp((t - t0) / (t1 - t0));

export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2),
  inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  inSine: (x) => 1 - Math.cos((x * Math.PI) / 2),
  outSine: (x) => Math.sin((x * Math.PI) / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  inBack: (x) => 2.70158 * x * x * x - 1.70158 * x * x,
  outBack: (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2),
  outBackSoft: (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2),
};

/** Tween a -> b over [t0, t1]. */
export const tw = (t, t0, t1, a, b, e = ease.inOutCubic) => lerp(a, b, e(prog(t, t0, t1)));

/** Damped spring step response starting at t0 (0 -> 1 with overshoot). */
export function spring(t, t0, freq = 2.4, damp = 0.32) {
  if (t <= t0) return 0;
  const x = t - t0;
  const w = 2 * Math.PI * freq;
  const wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * x) * (Math.cos(wd * x) + ((damp * w) / wd) * Math.sin(wd * x));
}

/** Decaying oscillation kicked at t0 (for impacts, jiggles and follow-through). */
export function wobble(t, t0, freq = 3, decay = 5, amp = 1) {
  if (t < t0) return 0;
  const x = t - t0;
  return amp * Math.sin(2 * Math.PI * freq * x) * Math.exp(-decay * x);
}

/** 0 -> 1 -> 0 bump over [t0, t1]. */
export const bump = (t, t0, t1) => Math.sin(Math.PI * prog(t, t0, t1));

/** Keyframes [[time, value(s), ease?], ...]; the ease on a key shapes the segment arriving at it. */
export function keys(t, frames, def = ease.inOutCubic) {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 0; i < frames.length - 1; i++) {
    const [t0, v0] = frames[i];
    const [t1, v1, e1] = frames[i + 1];
    if (t <= t1) {
      const p = (e1 || def)(prog(t, t0, t1));
      return Array.isArray(v0) ? v0.map((v, k) => lerp(v, v1[k], p)) : lerp(v0, v1, p);
    }
  }
  return frames[frames.length - 1][1];
}

/** Ballistic hop: returns { y, squash } for a jump from t0 lasting dur. */
export function hop(t, t0, dur, height) {
  const pre = 0.1; // anticipation crouch
  const land = 0.16; // landing squash recovery
  let y = 0;
  let squash = 1;
  if (t > t0 - pre && t < t0) squash = 1 - 0.14 * ease.outQuad(prog(t, t0 - pre, t0));
  if (t >= t0 && t <= t0 + dur) {
    const p = (t - t0) / dur;
    y = 4 * height * p * (1 - p);
    squash = 1 + 0.12 * Math.max(0, 1 - p * 2.2) - 0.04 * Math.max(0, p * 2 - 1.2);
  }
  if (t > t0 + dur && t < t0 + dur + land) squash = 1 - 0.13 * bump(t, t0 + dur - 0.02, t0 + dur + land);
  return { y, squash };
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise in [-1, 1], used for organic drift. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n) => {
    const s = Math.sin((n + seed * 157.31) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}
