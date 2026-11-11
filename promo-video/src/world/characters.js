import * as THREE from 'three';
import { C, clay, mesh, contactShadow } from '../lib/look.js';

const V3 = THREE.Vector3;
const SPH = new THREE.SphereGeometry(1, 32, 20);
const SPH_LO = new THREE.SphereGeometry(1, 14, 10);
const inkGloss = new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.26, metalness: 0 });
const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const tongueMat = new THREE.MeshStandardMaterial({ color: '#ff8fb1', roughness: 0.5 });
const Z = new V3(0, 0, 1);

function makeEye(size = 1) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.scale.setScalar(size);
  g.add(inner);
  const ball = new THREE.Mesh(SPH, inkGloss);
  ball.scale.set(0.072, 0.1, 0.045);
  const glint = new THREE.Mesh(SPH_LO, white);
  glint.scale.setScalar(0.022);
  glint.position.set(0.022, 0.036, 0.04);
  const glint2 = new THREE.Mesh(SPH_LO, white);
  glint2.scale.setScalar(0.01);
  glint2.position.set(-0.018, -0.03, 0.042);
  const happy = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.017, 8, 20, Math.PI), inkGloss);
  happy.position.set(0, -0.03, 0.02);
  happy.visible = false;
  inner.add(ball, glint, glint2, happy);
  return {
    g,
    set({ blink = 0, happy: h = false, wide = 1 }) {
      ball.visible = !h;
      happy.visible = h;
      const open = Math.max(0.08, 1 - blink);
      ball.scale.set(0.072 * wide, 0.1 * open * wide, 0.045);
      glint.visible = glint2.visible = !h && open > 0.45;
      glint.scale.setScalar(0.022 * wide);
    },
  };
}

function makeMouth(size = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(size);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 24, Math.PI), inkGloss);
  smile.rotation.z = Math.PI;
  smile.position.y = 0.02;
  const open = new THREE.Group();
  const hole = new THREE.Mesh(SPH, inkGloss);
  hole.scale.set(0.072, 0.062, 0.03);
  const tongue = new THREE.Mesh(SPH_LO, tongueMat);
  tongue.scale.set(0.044, 0.024, 0.02);
  tongue.position.set(0, -0.032, 0.02);
  open.add(hole, tongue);
  g.add(smile, open);
  return {
    g,
    set(m = 0) {
      smile.visible = m < 0.3;
      open.visible = m >= 0.3;
      open.scale.set(0.75 + 0.25 * m, Math.max(0.2, m), 1);
    },
  };
}

/**
 * Bean character: capsule body, ink eyes with glints, blush, stubby arms.
 * Hierarchy: root (placement) > hopper (jump height) > squash (volume-preserving) > lean (tilt/turn).
 */
