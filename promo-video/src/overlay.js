import { clamp, ease, prog, wobble } from './lib/anim.js';

// `*text*` marks a phrase with a highlighter swipe in the given color.
const CAPTIONS = [
  { in: 0.4, out: 3.05, left: 112, top: 112, pill: 'WhatsApp + OTP', lines: ['One *API call.*'], mark: '#ffd05b' },
  { in: 5.05, out: 7.3, left: 112, top: 104, lines: ['Sent from your', '*own WhatsApp.*'], mark: '#9bf1cd' },
  { in: 8.75, out: 10.85, right: 112, top: 96, lines: ['Lands right in', '*their chat.*'], mark: '#ff9fd2' },
  {
    in: 13.7,
    out: 15.2,
    left: 112,
    top: 104,
    lines: ['*Verified.*'],
    mark: '#ffd05b',
    sub: 'Follow every delivery, from send to verify.',
  },
];

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
const CURSOR =
  '<svg viewBox="0 0 32 32"><path d="M6 3.5 25.5 17l-8.6 1.6 5.2 9.1-4.1 2.3-5.2-9.2L6.4 27Z" fill="#252b3a" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

function buildWords(container, lines, markColor) {
  const words = [];
  const markers = [];
  for (const line of lines) {
    const row = el('span', 'line');
    const parts = line.split('*');
    parts.forEach((part, pi) => {
      if (!part) return;
      const marked = pi % 2 === 1;
      const host = marked ? el('span', 'mark') : row;
      if (marked) {
        const m = el('span', 'marker');
        m.style.background = markColor;
        host.appendChild(m);
        markers.push(m);
        row.appendChild(host);
      }
      part.split(/(\s+)/).forEach((tok) => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) {
          host.appendChild(document.createTextNode(' '));
          return;
        }
        const w = el('span', 'w');
        const inner = el('span', null);
        inner.textContent = tok;
        w.appendChild(inner);
        host.appendChild(w);
        words.push(inner);
      });
    });
    container.appendChild(row);
  }
  return { words, markers };
}

