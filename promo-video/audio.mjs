// Synthesizes the soundtrack and sound design (48 kHz stereo WAV), locked to the animation's beats.
//   node audio.mjs            -> out/audio.wav
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { keystrokeTimes, MESSAGE_AT, DIGITS_AT, DIGIT_GAP } from './src/world/screens.js';
import { BEATS } from './src/timeline.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const DUR = 20;
const N = SR * DUR;
const TAU = Math.PI * 2;
const L = new Float32Array(N);
const R = new Float32Array(N);
const VL = new Float32Array(N); // reverb send
const VR = new Float32Array(N);
const duck = new Float32Array(N).fill(1); // kick sidechain for pads and keys

let seed = 20261111;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;
const human = (amt = 0.004) => (rand() * 2 - 1) * amt; // small timing drift so nothing feels quantized
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp1 = (x) => Math.max(-1, Math.min(1, x));

function synth(dur, fn) {
  const n = Math.round(dur * SR);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) b[i] = fn(i / SR, i);
  return b;
}

function place(buf, t0, { gain = 1, pan = 0, send = 0, ducked = false } = {}) {
  const start = Math.round(t0 * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4) * gain;
  const gr = Math.sin(((pan + 1) * Math.PI) / 4) * gain;
  for (let i = 0; i < buf.length; i++) {
    const j = start + i;
    if (j < 0) continue;
    if (j >= N) break;
    const s = ducked ? buf[i] * duck[j] : buf[i];
    L[j] += s * gl;
    R[j] += s * gr;
    if (send) {
      VL[j] += s * gl * send;
      VR[j] += s * gr * send;
    }
  }
}

function coeffs(type, f, q = 0.707) {
  const w = (TAU * Math.min(f, SR * 0.45)) / SR;
  const cs = Math.cos(w);
  const a = Math.sin(w) / (2 * q);
  let b0;
  let b1;
  let b2;
  if (type === 'lp') [b0, b1, b2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2];
  else if (type === 'hp') [b0, b1, b2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2];
  else [b0, b1, b2] = [a, 0, -a];
  const a0 = 1 + a;
  return [b0 / a0, b1 / a0, b2 / a0, (-2 * cs) / a0, (1 - a) / a0];
}