export function createBean({ name, color, cheek = '#ff9cc9', facePatch = null }) {
  const R = 0.55;
  const H = 1.6;
  const headY = H - R;
  const root = new THREE.Group();
  root.name = name;
  const hopper = new THREE.Group();
  const squash = new THREE.Group();
  const lean = new THREE.Group();
  root.add(hopper);
  hopper.add(squash);
  squash.add(lean);

  const bodyGeo = new THREE.CapsuleGeometry(R, H - 2 * R, 14, 40);
  bodyGeo.translate(0, H / 2, 0);
  lean.add(mesh(bodyGeo, clay(color)));

  // Front-surface sampler used to seat the face on the body (or on the face patch).
  let surface = (x, y) => {
    const dy = Math.max(0, y - headY);
    const z = Math.sqrt(Math.max(0, R * R - dy * dy - x * x));
    return { z, n: new V3(x, dy, z).normalize() };
  };
  if (facePatch) {
    const pc = new V3(0, headY - 0.03, R - 0.17);
    const a = 0.37;
    const b = 0.31;
    const c = 0.2;
    const patch = new THREE.Mesh(SPH, clay(facePatch, { clearcoat: 0.15 }));
    patch.scale.set(a, b, c);
    patch.position.copy(pc);
    lean.add(patch);
    surface = (x, y) => {
      const k = 1 - (x / a) ** 2 - ((y - pc.y) / b) ** 2;
      const z = pc.z + c * Math.sqrt(Math.max(0, k));
      return { z, n: new V3(x / (a * a), (y - pc.y) / (b * b), (z - pc.z) / (c * c)).normalize() };
    };
  }
  const seat = (obj, x, y, inset = 0.012) => {
    const s = surface(x, y);
    obj.position.set(x, y, s.z - inset);
    obj.quaternion.setFromUnitVectors(Z, s.n);
  };

  const eyeL = makeEye();
  const eyeR = makeEye();
  const mouth = makeMouth();
  lean.add(eyeL.g, eyeR.g, mouth.g);
  const blushMat = clay(cheek, { clearcoat: 0 });
  const cheeks = [-1, 1].map((sx) => {
    const m = new THREE.Mesh(SPH_LO, blushMat);
    m.scale.set(0.075, 0.042, 0.02);
    seat(m, sx * 0.29, headY - 0.1, 0.004);
    lean.add(m);
    return m;
  });

  const arms = [-1, 1].map((sx) => {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.45, 0.74, 0.28);
    const g = new THREE.CapsuleGeometry(0.085, 0.27, 8, 18);
    g.translate(0, -0.2, 0);
    pivot.add(mesh(g, clay(color)));
    lean.add(pivot);
    return pivot;
  });

  const footMat = new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(SPH_LO, footMat);
    f.scale.set(0.15, 0.075, 0.2);
    f.position.set(sx * 0.21, 0.045, 0.16);
    f.castShadow = true;
    hopper.add(f);
  }

  const shadow = contactShadow(1.7, 0.34);
  shadow.position.y = 0.006;
  root.add(shadow);

  const rig = {
    name,
    root,
    lean,
    headY,
    height: H,
    radius: R,
    arms,
    seat,
    accessories: {},
    /** Pose from a plain state object; anything omitted falls back to the idle pose. */
    pose(p = {}) {
      const hopY = p.hop || 0;
      hopper.position.y = hopY;
      const s = p.squash ?? 1;
      const inv = 1 / Math.sqrt(s);
      squash.scale.set(inv, s, inv);
      lean.rotation.set(p.leanX || 0, p.turn || 0, p.leanZ || 0);
      const lx = (p.lookX || 0) * 0.045;
      const ly = (p.lookY || 0) * 0.035;
      seat(eyeL.g, -0.16 + lx, headY + 0.045 + ly);
      seat(eyeR.g, 0.16 + lx, headY + 0.045 + ly);
      seat(mouth.g, lx * 0.6, headY - 0.125 + ly * 0.4);
      eyeL.set({ blink: p.blinkL ?? p.blink ?? 0, happy: p.happy, wide: p.wide ?? 1 });
      eyeR.set({ blink: p.blinkR ?? p.blink ?? 0, happy: p.happy, wide: p.wide ?? 1 });
      mouth.set(p.mouth || 0);
      const aL = p.armL || {};
      const aR = p.armR || {};
      arms[0].rotation.set(aL.x ?? -0.12, aL.y ?? 0, -(aL.z ?? 0.32));
      arms[1].rotation.set(aR.x ?? -0.12, aR.y ?? 0, aR.z ?? 0.32);
      shadow.scale.setScalar(1.7 * (1 - Math.min(0.45, hopY * 0.35)));
      shadow.material.opacity = shadow.userData.baseOpacity * (1 - Math.min(0.6, hopY * 0.5));
      if (rig.onPose) rig.onPose(p);
    },
  };
  rig.pose({});
  return rig;
}

export function addHeadphones(rig) {
  const { lean, headY, radius: R } = rig;
  const band = mesh(new THREE.TorusGeometry(R + 0.045, 0.045, 10, 48, Math.PI), clay(C.ink, { clearcoat: 0.2 }), {
    inkScale: 0.75,
  });
  band.position.set(0, headY, -0.02);
  lean.add(band);
  const cupGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.12, 28);
  for (const sx of [-1, 1]) {
    const cup = mesh(cupGeo, clay(C.yellow));
    cup.rotation.z = Math.PI / 2;
    cup.position.set(sx * (R + 0.035), headY - 0.02, -0.02);
    lean.add(cup);
  }
}

