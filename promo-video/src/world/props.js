import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, ACCENTS, clay, matte, mesh, contactShadow } from '../lib/look.js';
import { rng } from '../lib/anim.js';

const V3 = THREE.Vector3;

/** Floating island: a rounded puck (lathe profile, bottom to top so faces point out). */
export function island({ R = 3.3, H = 0.5, r = 0.17, color }) {
  const pts = [new THREE.Vector2(0, -H)];
  const arc = (cx, cy, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  arc(R - r, -H + r, -Math.PI / 2, 0, 8);
  arc(R - r, -r, 0, Math.PI / 2, 8);
  pts.push(new THREE.Vector2(0, 0));
  return mesh(new THREE.LatheGeometry(pts, 112), matte(color, { roughness: 0.82 }), { cast: false, receive: true });
}

/** UI panel with the site's signature solid offset shadow, built as a second slab. */
export function slabPanel({ w, h, d = 0.12, r = 0.1, color, slabColor, offset = 0.14, texture = null, inset = 0.07 }) {
  const group = new THREE.Group();
  const geo = new RoundedBoxGeometry(w, h, d, 4, r);
  const body = mesh(geo, matte(color, { roughness: 0.55 }), { receive: true });
  group.add(body);
  let slab = null;
  if (slabColor) {
    slab = mesh(geo, matte(slabColor, { roughness: 0.62 }), { receive: true });
    slab.position.set(offset, -offset, -d * 0.8);
    group.add(slab);
  }
  let screen = null;
  if (texture) {
    screen = new THREE.Mesh(
      new THREE.PlaneGeometry(w - inset * 2, h - inset * 2),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    screen.position.z = d / 2 + 0.004;
    group.add(screen);
  }
  return { group, body, slab, screen, size: { w, h, d, inset } };
}

/** Chunky keyboard with an oversized purple SEND key. */
export function keyboard(labelTexture) {
  const group = new THREE.Group();
  const deck = mesh(new RoundedBoxGeometry(1.62, 0.13, 0.64, 3, 0.05), matte(C.ground, { roughness: 0.6 }), {
    receive: true,
  });
  group.add(deck);
  const keyGeo = new RoundedBoxGeometry(0.1, 0.05, 0.095, 2, 0.02);
  const layout = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 10; col++) {
      const x = -0.7 + col * 0.118 + (row % 2) * 0.03;
      if (x > 0.36) continue;
      layout.push({ x, z: -0.21 + row * 0.118, w: 1 });
    }
  }
  layout.push({ x: -0.2, z: 0.265, w: 5 });
  const keys = new THREE.InstancedMesh(keyGeo, matte('#3a4256', { roughness: 0.45 }), layout.length);
  keys.castShadow = true;
  const m4 = new THREE.Matrix4();
  const setKey = (i, press = 0) => {
    const k = layout[i];
    m4.compose(new V3(k.x, 0.09 - press * 0.03, k.z), new THREE.Quaternion(), new V3(k.w, 1 - press * 0.3, 1));
    keys.setMatrixAt(i, m4);
  };
  layout.forEach((_, i) => setKey(i));
  group.add(keys);

  const send = new THREE.Group();
  send.position.set(0.6, 0.065, 0.04);
  const sendCap = mesh(new RoundedBoxGeometry(0.36, 0.1, 0.4, 3, 0.045), clay(C.purple), { inkScale: 0.85 });
  sendCap.position.y = 0.05;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.27, 0.27),
    new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, toneMapped: false }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.y = 0.102;
  sendCap.add(label);
  send.add(sendCap);
  group.add(send);

  return {
    group,
    layout,
    send: sendCap,
    /** pressed: Map(keyIndex -> amount 0..1) */
    pressKeys(pressed) {
      layout.forEach((_, i) => setKey(i, pressed.get(i) || 0));
      keys.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Verification card with six code slots. */
export function otpCard(titleTexture) {
  const panel = slabPanel({ w: 3.7, h: 1.85, d: 0.14, r: 0.12, color: C.panel, slabColor: C.purple, offset: 0.15 });
  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 0.6),
    new THREE.MeshBasicMaterial({ map: titleTexture, transparent: true, toneMapped: false }),
  );
  title.position.set(0, 0.46, 0.074);
  panel.group.add(title);
  const slotGeo = new RoundedBoxGeometry(0.46, 0.6, 0.06, 3, 0.07);
  const slots = [];
  for (let i = 0; i < 6; i++) {
    const s = mesh(slotGeo, matte(C.lilac, { roughness: 0.6 }), { receive: true, inkScale: 0.8 });
    s.position.set((i - 2.5) * 0.56, -0.3, 0.085);
    panel.group.add(s);
    slots.push(s);
  }
  return { ...panel, title, slots };
}