/** Biquad filter in place; f may be a function of time for sweeps. */
function filter(buf, type, f, q) {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  let c = coeffs(type, typeof f === 'function' ? f(0) : f, q);
  for (let i = 0; i < buf.length; i++) {
    if (typeof f === 'function' && i % 32 === 0) c = coeffs(type, f(i / SR), q);
    const x = buf[i];
    const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    buf[i] = y;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Instruments
function kick(level = 1) {
  let ph = 0;
  const b = synth(0.5, (t) => {
    ph += (TAU * (46 + 115 * Math.exp(-t / 0.03))) / SR;
    return Math.sin(ph) * Math.exp(-t / 0.17) * Math.min(1, t / 0.0015);
  });
  const click = filter(synth(0.012, (t) => noise() * Math.exp(-t / 0.0016)), 'hp', 1800);
  for (let i = 0; i < click.length; i++) b[i] += click[i] * 0.3;
  return b.map((x) => Math.tanh(x * 1.5) * level);
}

function clap(level = 1) {
  const b = synth(0.32, (t) => {
    let e = 0;
    for (const o of [0, 0.011, 0.023]) if (t >= o) e = Math.max(e, Math.exp(-(t - o) / 0.007));
    if (t > 0.023) e = Math.max(e, 0.55 * Math.exp(-(t - 0.023) / 0.12));
    return noise() * e;
  });
  filter(b, 'bp', 1250, 0.8);
  filter(b, 'hp', 450);
  return b.map((x) => x * level);
}

function hat(open = false, level = 1) {
  const b = synth(open ? 0.32 : 0.07, (t) => noise() * Math.exp(-t / (open ? 0.11 : 0.02)));
  filter(b, 'hp', 7200);
  filter(b, 'lp', 13000);
  return b.map((x) => x * level);
}

function shaker(level = 1) {
  const b = synth(0.09, (t) => noise() * Math.min(1, t / 0.014) * Math.exp(-t / 0.028));
  filter(b, 'bp', 5600, 1.3);
  return b.map((x) => x * level);
}

function epiano(m, dur, vel = 1) {
  const f = mtof(m);
  let pc = 0;
  let pm = 0;
  let pt = 0;
  return synth(dur + 0.9, (t) => {
    pc += (TAU * f) / SR;
    pm += (TAU * f) / SR;
    pt += (TAU * f * 14) / SR;
    const index = 1.5 * Math.exp(-t / 0.22) + 0.22;
    const tine = 0.8 * Math.exp(-t / 0.025);
    const s = Math.sin(pc + index * Math.sin(pm) + tine * Math.sin(pt));
    const env = Math.min(1, t / 0.003) * Math.exp(-t / 0.95) * (t > dur ? Math.exp(-((t - dur) / 0.09)) : 1);
    return s * env * vel;
  });
}

function marimba(m, vel = 1, decay = 0.36) {
  const f = mtof(m);
  let p1 = 0;
  let p4 = 0;
  let p9 = 0;
  return synth(decay * 5, (t) => {
    p1 += (TAU * f) / SR;
    p4 += (TAU * f * 3.93) / SR;
    p9 += (TAU * f * 9.2) / SR;
    return (
      Math.min(1, t / 0.0015) *
      vel *
      (Math.sin(p1) * Math.exp(-t / decay) + 0.3 * Math.sin(p4) * Math.exp(-t / (decay * 0.22)) + 0.07 * Math.sin(p9) * Math.exp(-t / 0.01))
    );
  });
}

function bell(m, vel = 1, len = 1.1) {
  const f = mtof(m);
  const parts = [
    [1, 1, len],
    [2.0, 0.42, len * 0.6],
    [2.76, 0.3, len * 0.42],
    [5.4, 0.14, len * 0.22],
    [8.93, 0.06, len * 0.1],
  ];
  const ph = parts.map(() => 0);
  return synth(len * 3, (t) => {
    let s = 0;
    parts.forEach(([r, a, d], k) => {
      ph[k] += (TAU * f * r) / SR;
      s += Math.sin(ph[k]) * a * Math.exp(-t / d);
    });
    return s * vel * Math.min(1, t / 0.002);
  });
}

function bass(m, dur, vel = 1) {
  const f = mtof(m);
  let p = 0;
  return synth(dur + 0.09, (t) => {
    p += (TAU * f) / SR;
    const env =
      Math.min(1, t / 0.006) * (0.62 + 0.38 * Math.exp(-t / 0.09)) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.09) : 1);
    const s = Math.sin(p) + 0.3 * Math.sin(2 * p) + 0.09 * Math.sin(3 * p);
    return Math.tanh(1.5 * s * env) * vel;
  });
}

function pad(notes, dur, vel = 1) {
  const att = 0.45;
  const rel = 0.7;
  const voices = [];
  for (const m of notes) for (const cents of [-7, 6]) voices.push({ f: mtof(m) * Math.pow(2, cents / 1200), ph: Array.from({ length: 9 }, () => rand() * TAU) });
  return synth(dur + rel, (t) => {
    const env = Math.min(1, t / att) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
    let s = 0;
    for (const v of voices) {
      for (let k = 1; k <= 7; k++) {
        v.ph[k] += (TAU * v.f * k) / SR;
        s += Math.sin(v.ph[k]) / Math.pow(k, 1.7);
      }
    }
    return (s * env * vel) / voices.length;
  });
}

function whoosh(dur, f0, f1, q = 1.1, shape = (p) => Math.sin(Math.PI * p)) {
  const b = synth(dur, (t) => noise() * shape(t / dur));
  return filter(b, 'bp', (t) => f0 * Math.pow(f1 / f0, t / dur), q);
}

function riser(dur, level = 1) {
  const b = synth(dur, (t) => noise() * Math.pow(t / dur, 2.4));
  filter(b, 'bp', (t) => 350 * Math.pow(18, t / dur), 1.8);
  let p = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    p += (TAU * (220 * Math.pow(3, t / dur))) / SR;
    b[i] += 0.12 * Math.sin(p) * Math.pow(t / dur, 3);
  }
  return b.map((x) => x * level);
}

function blip(f0, f1, dur, decay, level = 1) {
  let p = 0;
  return synth(dur, (t) => {
    p += (TAU * f0 * Math.pow(f1 / f0, Math.min(1, t / dur))) / SR;
    return Math.sin(p) * Math.exp(-t / decay) * Math.min(1, t / 0.002) * level;
  });
}