export function addSprout(rig) {
  const { lean, height } = rig;
  const sprout = new THREE.Group();
  sprout.position.set(0.02, height - 0.03, 0);
  lean.add(sprout);
  const curve = new THREE.CatmullRomCurve3([
    new V3(0, -0.04, 0),
    new V3(0.0, 0.08, 0),
    new V3(0.04, 0.17, 0.0),
    new V3(0.1, 0.22, 0.0),
  ]);
  sprout.add(mesh(new THREE.TubeGeometry(curve, 20, 0.024, 8), clay('#46b98a'), { inkScale: 0.7 }));
  const leafGeo = new THREE.SphereGeometry(1, 20, 12);
  const leafA = mesh(leafGeo, clay(C.mint), { inkScale: 0.7 });
  leafA.scale.set(0.15, 0.055, 0.085);
  leafA.position.set(0.2, 0.25, 0);
  leafA.rotation.z = 0.45;
  const leafB = mesh(leafGeo, clay(C.mint), { inkScale: 0.7 });
  leafB.scale.set(0.11, 0.045, 0.07);
  leafB.position.set(-0.08, 0.15, 0);
  leafB.rotation.z = -0.6;
  sprout.add(leafA, leafB);
  rig.accessories.sprout = sprout;
}

function bubbleShape(w, h, r) {
  const s = new THREE.Shape();
  const k = 0.5523 * r;
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  s.moveTo(-0.02, y0);
  s.lineTo(x1 - r, y0);
  s.bezierCurveTo(x1 - r + k, y0, x1, y0 + r - k, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.bezierCurveTo(x1, y1 - r + k, x1 - r + k, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.bezierCurveTo(x0 + r - k, y1, x0, y1 - r + k, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.bezierCurveTo(x0, y0 + r - k, x0 + r - k, y0, x0 + r, y0);
  s.lineTo(-0.2, y0);
  s.quadraticCurveTo(-0.29, y0 - 0.17, -0.47, y0 - 0.28);
  s.quadraticCurveTo(-0.19, y0 - 0.21, -0.02, y0);
  return s;
}

/** The message mascot: a puffy chat bubble with a face. */
export function createBubbly() {
  const root = new THREE.Group();
  root.name = 'bubbly';
  const squash = new THREE.Group();
  root.add(squash);
  const geo = new THREE.ExtrudeGeometry(bubbleShape(1.26, 0.92, 0.4), {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.13,
    bevelSegments: 7,
    curveSegments: 20,
  });
  geo.translate(0, 0, -0.13);
  squash.add(mesh(geo, clay(C.mint)));
  const front = 0.29;
  const eyeL = makeEye(1.15);
  const eyeR = makeEye(1.15);
  eyeL.g.position.set(-0.2, 0.09, front);
  eyeR.g.position.set(0.2, 0.09, front);
  const mouth = makeMouth(1.1);
  mouth.g.position.set(0, -0.11, front - 0.004);
  squash.add(eyeL.g, eyeR.g, mouth.g);
  const blushMat = clay('#ff9cc9', { clearcoat: 0 });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(SPH_LO, blushMat);
    b.scale.set(0.085, 0.045, 0.02);
    b.position.set(sx * 0.4, -0.06, front - 0.006);
    squash.add(b);
  }
  return {
    root,
    squash,
    pose({ stretch = 1, blinkL = 0, blinkR = 0, happy = false, mouth: m = 0, lookX = 0, lookY = 0 } = {}) {
      const inv = 1 / Math.sqrt(stretch);
      squash.scale.set(stretch, inv, inv);
      eyeL.g.position.set(-0.2 + lookX * 0.04, 0.09 + lookY * 0.03, front);
      eyeR.g.position.set(0.2 + lookX * 0.04, 0.09 + lookY * 0.03, front);
      eyeL.set({ blink: blinkL, happy });
      eyeR.set({ blink: blinkR, happy });
      mouth.set(m);
    },
  };
}