export function digitTile(texture) {
  const g = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(0.42, 0.54, 0.14, 3, 0.07), clay(C.panel, { clearcoat: 0.2 }), {
    inkScale: 0.85,
  });
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.453),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
  );
  face.position.z = 0.072;
  g.add(body, face);
  return g;
}

/** Purple badge with a chunky check built from two capsules. */
export function badge() {
  const g = new THREE.Group();
  const coin = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 56), clay(C.purple));
  coin.rotation.x = Math.PI / 2;
  g.add(coin);
  const mat = clay(C.ground, { clearcoat: 0.1 });
  const shortLeg = mesh(new THREE.CapsuleGeometry(0.068, 0.12, 6, 14), mat, { inkScale: 0.8 });
  shortLeg.position.set(-0.15, -0.03, 0.11);
  shortLeg.rotation.z = Math.PI / 4;
  const longLeg = mesh(new THREE.CapsuleGeometry(0.068, 0.32, 6, 14), mat, { inkScale: 0.8 });
  longLeg.position.set(0.09, 0.05, 0.11);
  longLeg.rotation.z = -0.72;
  g.add(shortLeg, longLeg);
  return g;
}

/** Deterministic confetti burst of brand shapes. */
export function confetti(count = 56, seed = 11) {
  const group = new THREE.Group();
  const r = rng(seed);
  const geos = [
    new THREE.SphereGeometry(0.075, 16, 12),
    new THREE.CylinderGeometry(0.12, 0.12, 0.05, 3),
    new RoundedBoxGeometry(0.15, 0.15, 0.05, 2, 0.03),
    new THREE.TorusGeometry(0.075, 0.027, 8, 22),
  ];
  const mats = ACCENTS.map((c) => clay(c, { clearcoat: 0.2 }));
  const pieces = [];
  for (let i = 0; i < count; i++) {
    const m = mesh(geos[i % geos.length], mats[Math.floor(r() * mats.length)], { cast: false, inkScale: 0.7 });
    const theta = r() * Math.PI * 2;
    const up = 0.45 + r() * 0.75;
    const dir = new V3(Math.cos(theta) * (1.15 - up * 0.5), up, Math.sin(theta) * 0.5 + 0.45).normalize();
    pieces.push({
      m,
      v: dir.multiplyScalar(3.4 + r() * 3.2),
      spin: new V3(r() * 9 - 4.5, r() * 9 - 4.5, r() * 9 - 4.5),
      delay: r() * 0.07,
      life: 2.1 + r() * 1.0,
      scale: 0.8 + r() * 0.6,
    });
    m.visible = false;
    group.add(m);
  }
  const k = 1.5;
  const gy = -6.0;
  return {
    group,
    update(t, t0, origin) {
      for (const p of pieces) {
        const x = t - t0 - p.delay;
        if (x <= 0 || x > p.life) {
          p.m.visible = false;
          continue;
        }
        p.m.visible = true;
        const e = (1 - Math.exp(-k * x)) / k;
        p.m.position.set(
          origin.x + p.v.x * e,
          origin.y + (gy / k) * x + (p.v.y - gy / k) * e,
          origin.z + p.v.z * e,
        );
        p.m.rotation.set(p.spin.x * x, p.spin.y * x, p.spin.z * x);
        const s = Math.min(1, x / 0.08) * Math.min(1, (p.life - x) / 0.45);
        p.m.scale.setScalar(Math.max(0.001, s * p.scale));
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Set dressing: the hero illustration's shapes, rebuilt in 3D.
export function sphereShape(radius, color) {
  return mesh(new THREE.SphereGeometry(radius, 48, 32), clay(color));
}

export function triShape(size, depth, color) {
  const s = new THREE.Shape();
  const h = size * 0.88;
  s.moveTo(0, h * 0.62);
  s.lineTo(size / 2, -h * 0.38);
  s.lineTo(-size / 2, -h * 0.38);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.35,
    bevelSize: size * 0.08,
    bevelSegments: 5,
  });
  g.translate(0, 0, -depth / 2);
  return mesh(g, clay(color));
}

export function tileShape(size, color) {
  return mesh(new RoundedBoxGeometry(size, size, size * 0.42, 5, size * 0.2), clay(color));
}

export function archShape(w, h, depth, color) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, -h / 2);
  s.lineTo(-r, h / 2 - r);
  s.absarc(0, h / 2 - r, r, Math.PI, 0, true);
  s.lineTo(r, -h / 2);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 5,
    curveSegments: 28,
  });
  g.translate(0, 0, -depth / 2);
  return mesh(g, clay(color));
}

export function dot(radius, color) {
  return mesh(new THREE.SphereGeometry(radius, 32, 24), clay(color));
}

export { contactShadow };