function boing(f, level = 1) {
  let p = 0;
  return synth(0.34, (t) => {
    const ff = f * (1 + 0.3 * Math.sin(TAU * 10 * t) * Math.exp(-t * 8)) * (1 + 0.45 * Math.exp(-t * 22));
    p += (TAU * ff) / SR;
    return Math.sin(p) * Math.exp(-t / 0.11) * Math.min(1, t / 0.004) * level;
  });
}

function tick(level = 1, hp = 2200, decay = 0.0018) {
  const b = synth(0.025, (t) => noise() * Math.exp(-t / decay));
  filter(b, 'hp', hp);
  return b.map((x) => x * level);
}

function keyClick(i) {
  const tone = 150 + (i % 5) * 17;
  let p = 0;
  const b = synth(0.05, (t) => {
    p += (TAU * tone) / SR;
    return 0.45 * Math.sin(p) * Math.exp(-t / 0.011) + 0.75 * noise() * Math.exp(-t / 0.0035);
  });
  filter(b, 'hp', 260);
  filter(b, 'lp', 7000);
  return b;
}

function buzz(dur) {
  let p = 0;
  const b = synth(dur, (t) => {
    p += (TAU * 152) / SR;
    const sq = Math.sin(p) + Math.sin(3 * p) / 3 + Math.sin(5 * p) / 5;
    return sq * (0.6 + 0.4 * Math.sin(TAU * 31 * t)) * Math.min(1, t / 0.01) * Math.min(1, (dur - t) / 0.02);
  });
  return filter(b, 'lp', 1600);
}

function crash(len = 1.8, level = 1) {
  const b = synth(len, (t) => noise() * Math.exp(-t / (len * 0.33)) * Math.min(1, t / 0.004));
  filter(b, 'hp', 4800);
  filter(b, 'lp', 12000);
  return b.map((x) => x * level);
}

function thump(f = 55, level = 1) {
  let p = 0;
  return synth(0.7, (t) => {
    p += (TAU * (f + 90 * Math.exp(-t / 0.04))) / SR;
    return Math.tanh(1.8 * Math.sin(p) * Math.exp(-t / 0.24)) * Math.min(1, t / 0.002) * level;
  });
}

// ---------------------------------------------------------------------------
// Music: 120 BPM, D major. One bar = 2 s = 16 steps.
const BAR = 2;
const STEP = 0.125;
const at = (bar, step = 0) => bar * BAR + step * STEP;
const BARS = [
  { root: 43, chord: [55, 59, 62, 66, 69] }, // Gmaj9
  { root: 45, chord: [57, 61, 64, 66, 71] }, // A6/9
  { root: 38, chord: [54, 57, 61, 64, 69] }, // Dmaj9  (drop: the send key lands here)
  { root: 47, chord: [57, 61, 62, 66, 69] }, // Bm9
  { root: 43, chord: [55, 59, 62, 66, 69] }, // Gmaj9  (message arrives)
  { root: 45, chord: [57, 62, 64, 67, 69] }, // A7sus4 (tension before verify)
  { root: 38, chord: [54, 57, 61, 64, 69] }, // Dmaj9  (verified)
  { root: 40, chord: [55, 59, 62, 66, 71] }, // Em9
  { root: 43, chord: [55, 59, 62, 66, 69] }, // Gmaj9  (logo assembles)
  { root: 38, chord: [54, 57, 61, 64, 69, 74] }, // Dmaj9 (resolve)
];
const GROOVE = [2, 3, 4, 5, 6, 7];

// Kicks first: they define the sidechain curve the pads and keys duck under.
const kicks = [];
for (const b of GROOVE) for (const s of [0, 4, 8, 12]) kicks.push(at(b, s));
kicks.push(at(9, 0));
for (const k of kicks) {
  place(kick(), k, { gain: 0.85 });
  const s0 = Math.round(k * SR);
  for (let i = 0; i < SR * 0.4 && s0 + i < N; i++) duck[s0 + i] = Math.min(duck[s0 + i], 1 - 0.5 * Math.exp(-i / SR / 0.13));
}

for (const b of GROOVE) {
  for (const s of [4, 12]) place(clap(), at(b, s) + human(), { gain: 0.32, pan: 0.05, send: 0.25 });
  for (const s of [2, 6, 10, 14]) place(hat(s === 14 && b % 2 === 1, 1), at(b, s) + human(0.003), { gain: 0.13, pan: 0.25 });
}
// fill into the verify moment
for (const s of [12, 13, 14, 15]) place(clap(), at(5, s) + human(0.002), { gain: 0.12 + (s - 12) * 0.06, pan: -0.05, send: 0.2 });

