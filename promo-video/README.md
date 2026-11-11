# OtpWave promo video

Source for the 20-second 3D promo on the landing page (`web/public/promo/otpwave-promo.mp4`).

Everything is code: a Three.js scene (characters, props, camera) plus an HTML/CSS type layer that uses the site's own fonts and component styles. Each frame is rendered deterministically in headless Chrome with software WebGL, then ffmpeg encodes the frames with a synthesized soundtrack whose sound effects are cued from the same timeline.

This folder is a standalone package, not an npm workspace, so the `web` and `api` dependencies stay untouched.

## Render

Requires Node 22+, Google Chrome (or set `CHROME_PATH`), and ffmpeg.

```bash
cd promo-video
npm install
npm run video        # audio -> 600 frames (1080p30) -> web/public/promo/*.mp4 + poster
```

Individual steps:

```bash
npm run audio                                   # out/audio.wav
npm run render                                  # out/frames/f_0000.png … f_0599.png (resumable)
node render.mjs --scale 0.5 --step 2 --out out/preview   # quick half-res, half-rate preview
node render.mjs --scale 0.5 --frames 120,360 --out out/stills
npm run encode                                  # MP4 (loudness-normalized) + poster
```

A full 1080p render takes about 25 minutes on 2 CPU cores.

## Where things live

| File | What it controls |
|---|---|
| `src/timeline.js` | World layout, story beats, character performances, camera |
| `src/overlay.js` / `src/overlay.css` | Captions, end-card lockup, cursor |
| `src/world/characters.js` | The developer, the user, and Bubbly (the message mascot) |
| `src/world/props.js` | Islands, panels with offset slabs, keyboard, card, badge, confetti |
| `src/world/screens.js` | Code editor, phone chat, and card graphics (canvas textures) |
| `src/lib/look.js` | Brand palette, materials, ink outlines, sky, final grade |
| `audio.mjs` | Music (120 BPM, D major) and sound design cued from the timeline |

Copy changes are usually one line: captions are in `src/overlay.js`, and the request/phone text is in `src/world/screens.js`.
