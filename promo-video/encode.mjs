// Encodes the rendered frames and soundtrack into the web-ready MP4 and poster in web/public/promo.
//   node encode.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../web/public/promo');
const frames = path.join(here, 'out/frames');
const audio = path.join(here, 'out/audio.wav');
const TARGET_LUFS = -15;
const POSTER_FRAME = 586; // clean end-card lockup: cursor gone, fade not started

if (!fs.existsSync(path.join(frames, 'f_0599.png'))) throw new Error('missing frames; run `npm run render` first');
if (!fs.existsSync(audio)) throw new Error('missing out/audio.wav; run `npm run audio` first');

// Measure integrated loudness so the web version sits at a comfortable, consistent level.
const probe = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', audio, '-af', 'ebur128', '-f', 'null', '-'], {
  encoding: 'utf8',
});
const measured = /I:\s+(-?[\d.]+) LUFS/.exec(probe.stderr.split('Summary:').pop());
const gain = measured ? TARGET_LUFS - Number(measured[1]) : 0;

fs.mkdirSync(publicDir, { recursive: true });
const mp4 = path.join(publicDir, 'otpwave-promo.mp4');
execFileSync(
  'ffmpeg',
  [
    '-y', '-loglevel', 'error',
    '-framerate', '30', '-i', path.join(frames, 'f_%04d.png'),
    '-i', audio,
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-af', `volume=${gain.toFixed(2)}dB`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '21', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', '-shortest',
    mp4,
  ],
  { stdio: 'inherit' },
);

const poster = path.join(publicDir, 'otpwave-promo-poster.jpg');
execFileSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-i', path.join(frames, `f_${String(POSTER_FRAME).padStart(4, '0')}.png`), '-q:v', '3', poster],
  { stdio: 'inherit' },
);

const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(2);
console.log(`audio gain ${gain.toFixed(2)} dB -> ${TARGET_LUFS} LUFS`);
console.log(`${path.relative(here, mp4)}  ${mb(mp4)} MB`);
console.log(`${path.relative(here, poster)}  ${mb(poster)} MB`);
