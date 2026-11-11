// Renders the promo frame-by-frame in headless Chrome (software WebGL) to PNGs.
//
//   node render.mjs                         all frames at 1080p -> out/frames
//   node render.mjs --scale 0.5 --frames 0,120,360 --out out/preview
//   node render.mjs --from 0 --to 299        a frame range (resumable; existing frames are skipped)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(`--${name}`);
const scale = Number(opt('scale', '1'));
const outDir = path.resolve(here, opt('out', 'out/frames'));
const force = flag('force');

const routes = {
  '/': path.join(here, 'index.html'),
  '/fonts/host-grotesk.woff2': path.join(repo, 'web/app/fonts/host-grotesk-latin.woff2'),
  '/fonts/instrument-sans.woff2': path.join(repo, 'web/app/fonts/instrument-sans-latin.woff2'),
  '/fonts/jetbrains-mono-500.woff2': path.join(here, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2'),
  '/fonts/jetbrains-mono-700.woff2': path.join(here, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2'),
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = routes[urlPath] || path.join(here, urlPath);
  if (!routes[urlPath] && !file.startsWith(here + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const chrome =
  process.env.CHROME_PATH ||
  ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) =>
    fs.existsSync(p),
  );
if (!chrome) throw new Error('Chrome not found; set CHROME_PATH');

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: scale });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[page ${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction('window.__ready === true || !!window.__error', { timeout: 180000 });
  const bootError = await page.evaluate(() => window.__error);
  if (bootError) throw new Error(bootError);
  const meta = await page.evaluate(() => window.__meta);

  let frames;
  if (opt('frames')) frames = opt('frames').split(',').map(Number);
  else {
    const from = Number(opt('from', '0'));
    const to = Number(opt('to', String(meta.frames - 1)));
    frames = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const started = Date.now();
  let done = 0;
  for (const frame of frames) {
    const file = path.join(outDir, `f_${String(frame).padStart(4, '0')}.png`);
    if (!force && fs.existsSync(file)) continue;
    await page.evaluate(
      (f) =>
        new Promise((resolve) => {
          window.renderFrame(f);
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
      frame,
    );
    const png = await page.screenshot({ type: 'png', optimizeForSpeed: true });
    fs.writeFileSync(file, png);
    done++;
    if (done % 10 === 0 || frames.length < 40) {
      const per = (Date.now() - started) / done / 1000;
      const left = frames.length - frames.indexOf(frame) - 1;
      console.log(`frame ${frame}  ${per.toFixed(2)}s/frame  eta ${Math.round((left * per) / 60)} min`);
    }
  }
  console.log(`rendered ${done} frame(s) to ${path.relative(here, outDir)} in ${((Date.now() - started) / 1000).toFixed(0)}s`);
} finally {
  await browser.close();
  server.close();
}