// shaker, lightly swung, through intro and groove
for (let b = 0; b <= 8; b++) {
  for (let s = 0; s < 16; s++) {
    const swing = s % 2 ? 0.014 : 0;
    const accent = s % 4 === 2 ? 1 : s % 2 ? 0.55 : 0.75;
    const level = b < 2 ? 0.45 : b === 8 ? 0.35 : 1;
    place(shaker(), at(b, s) + swing + human(0.003), { gain: 0.06 * accent * level, pan: -0.3 });
  }
}

// pads (one per bar, overlapping through their release)
BARS.forEach((bar, i) => {
  const len = i === 9 ? 2.0 : BAR;
  place(pad(bar.chord, len, 1), at(i), { gain: i < 2 ? 0.2 : 0.17, send: 0.45, ducked: true });
});

// electric piano stabs
BARS.forEach((bar, i) => {
  if (i < 2) {
    for (const [s, len, v] of [[0, 0.9, 0.55], [10, 0.5, 0.42]]) for (const m of bar.chord) place(epiano(m, len, v), at(i, s) + human(0.006), { gain: 0.05, pan: -0.15, send: 0.35, ducked: true });
  } else if (i < 8) {
    [[2, 0.9], [6, 0.7], [10, 0.85], [14, 0.68]].forEach(([s, v]) => {
      for (const m of bar.chord.slice(0, 4)) place(epiano(m, 0.17, v), at(i, s) + human(0.005), { gain: 0.06, pan: -0.15, send: 0.3, ducked: true });
    });
  } else {
    for (const m of bar.chord) place(epiano(m, i === 9 ? 1.9 : 1.8, 0.6), at(i) + human(0.008), { gain: 0.06, pan: -0.1, send: 0.45 });
  }
});

// bass
for (const b of GROOVE) {
  const r = BARS[b].root;
  [[0, r, 0.3], [3, r + 12, 0.1], [6, r, 0.2], [8, r, 0.12], [11, r + 7, 0.12], [14, r, 0.2]].forEach(([s, m, len]) =>
    place(bass(m, len, 0.9), at(b, s) + human(0.003), { gain: 0.42, ducked: false }),
  );
}
place(bass(BARS[8].root, 1.9, 0.6), at(8), { gain: 0.36 });
place(bass(BARS[9].root, 1.95, 0.8), at(9), { gain: 0.42 });

// marimba hook
const HOOK = {
  1: [[0, 69], [2, 73], [4, 76], [6, 78], [8, 81], [10, 78], [12, 76], [14, 73]],
  2: [[0, 78], [2, 81], [4, 83], [6, 81], [8, 78], [11, 76], [12, 74], [14, 76]],
  3: [[0, 78], [2, 81], [4, 83], [6, 86], [8, 85], [11, 83], [12, 81], [14, 78]],
  4: [[0, 83], [2, 81], [4, 78], [6, 81], [8, 83], [10, 86], [12, 83], [14, 81]],
  5: [[0, 86], [2, 83], [4, 81], [6, 76], [8, 81], [10, 83], [12, 86], [14, 88]],
  6: [[0, 90], [6, 88], [8, 86], [10, 81], [12, 83], [14, 86]],
  7: [[0, 83], [2, 86], [4, 83], [6, 81], [8, 79], [10, 78], [12, 76], [14, 78]],
};
for (const [b, notes] of Object.entries(HOOK)) {
  notes.forEach(([s, m], k) => {
    const v = (k % 2 ? 0.75 : 1) * (Number(b) === 1 ? 0.6 : 1);
    place(marimba(m, v, s === 0 && Number(b) === 6 ? 0.6 : 0.34), at(Number(b), s) + human(0.004), { gain: 0.15, pan: 0.2, send: 0.3 });
  });
}

// risers and cymbals
place(riser(1.0, 0.5), 3.0, { gain: 0.5, send: 0.2 });
place(riser(1.0, 0.6), 11.0, { gain: 0.5, send: 0.2 });
place(riser(1.0, 0.35), 15.25, { gain: 0.45, send: 0.3 });
place(crash(1.6, 0.6), BEATS.slam, { gain: 0.16, pan: 0.2, send: 0.3 });
place(crash(2.2, 1), BEATS.verify, { gain: 0.2, pan: -0.15, send: 0.35 });
place(crash(2.4, 0.5), at(9), { gain: 0.13, send: 0.4 });

