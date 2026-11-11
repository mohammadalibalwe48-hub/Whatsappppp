import * as THREE from 'three';
import { C } from '../lib/look.js';
import { clamp, ease, prog, spring } from '../lib/anim.js';

const DISPLAY = '"Host Grotesk", sans-serif';
const READ = '"Instrument Sans", sans-serif';
const MONO = '"JetBrains Mono", monospace';

function canvasTexture(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// ---------------------------------------------------------------------------
// Code editor on the developer's floating window (styled like .dp-code-surface).
const CODE_LINES = [
  [['POST', C.yellow], [' /v1/otp/send', '#fffdf5']],
  [['X-API-Key: ', '#b8b6c5'], ['ow_live_8f2k••••', C.mint]],
  [],
  [['{', '#fffdf5']],
  [['  "phoneNumber"', C.pink], [': ', '#fffdf5'], ['"+1 555 010 0100"', C.mint], [',', '#fffdf5']],
  [['  "appName"', C.pink], [': ', '#fffdf5'], ['"Acme"', C.mint]],
  [['}', '#fffdf5']],
];
const PREFILLED = 2; // header lines are already on screen; the body gets typed
const TYPED_CHARS = CODE_LINES.slice(PREFILLED).reduce((n, l) => n + l.reduce((m, [s]) => m + s.length, 0), 0);
export const TYPING = { start: 0.25, end: 2.75, chars: TYPED_CHARS };

/** Keystroke times, shared with the soundtrack so every click lands on a key press. */
export function keystrokeTimes() {
  const times = [];
  for (let i = 0; i < TYPED_CHARS; i++) {
    const p = i / TYPED_CHARS;
    const jitter = Math.sin(i * 12.9898) * 0.012;
    times.push(TYPING.start + p * (TYPING.end - TYPING.start) + jitter);
  }
  return times;
}

export function createCodeScreen() {
  const W = 1280;
  const H = 793;
  const { ctx: g, texture } = canvasTexture(W, H);
  const strokes = keystrokeTimes();
  let lastKey = '';

  function draw(t) {
    const typed = strokes.filter((k) => k <= t).length;
    const sent = t >= 4.0;
    const flash = sent ? Math.max(0, 1 - (t - 4.0) / 0.35) : 0;
    const statusP = ease.outCubic(prog(t, 4.05, 4.35));
    const cursorOn = Math.floor(t * 2.4) % 2 === 0 || (typed > 0 && typed < TYPED_CHARS);
    const key = `${typed}|${cursorOn}|${flash.toFixed(2)}|${statusP.toFixed(2)}|${sent}`;
    if (key === lastKey) return;
    lastKey = key;

    g.fillStyle = C.inkUi;
    g.fillRect(0, 0, W, H);

    // header
    g.strokeStyle = 'rgba(255,255,255,0.2)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 104);
    g.lineTo(W, 104);
    g.stroke();
    rr(g, 44, 28, 50, 50, 13);
    g.fillStyle = C.yellow;
    g.fill();
    g.strokeStyle = C.ink;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = C.ink;
    g.font = `700 22px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('</>', 69, 54);
    g.textAlign = 'left';
    g.fillStyle = '#fffdf5';
    g.font = `600 32px ${READ}`;
    g.fillText('Send a verification code', 116, 54);
    rr(g, W - 150, 30, 106, 46, 11);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2.5;
    g.stroke();
    g.font = `700 24px ${MONO}`;
    g.fillStyle = '#fffdf5';
    g.textAlign = 'center';
    g.fillText('POST', W - 97, 54);
    g.textAlign = 'left';

    // code body
    g.font = `500 37px ${MONO}`;
    g.textBaseline = 'alphabetic';
    const x0 = 58;
    const y0 = 182;
    const lh = 64;
    let budget = typed;
    let cursor = [x0, y0 + PREFILLED * lh];
    CODE_LINES.forEach((line, li) => {
      let x = x0;
      const y = y0 + li * lh;
      const typedLine = li >= PREFILLED;
      g.fillStyle = 'rgba(255,253,245,0.28)';
      g.font = `500 26px ${MONO}`;
      g.fillText(String(li + 1).padStart(2, ' '), 8, y - 4);
      g.font = `500 37px ${MONO}`;
      if (typedLine && budget > 0) cursor = [x0, y];
      for (const [text, color] of line) {
        let shown = text;
        if (typedLine) {
          shown = text.slice(0, Math.max(0, budget));
          budget -= text.length;
        }
        g.fillStyle = color;
        g.fillText(shown, x, y);
        x += g.measureText(shown).width;
        if (typedLine && shown.length > 0) cursor = [x, y];
      }
    });
    if (cursorOn && !sent) {
      g.fillStyle = C.mint;
      g.fillRect(cursor[0] + 3, cursor[1] - 34, 20, 42);
    }

    // footer / status
    g.strokeStyle = 'rgba(255,255,255,0.2)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, H - 96);
    g.lineTo(W, H - 96);
    g.stroke();
    g.textBaseline = 'middle';
    const fy = H - 48;
    if (!sent) {
      g.font = `500 27px ${READ}`;
      g.fillStyle = C.mint;
      g.beginPath();
      g.arc(64, fy, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillText('API key authentication', 90, fy);
      g.fillStyle = C.pink;
      g.beginPath();
      g.arc(470, fy, 10, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillText('Delivery webhooks', 496, fy);
    } else {
      g.globalAlpha = statusP;
      const sx = 44 + (1 - statusP) * 30;
      rr(g, sx, fy - 26, 170, 52, 14);
      g.fillStyle = C.mint;
      g.fill();
      g.fillStyle = C.ink;
      g.font = `700 27px ${MONO}`;
      g.fillText('200 OK', sx + 22, fy + 1);
      g.fillStyle = '#ffffff';
      g.font = `500 28px ${MONO}`;
      g.fillText('otp_7Hk2pX  ·  status: "sent"', sx + 200, fy + 1);
      g.globalAlpha = 1;
    }
    if (flash > 0) {
      g.fillStyle = `rgba(155,241,205,${0.55 * flash})`;
      g.fillRect(0, 0, W, H);
    }
    texture.needsUpdate = true;
  }
  return { texture, draw, width: W, height: H };
}

// ---------------------------------------------------------------------------
// Phone chat screen. Canvas aspect matches the screen plane (1.35 x 2.85).
export const PHONE_CANVAS = { w: 720, h: 1520 };
export const CODE = '482913';
export const MESSAGE_AT = 8.05;
export const DIGITS_AT = 9.2;
export const DIGIT_GAP = 0.18;

function drawPattern(g, W, H) {
  g.save();
  g.globalAlpha = 0.5;
  g.strokeStyle = '#b9ecd6';
  g.lineWidth = 3;
  for (let y = 230; y < H - 150; y += 120) {
    for (let x = 30 + ((y / 120) % 2) * 60; x < W; x += 140) {
      const k = (x * 7 + y * 3) % 3;
      g.beginPath();
      if (k === 0) g.arc(x, y, 13, 0, Math.PI * 2);
      else if (k === 1) {
        g.moveTo(x, y - 14);
        g.lineTo(x + 14, y + 11);
        g.lineTo(x - 14, y + 11);
        g.closePath();
      } else g.roundRect(x - 12, y - 12, 24, 24, 6);
      g.stroke();
    }
  }
  g.restore();
}

export function createPhoneScreen() {
  const { w: W, h: H } = PHONE_CANVAS;
  const { ctx: g, texture } = canvasTexture(W, H);
  const layout = { digits: [] };
  let lastKey = '';

  // static layer cached once
  const base = document.createElement('canvas');
  base.width = W;
  base.height = H;
  const b = base.getContext('2d');
  b.fillStyle = C.mintSoft;
  b.fillRect(0, 0, W, H);
  drawPattern(b, W, H);
  // status bar
  b.fillStyle = '#ffffff';
  b.fillRect(0, 0, W, 210);
  b.fillStyle = C.ink;
  b.font = `600 30px ${READ}`;
  b.textBaseline = 'middle';
  b.fillText('9:41', 60, 50);
  for (let i = 0; i < 4; i++) b.fillRect(W - 170 + i * 14, 58 - i * 7, 9, 12 + i * 7);
  rr(b, W - 104, 36, 52, 28, 7);
  b.lineWidth = 3;
  b.strokeStyle = C.ink;
  b.stroke();
  b.fillRect(W - 99, 41, 34, 18);
  // chat header
  b.font = `600 46px ${READ}`;
  b.fillText('‹', 34, 142);
  b.beginPath();
  b.arc(124, 142, 40, 0, Math.PI * 2);
  b.fillStyle = C.purple;
  b.fill();
  b.lineWidth = 4;
  b.strokeStyle = C.ink;
  b.stroke();
  b.fillStyle = '#ffffff';
  b.font = `700 40px ${DISPLAY}`;
  b.textAlign = 'center';
  b.fillText('A', 124, 144);
  b.textAlign = 'left';
  b.fillStyle = C.ink;
  b.font = `700 38px ${DISPLAY}`;
  b.fillText('Acme', 184, 126);
  b.fillStyle = C.muted;
  b.font = `500 25px ${READ}`;
  b.fillText('online', 184, 166);
  b.fillStyle = C.ink;
  b.fillRect(0, 207, W, 4);
  // date chip
  rr(b, W / 2 - 64, 252, 128, 44, 14);
  b.fillStyle = '#ffffff';
  b.fill();
  b.lineWidth = 2;
  b.strokeStyle = C.rule;
  b.stroke();
  b.fillStyle = C.muted;
  b.font = `600 23px ${READ}`;
  b.textAlign = 'center';
  b.fillText('Today', W / 2, 275);
  b.textAlign = 'left';
  // composer
  rr(b, 30, H - 130, W - 170, 86, 43);
  b.fillStyle = '#ffffff';
  b.fill();
  b.lineWidth = 3;
  b.strokeStyle = C.ink;
  b.stroke();
  b.fillStyle = C.rule;
  b.font = `500 30px ${READ}`;
  b.fillText('Message', 70, H - 86);
  b.beginPath();
  b.arc(W - 78, H - 87, 43, 0, Math.PI * 2);
  b.fillStyle = C.purple;
  b.fill();
  b.stroke();
  b.fillStyle = '#ffffff';
  b.beginPath();
  b.moveTo(W - 92, H - 106);
  b.lineTo(W - 58, H - 87);
  b.lineTo(W - 92, H - 68);
  b.closePath();
  b.fill();

  // message bubble geometry (also used to aim the flying digits)
  const bubble = { x: 34, y: 330, w: 600, h: 372 };
  g.font = `700 104px ${DISPLAY}`;
  const codeText = '482 913';
  const codeW = g.measureText(codeText).width + 6 * 6;
  const codeX = bubble.x + 34;
  const codeY = bubble.y + 196;
  let cx = codeX;
  for (const ch of codeText) {
    const cw = g.measureText(ch).width;
    if (ch !== ' ') layout.digits.push({ x: cx + cw / 2, y: codeY });
    cx += cw + 6;
  }
  layout.codeBox = { x: codeX - 12, y: codeY - 62, w: codeW + 18, h: 112 };

  function draw(t) {
    const typingOn = t > 7.45 && t < MESSAGE_AT;
    const msg = clamp(spring(t, MESSAGE_AT, 2.6, 0.5));
    const ripple = prog(t, 7.9, 8.5);
    const highlight = ease.outCubic(prog(t, 8.85, 9.12));
    const launched = CODE.split('').map((_, i) => t >= DIGITS_AT + i * DIGIT_GAP);
    const key = `${typingOn ? Math.floor(t * 12) : -1}|${msg.toFixed(3)}|${ripple.toFixed(3)}|${highlight.toFixed(2)}|${launched.join('')}`;
    if (key === lastKey) return;
    lastKey = key;

    g.drawImage(base, 0, 0);

    if (typingOn) {
      rr(g, bubble.x, bubble.y, 170, 86, 30);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = C.ink;
      g.stroke();
      for (let i = 0; i < 3; i++) {
        const lift = Math.max(0, Math.sin(t * 14 - i * 0.9)) * 9;
        g.beginPath();
        g.arc(bubble.x + 48 + i * 37, bubble.y + 44 - lift, 10, 0, Math.PI * 2);
        g.fillStyle = C.muted;
        g.fill();
      }
    }

    if (msg > 0.001) {
      g.save();
      const s = 0.82 + 0.18 * msg;
      g.globalAlpha = clamp(msg * 1.6);
      g.translate(bubble.x, bubble.y + bubble.h);
      g.scale(s, s);
      g.translate(-bubble.x, -(bubble.y + bubble.h) + (1 - msg) * 40);
      rr(g, bubble.x + 8, bubble.y + 8, bubble.w, bubble.h, 30);
      g.fillStyle = C.lilac;
      g.fill();
      rr(g, bubble.x, bubble.y, bubble.w, bubble.h, 30);
      g.fillStyle = '#ffffff';
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = C.ink;
      g.stroke();
      g.fillStyle = C.ink;
      g.textBaseline = 'middle';
      g.font = `500 31px ${READ}`;
      g.fillText('Your Acme verification code is', bubble.x + 34, bubble.y + 62);
      if (highlight > 0) {
        const hb = layout.codeBox;
        g.fillStyle = C.yellow;
        rr(g, hb.x, hb.y, hb.w * highlight, hb.h, 16);
        g.fill();
      }
      g.font = `700 104px ${DISPLAY}`;
      let x = codeX;
      let di = 0;
      for (const ch of codeText) {
        const cw = g.measureText(ch).width;
        if (ch !== ' ') {
          g.fillStyle = launched[di] ? 'rgba(37,43,58,0.18)' : C.ink;
          di++;
        }
        g.fillText(ch, x, codeY);
        x += cw + 6;
      }
      g.fillStyle = C.muted;
      g.font = `500 25px ${READ}`;
      g.fillText('Expires in 5 minutes. Don’t share it.', bubble.x + 34, bubble.y + 292);
      g.font = `500 24px ${READ}`;
      g.fillText('9:41', bubble.x + bubble.w - 128, bubble.y + 340);
      g.fillStyle = C.purple;
      g.font = `700 26px ${READ}`;
      g.fillText('✓✓', bubble.x + bubble.w - 70, bubble.y + 340);
      g.restore();
    }

    if (ripple > 0 && ripple < 1) {
      const r = 60 + ripple * 520;
      g.save();
      g.globalAlpha = (1 - ripple) * 0.85;
      g.lineWidth = 14 * (1 - ripple) + 2;
      g.strokeStyle = C.mint;
      g.beginPath();
      g.arc(W / 2, H * 0.44, r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    // Round the screen corners into the device body.
    g.beginPath();
    g.rect(0, 0, W, H);
    g.roundRect(0, 0, W, H, 60);
    g.fillStyle = C.ink;
    g.fill('evenodd');
    texture.needsUpdate = true;
  }
  return { texture, draw, layout };
}

// ---------------------------------------------------------------------------
export function createCardTitle() {
  const W = 1100;
  const H = 200;
  const { ctx: g, texture } = canvasTexture(W, H);
  let last = null;
  function draw(t) {
    const verified = t >= 12.0;
    if (last === verified) return;
    last = verified;
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = C.ink;
    g.font = `700 76px ${DISPLAY}`;
    g.letterSpacing = '-3px';
    g.fillText(verified ? 'You’re verified' : 'Verify your number', W / 2, 66);
    g.letterSpacing = '0px';
    g.font = `500 38px ${READ}`;
    g.fillStyle = verified ? C.purple : C.muted;
    g.fillText(verified ? 'Code confirmed via WhatsApp' : 'Enter the 6-digit code from WhatsApp', W / 2, 152);
    texture.needsUpdate = true;
  }
  return { texture, draw };
}

export function createDigitTextures() {
  const out = {};
  for (const d of '0123456789') {
    const { ctx: g, texture } = canvasTexture(192, 256);
    g.fillStyle = C.ink;
    g.font = `700 200px ${DISPLAY}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(d, 96, 140);
    texture.needsUpdate = true;
    out[d] = texture;
  }
  return out;
}

export function createKeyLabel() {
  const { ctx: g, texture } = canvasTexture(256, 256);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 64px ${READ}`;
  g.fillText('SEND', 128, 104);
  g.font = `700 70px ${READ}`;
  g.fillText('↵', 128, 178);
  texture.needsUpdate = true;
  return texture;
}