export function createOverlay(root) {
  const caps = CAPTIONS.map((c) => {
    const box = el('div', 'caption');
    if (c.right != null) {
      box.style.right = `${c.right}px`;
      box.style.textAlign = 'right';
    } else box.style.left = `${c.left}px`;
    box.style.top = `${c.top}px`;
    let pill = null;
    if (c.pill) {
      pill = el('div', 'pill', `<i></i>${c.pill}`);
      box.appendChild(pill);
    }
    const h1 = el('h1');
    box.appendChild(h1);
    const { words, markers } = buildWords(h1, c.lines, c.mark);
    let sub = null;
    if (c.sub) {
      sub = el('div', 'sub', c.sub);
      box.appendChild(sub);
    }
    root.appendChild(box);
    return { c, box, pill, words, markers, sub };
  });

  const wordmark = el('div', 'wordmark', '<span>OtpWave</span>');
  const wmInner = wordmark.firstChild;
  const tagline = el('div', 'tagline');
  const tag = buildWords(tagline, ['Every message, in its right place.'], 'transparent');
  const cta = el('div', 'cta');
  const btn = el('span', 'btn', `Open your workspace ${ARROW}`);
  const url = el('span', 'url', 'otpwave-web.fly.dev');
  cta.append(btn, url);
  const cursor = el('div', 'cursor', CURSOR);
  root.append(wordmark, tagline, cta, cursor);
  tagline.style.top = '574px';
  cta.style.top = '676px';

  function update(t, info) {
    root.style.opacity = String(1 - info.fade);

    for (const { c, box, pill, words, markers, sub } of caps) {
      const on = t > c.in - 0.2 && t < c.out + 0.8;
      box.style.visibility = on ? 'visible' : 'hidden';
      if (!on) continue;
      words.forEach((w, k) => {
        const pIn = ease.outExpo(prog(t, c.in + k * 0.075, c.in + k * 0.075 + 0.7));
        const pOut = ease.inCubic(prog(t, c.out + k * 0.035, c.out + k * 0.035 + 0.36));
        w.style.transform = `translateY(${((1 - pIn) * 110 - pOut * 112).toFixed(2)}%) rotate(${((1 - pIn) * 5).toFixed(2)}deg)`;
      });
      const lastWord = c.in + (words.length - 1) * 0.075 + 0.25;
      markers.forEach((m) => {
        const p = ease.outQuart(prog(t, lastWord, lastWord + 0.45));
        const out = prog(t, c.out - 0.1, c.out + 0.2);
        m.style.transform = `scaleX(${(p * (1 - out)).toFixed(3)})`;
        m.style.transformOrigin = out > 0 ? 'right center' : 'left center';
        if (out > 0) m.style.transform = `scaleX(${(1 - ease.inCubic(out)).toFixed(3)})`;
      });
      if (pill) {
        const p = ease.outBack(prog(t, c.in - 0.15, c.in + 0.3));
        const out = ease.inCubic(prog(t, c.out - 0.05, c.out + 0.3));
        pill.style.transform = `translateY(${(out * -24).toFixed(1)}px) scale(${Math.max(0, p).toFixed(3)})`;
        pill.style.opacity = String(clamp(p * 1.5) * (1 - out));
      }
      if (sub) {
        const p = ease.outCubic(prog(t, c.in + 0.45, c.in + 1.0));
        const out = ease.inCubic(prog(t, c.out, c.out + 0.35));
        sub.style.opacity = String(p * (1 - out));
        sub.style.transform = `translateY(${((1 - p) * 18 - out * 14).toFixed(1)}px)`;
      }
    }

    // ---- end card lockup, anchored to the projected 3D logo ring
    const endOn = t > 16.9;
    wordmark.style.visibility = tagline.style.visibility = cta.style.visibility = endOn ? 'visible' : 'hidden';
    cursor.style.visibility = t > 17.9 && t < 19.9 ? 'visible' : 'hidden';
    if (!endOn) return;
    const r = info.ring;
    wordmark.style.left = `${(r.x + r.r + 40).toFixed(1)}px`;
    wordmark.style.top = `${(r.y - 88).toFixed(1)}px`;
    wordmark.style.height = '176px';
    const wm = ease.outExpo(prog(t, 17.05, 17.75));
    wordmark.style.clipPath = `inset(-20% ${((1 - wm) * 100).toFixed(2)}% -30% -2%)`;
    wmInner.style.transform = `translateX(${((1 - wm) * -40).toFixed(1)}px)`;
    tag.words.forEach((w, k) => {
      const p = ease.outExpo(prog(t, 17.35 + k * 0.06, 17.35 + k * 0.06 + 0.7));
      w.style.transform = `translateY(${((1 - p) * 110).toFixed(2)}%)`;
    });
    const pop = ease.outBack(prog(t, 17.62, 18.0));
    const press = Math.max(0, 1 - Math.abs(t - 18.47) / 0.1);
    btn.style.opacity = String(clamp(pop * 2));
    btn.style.transform = `translate(${(press * 4).toFixed(2)}px, ${(press * 4).toFixed(2)}px) scale(${(0.7 + 0.3 * pop).toFixed(3)})`;
    btn.style.boxShadow = `${(6 - press * 4).toFixed(2)}px ${(6 - press * 4).toFixed(2)}px 0 #252b3a`;
    const u = ease.outCubic(prog(t, 17.85, 18.25));
    url.style.opacity = String(u);
    url.style.transform = `translateX(${((1 - u) * 24).toFixed(1)}px)`;

    // A real cursor glides in and clicks the button, like the site's press state.
    const glide = ease.inOutCubic(prog(t, 17.95, 18.42));
    const btnBox = {
      x: cta.offsetLeft + btn.offsetLeft + btn.offsetWidth * 0.64,
      y: cta.offsetTop + btn.offsetTop + btn.offsetHeight * 0.56,
    };
    const cx = 1240 + (btnBox.x - 1240) * glide + Math.sin(glide * Math.PI) * -60;
    const cy = 1000 + (btnBox.y - 1000) * glide;
    const away = ease.inOutCubic(prog(t, 18.9, 19.5));
    const click = 1 - 0.16 * Math.max(0, 1 - Math.abs(t - 18.46) / 0.08) + wobble(t, 18.52, 4, 10, 0.05);
    cursor.style.transform = `translate(${(cx + away * 160).toFixed(1)}px, ${(cy + away * 120).toFixed(1)}px) scale(${click.toFixed(3)})`;
    cursor.style.opacity = String(clamp(prog(t, 17.95, 18.1)) * (1 - away));
  }

  return { update };
}