// ---------------------------------------------------------------------------
// Sound design, cued from the animation
keystrokeTimes().forEach((t, i) => place(keyClick(i), t, { gain: 0.11 * (0.75 + rand() * 0.5), pan: -0.35 + rand() * 0.1 }));

place(blip(260, 780, 0.5, 0.25, 0.25), 3.12, { gain: 0.3, pan: -0.3, send: 0.2 }); // wind-up
place(whoosh(0.2, 500, 3000, 1.2), 3.8, { gain: 0.5, pan: -0.25 }); // arm swing
place(thump(52, 1), BEATS.slam, { gain: 0.75 }); // send key
place(tick(0.9, 1200, 0.004), BEATS.slam, { gain: 0.5, pan: -0.2 });
place(blip(360, 1150, 0.08, 0.09, 1), BEATS.emerge + 0.02, { gain: 0.32, pan: 0.1, send: 0.3 }); // pop
place(bell(100, 0.5, 0.25), 4.43, { gain: 0.12, pan: 0.2, send: 0.4 }); // wink sparkle
place(bell(107, 0.35, 0.2), 4.47, { gain: 0.1, pan: 0.25, send: 0.4 });
place(whoosh(0.55, 400, 2600, 1.0, (p) => Math.pow(Math.sin(Math.PI * p), 1.5)), BEATS.fly0 - 0.08, { gain: 0.5, pan: -0.2 });

// airy flight whoosh, panning with Bubbly
{
  const len = BEATS.fly1 - BEATS.fly0;
  const b = synth(len, (t) => {
    const p = t / len;
    return noise() * (0.25 + 0.75 * Math.sin(Math.PI * p)) * (0.7 + 0.3 * Math.sin(TAU * 1.6 * t));
  });
  filter(b, 'bp', (t) => 900 + 600 * Math.sin(TAU * 0.8 * t) + 500 * (t / len), 0.9);
  const start = Math.round(BEATS.fly0 * SR);
  for (let i = 0; i < b.length && start + i < N; i++) {
    const pan = -0.6 + 1.2 * (i / b.length);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    L[start + i] += b[i] * 0.16 * gl;
    R[start + i] += b[i] * 0.16 * gr;
  }
}
// trail dots pop out on a D major pentatonic run
const PENTA = [74, 76, 78, 81, 83, 86, 88, 90];
for (let i = 0; i < 16; i++) {
  const u = 0.05 + (i * 0.75) / 15;
  const born = BEATS.fly0 + (BEATS.fly1 - BEATS.fly0) * (Math.acos(1 - 2 * u) / Math.PI);
  place(marimba(PENTA[i % 8] + (i >= 8 ? 0 : 0), 0.5, 0.12), born, { gain: 0.07, pan: -0.5 + i / 16, send: 0.3 });
}

place(whoosh(0.22, 2400, 500, 1.3), BEATS.fly1 - 0.05, { gain: 0.45, pan: 0.3 }); // dive into the phone
place(buzz(0.17), 8.0, { gain: 0.16, pan: 0.25 });
place(buzz(0.16), 8.24, { gain: 0.14, pan: 0.25 });
place(bell(86, 0.8, 0.9), MESSAGE_AT + 0.01, { gain: 0.2, pan: 0.2, send: 0.35 }); // notification chime
place(bell(93, 0.8, 1.1), MESSAGE_AT + 0.11, { gain: 0.2, pan: 0.25, send: 0.35 });

const HOPS = [8.28, 12.08, 12.62, 14.25, 14.5, 14.82];
HOPS.forEach((t, i) => place(boing(i % 2 ? 330 : 280, 1), t - 0.02, { gain: 0.1, pan: i === 3 || i === 5 ? -0.4 : 0.35, send: 0.2 }));

// digits fly into the card: a swish out, a wood-block landing climbing the scale
const LAND = [74, 76, 78, 81, 83, 86];
for (let i = 0; i < 6; i++) {
  const t0 = DIGITS_AT + i * DIGIT_GAP;
  place(whoosh(0.16, 1200, 4200, 1.4), t0, { gain: 0.2, pan: -0.1 + i * 0.08 });
  place(marimba(LAND[i], 0.9, 0.1), t0 + 0.55, { gain: 0.2, pan: -0.1 + i * 0.1, send: 0.2 });
  place(tick(0.6, 3000, 0.0012), t0 + 0.55, { gain: 0.25, pan: -0.1 + i * 0.1 });
  place(tick(0.3, 6000, 0.0008), 11.3 + i * 0.07, { gain: 0.15, pan: -0.2 + i * 0.08 }); // scan
}

// verified: impact, bright strum, confetti crackle
place(thump(58, 1), BEATS.verify, { gain: 0.55 });
[86, 90, 93, 98].forEach((m, k) => place(bell(m, 0.7, 1.0), BEATS.verify + 0.02 + k * 0.035, { gain: 0.13, pan: -0.25 + k * 0.15, send: 0.4 }));
for (let k = 0; k < 46; k++) {
  const t = BEATS.verify + 0.04 + Math.pow(rand(), 1.8) * 1.1;
  place(tick(0.5 + rand() * 0.5, 2500 + rand() * 4000, 0.001 + rand() * 0.0015), t, { gain: 0.06, pan: rand() * 1.4 - 0.7, send: 0.15 });
}
place(blip(380, 1200, 0.08, 0.09, 1), 12.27, { gain: 0.26, pan: 0.15, send: 0.3 }); // Bubbly pops back out

// logo: dots land on an ascending scale, then the lockup lands
const RING_NOTES = [74, 76, 78, 79, 81, 83, 85, 86];
RING_NOTES.forEach((m, i) => place(marimba(m, 0.9, 0.3), BEATS.ringArrive0 + i * BEATS.ringGap, { gain: 0.2, pan: Math.sin((i * Math.PI) / 4) * 0.5, send: 0.4 }));
place(whoosh(0.5, 300, 1800, 0.9, (p) => Math.pow(p, 2)), BEATS.logo - 0.5, { gain: 0.3, send: 0.3 });
place(thump(48, 0.8), BEATS.logo, { gain: 0.45 });
[74, 78, 81, 86].forEach((m) => place(bell(m, 0.5, 1.6), BEATS.logo + 0.01, { gain: 0.07, send: 0.5 }));
place(whoosh(0.3, 800, 3000, 1.2), 17.05, { gain: 0.18, pan: 0.2 }); // wordmark wipe
place(blip(600, 1400, 0.06, 0.06, 1), 17.66, { gain: 0.16, send: 0.2 }); // button pop
place(tick(0.8, 1800, 0.0025), 18.44, { gain: 0.3, pan: 0.05 }); // mouse down
place(tick(0.5, 2600, 0.002), 18.53, { gain: 0.22, pan: 0.05 }); // mouse up

// ---------------------------------------------------------------------------
// Reverb (Freeverb-style), master bus, write
function reverb(inL, inR, room = 0.83, damp = 0.3) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
  const allp = [556, 441, 341, 225];
  return [inL, inR].map((inp, ch) => {
    const spread = ch ? 23 : 0;
    const cs = combs.map((n) => ({ buf: new Float32Array(Math.round(((n + spread) * SR) / 44100)), i: 0, z: 0 }));
    const as = allp.map((n) => ({ buf: new Float32Array(Math.round(((n + spread) * SR) / 44100)), i: 0 }));
    const out = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const x = inp[j] * 0.015;
      let y = 0;
      for (const c of cs) {
        const o = c.buf[c.i];
        c.z = o * (1 - damp) + c.z * damp;
        c.buf[c.i] = x + c.z * room;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      for (const a of as) {
        const o = a.buf[a.i];
        const v = o - y;
        a.buf[a.i] = y + o * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        y = v;
      }
      out[j] = y;
    }
    return out;
  });
}

const [WL, WR] = reverb(VL, VR);
let peak = 0;
for (let j = 0; j < N; j++) {
  const t = j / SR;
  const fade = Math.min(1, t / 0.05) * (t > 19.1 ? Math.max(0, 1 - (t - 19.1) / 0.9) : 1);
  L[j] = Math.tanh((L[j] + WL[j] * 1.6) * 1.1) * fade;
  R[j] = Math.tanh((R[j] + WR[j] * 1.6) * 1.1) * fade;
  peak = Math.max(peak, Math.abs(L[j]), Math.abs(R[j]));
}
const norm = 0.89 / peak;

const out = path.join(here, 'out/audio.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let j = 0; j < N; j++) {
  buf.writeInt16LE(Math.round(clamp1(L[j] * norm) * 32767), 44 + j * 4);
  buf.writeInt16LE(Math.round(clamp1(R[j] * norm) * 32767), 46 + j * 4);
}
fs.writeFileSync(out, buf);
console.log(`wrote ${path.relative(here, out)} (peak before normalize ${peak.toFixed(3)})`);
