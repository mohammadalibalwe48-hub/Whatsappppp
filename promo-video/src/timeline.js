import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, ACCENTS, clay, mesh, contactShadow } from './lib/look.js';
import { clamp, lerp, prog, ease, keys, spring, wobble, bump, hop, noise1 } from './lib/anim.js';
import { createBean, addHeadphones, addSprout, createBubbly } from './world/characters.js';
import * as P from './world/props.js';
import * as S from './world/screens.js';

const V3 = THREE.Vector3;
const v = (x, y, z) => new V3(x, y, z);

export const FPS = 30;
export const DURATION = 20;

// Story beats (120 BPM grid: a beat every 0.5 s, a bar every 2 s).
export const BEATS = {
  slam: 4.0,
  emerge: 4.05,
  fly0: 4.75,
  fly1: 7.85,
  message: S.MESSAGE_AT,
  digits: S.DIGITS_AT,
  digitGap: S.DIGIT_GAP,
  verify: 12.0,
  ringArrive0: 16.25,
  ringGap: 0.105,
  logo: 17.1,
};

const blinkAt = (t, times, dur = 0.16) => {
  let b = 0;
  for (const bt of times) {
    const x = Math.abs(t - bt) / (dur / 2);
    if (x < 1) b = Math.max(b, 1 - x);
  }
  return b;
};
const invInOutSine = (u) => Math.acos(1 - 2 * u) / Math.PI;
const bezier = (a, b, c, p) =>
  new V3().copy(a).multiplyScalar((1 - p) * (1 - p)).addScaledVector(b, 2 * (1 - p) * p).addScaledVector(c, p * p);

// ---------------------------------------------------------------------------
// Camera: keyed shots plus a follow-cam for the flight.
const SHOT1 = [
  [0.0, [-0.2, 1.95, 4.5], [0.6, 1.45, -0.45]],
  [1.4, [-0.3, 1.9, 5.1], [0.45, 1.38, -0.3], ease.inOutSine],
  [3.0, [-0.5, 1.8, 6.8], [0.18, 1.12, 0.05], ease.inOutCubic],
  [3.95, [-0.95, 1.52, 5.55], [-0.45, 0.98, 0.45], ease.inOutSine],
  [4.4, [-0.1, 1.8, 5.7], [0.85, 1.5, 0.2], ease.inOutCubic],
];
const SHOT3 = [
  [7.8, [13.0, 2.25, 3.4], [13.9, 1.95, -0.9]],
  [8.7, [12.9, 1.86, 6.55], [13.55, 1.42, -0.6], ease.inOutCubic],
  [9.45, [14.3, 1.96, 7.05], [14.95, 1.5, -0.7], ease.inOutCubic],
  [10.95, [15.3, 1.96, 6.95], [15.6, 1.58, -0.75], ease.inOutSine],
  [11.95, [16.45, 1.92, 5.85], [16.75, 1.72, -0.75], ease.inOutCubic],
  [12.8, [16.3, 1.98, 5.65], [16.7, 1.78, -0.75], ease.inOutSine],
  [14.35, [7.6, 5.3, 20.0], [7.4, 1.3, -0.8], ease.inOutCubic],
  [15.3, [7.5, 5.6, 19.4], [7.4, 1.45, -0.8], ease.inOutSine],
  [17.0, [7.4, 13.6, 10.4], [7.4, 13.45, -2.0], ease.inOutCubic],
  [20.0, [7.4, 13.62, 9.9], [7.4, 13.45, -2.0], ease.linear],
];
const END_CAM = { pos: v(7.4, 13.6, 10.4), tgt: v(7.4, 13.45, -2.0) };
const END_SWAP = 16.45;
const BUB_RETURN = 12.7;

export function buildWorld(scene, camera, { sky }) {
  const world = new THREE.Group();
  scene.add(world);

  // ---- Station A: the developer ------------------------------------------
  world.add(P.island({ R: 3.3, baseColor: C.purple }));
  const devHome = { pos: v(-1.05, 0, 0.5), yaw: 0.22 };
  const dev = createBean({ name: 'dev', color: C.purple, facePatch: C.ground });
  addHeadphones(dev);
  world.add(dev.root);

  const deskGroup = new THREE.Group();
  deskGroup.position.copy(devHome.pos);
  deskGroup.rotation.y = devHome.yaw;
  world.add(deskGroup);
  const desk = mesh(new RoundedBoxGeometry(1.75, 0.52, 0.78, 4, 0.12), clay(C.yellow), { receive: true });
  desk.position.set(0.05, 0.26, 0.97);
  deskGroup.add(desk);
  const deskShadow = contactShadow(1, 0.3);
  deskShadow.scale.set(2.3, 1.3, 1);
  deskShadow.position.set(0.05, 0.006, 0.97);
  deskGroup.add(deskShadow);
  const kb = P.keyboard(S.createKeyLabel());
  kb.group.position.set(0.05, 0.585, 0.93);
  deskGroup.add(kb.group);
  const puff = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.05, 8, 48),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
  );
  puff.rotation.x = Math.PI / 2;
  puff.position.set(0.65, 0.2, 0.97 - 0.93 + 0.04);
  kb.group.add(puff);

  const code = S.createCodeScreen();
  const codeWin = P.slabPanel({
    w: 2.9, h: 1.85, d: 0.13, r: 0.12, color: C.inkUi, slabColor: C.pink, offset: 0.15, texture: code.texture, inset: 0.07,
  });
  const codeHome = v(1.75, 1.62, -0.45);
  codeWin.group.position.copy(codeHome);
  codeWin.group.rotation.y = -0.22;
  world.add(codeWin.group);
  const codeShadow = contactShadow(1, 0.2);
  codeShadow.scale.set(3.0, 1.2, 1);
  codeShadow.position.set(1.85, 0.006, -0.3);
  world.add(codeShadow);
  const codeFront = codeHome.clone().add(v(Math.sin(-0.22), 0, Math.cos(-0.22)).multiplyScalar(0.15));

  // ---- Station B: the user -----------------------------------------------
  const B = v(14.2, 0, -0.9);
  const islandB = P.island({ R: 3.6, baseColor: C.mint });
  islandB.position.copy(B);
  world.add(islandB);
  const anaHome = { pos: v(12.35, 0, -0.15), yaw: 0.45 };
  const ana = createBean({ name: 'ana', color: C.yellow, cheek: '#ff8fbf' });
  addSprout(ana);
  world.add(ana.root);

  const phoneScreen = S.createPhoneScreen();
  const phone = P.slabPanel({
    w: 1.5, h: 3.0, d: 0.2, r: 0.22, color: C.ink, slabColor: C.yellow, offset: 0.15, texture: phoneScreen.texture, inset: 0.075,
  });
  const phoneBase = new THREE.Group();
  const phoneHome = v(13.95, 1.85, -1.0);
  phoneBase.position.copy(phoneHome);
  phoneBase.rotation.set(-0.05, -0.12, 0);
  phoneBase.add(phone.group);
  world.add(phoneBase);
  const phoneShadow = contactShadow(1, 0.26);
  phoneShadow.scale.set(1.9, 0.9, 1);
  phoneShadow.position.set(14.05, 0.006, -0.95);
  world.add(phoneShadow);

  const cardTitle = S.createCardTitle();
  const card = P.otpCard(cardTitle.texture);
  const cardBase = new THREE.Group();
  const cardHome = v(16.75, 1.8, -0.75);
  cardBase.position.copy(cardHome);
  cardBase.rotation.y = -0.32;
  cardBase.add(card.group);
  world.add(cardBase);
  const cardShadow = contactShadow(1, 0.18);
  cardShadow.scale.set(3.2, 1.1, 1);
  cardShadow.position.set(16.4, 0.006, -0.6);
  world.add(cardShadow);
  const slotColors = { idle: new THREE.Color(C.lilac), flash: new THREE.Color(C.yellow), done: new THREE.Color(C.mint) };

  const digitTex = S.createDigitTextures();
  const tiles = S.CODE.split('').map((d) => {
    const tile = P.digitTile(digitTex[d]);
    tile.visible = false;
    world.add(tile);
    return tile;
  });

  const seal = P.badge();
  seal.position.set(1.48, 0.84, 0.24);
  seal.scale.setScalar(0.001);
  card.group.add(seal);
  const shock = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.035, 8, 72),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
  );
  shock.position.copy(seal.position);
  card.group.add(shock);
  const burst = P.confetti(58, 21);
  world.add(burst.group);

  // ---- Bubbly and the wave ------------------------------------------------
  const bub = createBubbly();
  world.add(bub.root);
  const flight = new THREE.CatmullRomCurve3(
    [
      v(1.55, 1.95, 0.45),
      v(3.3, 2.8, 1.0),
      v(5.1, 1.6, 1.45),
      v(6.9, 2.65, 1.05),
      v(8.7, 1.5, 0.8),
      v(10.5, 2.6, 0.5),
      v(12.35, 2.9, 0.6),
      v(13.9, 1.98, -0.6),
    ],
    false,
    'centripetal',
  );
  const flightU = (t) => ease.inOutSine(prog(t, BEATS.fly0, BEATS.fly1));
  const phoneFront = phoneHome.clone().add(v(Math.sin(-0.12), 0.05, Math.cos(-0.12)).multiplyScalar(0.12));

  // End card anchors, solved from the final camera so the lockup lands where the overlay expects it.
  const endCam = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 200);
  endCam.position.copy(END_CAM.pos);
  endCam.lookAt(END_CAM.tgt);
  endCam.updateMatrixWorld();
  const screenToPlane = (sx, sy, planeZ) => {
    const ndc = v((sx / 1920) * 2 - 1, 1 - (sy / 1080) * 2, 0.5).unproject(endCam);
    const dir = ndc.sub(endCam.position).normalize();
    const k = (planeZ - endCam.position.z) / dir.z;
    return endCam.position.clone().addScaledVector(dir, k);
  };
  const RING = { center: screenToPlane(660, 404, -2.0), radius: 0.7, dot: 0.19 };
  const ringSlot = (k) =>
    RING.center.clone().add(v(Math.sin((k * Math.PI) / 4) * RING.radius, Math.cos((k * Math.PI) / 4) * RING.radius, 0));
  const bubEnd = screenToPlane(1530, 268, -0.8);
  const devPeek = screenToPlane(330, 1080, 0.4).add(v(0, -0.42, 0));
  const anaPeek = screenToPlane(1600, 1080, 0.4).add(v(0, -0.38, 0));

  const trailCount = 16;
  const trail = Array.from({ length: trailCount }, (_, i) => {
    const u = 0.05 + (i * 0.75) / (trailCount - 1);
    const color = new THREE.Color(ACCENTS[i % 4]);
    const m = mesh(new THREE.SphereGeometry(1, 32, 24), clay(color.clone()), { cast: true });
    m.visible = false;
    world.add(m);
    return { m, u, pos: flight.getPointAt(u), born: BEATS.fly0 + (BEATS.fly1 - BEATS.fly0) * invInOutSine(u), color };
  });
  const purple = new THREE.Color(C.purple);

  // Set dressing echoing the hero illustration.
  const decor = [
    [P.sphereShape(0.9, C.yellow), v(6.6, 4.7, -5.5), 0.12, 0],
    [P.triShape(1.1, 0.35, C.pink), v(4.3, 0.55, 2.9), 0.1, 0.5],
    [P.tileShape(0.9, C.purple), v(9.7, 3.9, -3.2), 0.12, 0.3],
    [P.archShape(1.2, 1.5, 0.4, C.mint), v(8.1, 0.3, -4.0), 0.08, 0.15],
    [P.sphereShape(0.3, C.yellow), v(3.0, 3.6, -1.8), 0.1, 0],
    [P.sphereShape(0.36, C.mint), v(11.0, 0.45, 2.3), 0.08, 0],
    [P.sphereShape(0.45, C.pink), v(-2.9, 3.0, -2.6), 0.12, 0],
    [P.sphereShape(0.24, C.purple), v(-3.7, 1.3, 1.3), 0.08, 0],
    [P.triShape(0.7, 0.25, C.yellow), v(18.9, 4.9, -3.5), 0.1, 0.4],
    [P.tileShape(0.55, C.pink), v(19.4, 0.9, -1.2), 0.08, 0.35],
    [P.sphereShape(0.5, C.mint), v(15.2, 4.4, -3.6), 0.12, 0],
    [P.sphereShape(0.28, C.pink), v(12.8, 3.9, -2.0), 0.1, 0],
    // around the end card
    [P.sphereShape(0.42, C.yellow), screenToPlane(250, 230, -3.0), 0.1, 0],
    [P.triShape(0.8, 0.28, C.pink), screenToPlane(1720, 560, -2.6), 0.1, 0.45],
    [P.tileShape(0.6, C.mint), screenToPlane(190, 640, -2.2), 0.1, 0.35],
    [P.sphereShape(0.26, C.purple), screenToPlane(1280, 150, -3.4), 0.08, 0],
  ].map(([m, p, bob, spin], i) => {
    m.position.copy(p);
    world.add(m);
    return { m, p, bob, spin, i };
  });

  const pressed = new Map();
  const strokes = S.keystrokeTimes();
  const leftKeys = kb.layout.map((k, i) => (k.x < -0.18 && k.w === 1 ? i : -1)).filter((i) => i >= 0);
  const rightKeys = kb.layout.map((k, i) => (k.x >= -0.18 && k.w === 1 ? i : -1)).filter((i) => i >= 0);

  const camPos = new V3();
  const camTgt = new V3();
  const tmp = new V3();
  const q1 = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const qFlip = new THREE.Quaternion();
  const X = v(1, 0, 0);

  function bubblyAt(t) {
    // Position of Bubbly at time t (also used by the follow-cam).
    if (t < BEATS.emerge) return codeFront.clone();
    if (t < BEATS.fly0) return codeFront.clone().lerp(flight.getPointAt(0), ease.outBack(prog(t, BEATS.emerge, 4.5)));
    if (t < BEATS.fly1) return flight.getPointAt(flightU(t));
    return flight.getPointAt(1).lerp(phoneFront, ease.inCubic(prog(t, BEATS.fly1, 8.02)));
  }

  function cameraAt(t) {
    let pos;
    let tgt;
    const s1 = keys(t, SHOT1.map(([tt, p, _, e]) => [tt, p, e]));
    const s1t = keys(t, SHOT1.map(([tt, _, g, e]) => [tt, g, e]));
    const b0 = bubblyAt(t - 0.15);
    const b1 = bubblyAt(t + 0.1);
    const fPos = [b0.x - 1.25, b0.y + 0.5, b0.z + 6.0];
    const fTgt = [b1.x - 1.35, b1.y - 0.1, b1.z];
    const s3 = keys(t, SHOT3.map(([tt, p, _, e]) => [tt, p, e]));
    const s3t = keys(t, SHOT3.map(([tt, _, g, e]) => [tt, g, e]));
    const wFollow = ease.inOutCubic(prog(t, 4.3, 4.95));
    const wShot3 = ease.inOutCubic(prog(t, 7.45, 8.0));
    pos = s1.map((x, i) => lerp(lerp(x, fPos[i], wFollow), s3[i], wShot3));
    tgt = s1t.map((x, i) => lerp(lerp(x, fTgt[i], wFollow), s3t[i], wShot3));
    camPos.set(pos[0], pos[1], pos[2]);
    camTgt.set(tgt[0], tgt[1], tgt[2]);
    // handheld drift and impact shake
    const shake =
      (t > BEATS.slam ? 0.075 * Math.exp(-(t - BEATS.slam) * 9) : 0) +
      (t > BEATS.verify ? 0.055 * Math.exp(-(t - BEATS.verify) * 8) : 0);
    camPos.x += noise1(t * 0.55, 3) * 0.03 + noise1(t * 26, 1) * shake;
    camPos.y += noise1(t * 0.5, 4) * 0.025 + noise1(t * 26, 2) * shake;
    camTgt.x += noise1(t * 0.45, 5) * 0.02;
    camTgt.y += noise1(t * 0.4, 6) * 0.015;
  }

  function devPose(t) {
    const p = { leanX: 0.06, lookY: -0.7, lookX: 0.2, blink: blinkAt(t, [1.15, 2.62, 6.2, 9.4, 14.9, 18.9]) };
    const beat = (t % 0.5) / 0.5;
    const bob = Math.exp(-beat * 6);
    if (t < 3.1) {
      const ph = t * Math.PI * 2 * 5.2;
      const typing = clamp((t - 0.05) / 0.2) * (1 - prog(t, 2.8, 3.1));
      p.armL = { x: lerp(-0.12, -1.5 - 0.2 * Math.max(0, Math.sin(ph)), typing), z: lerp(0.32, 0.06, typing) };
      p.armR = { x: lerp(-0.12, -1.5 - 0.2 * Math.max(0, Math.sin(ph + 2.2)), typing), z: lerp(0.32, 0.06, typing) };
      p.squash = 1 - 0.03 * bob;
      p.leanX = 0.08 + 0.035 * bob;
      const glance = bump(t, 1.45, 2.45);
      p.lookX = 0.2 + glance * 0.8;
      p.lookY = -0.7 + glance * 1.0;
      p.turn = glance * 0.16;
      p.mouth = glance > 0.6 ? 0.35 : 0;
    } else if (t < BEATS.slam) {
      const w = ease.outCubic(prog(t, 3.1, 3.6));
      const s = ease.inQuad(prog(t, 3.84, 3.985));
      const tremble = t > 3.6 && t < 3.84 ? Math.sin(t * 70) * 0.03 : 0;
      p.armL = { x: -1.48, z: 0.08 };
      p.armR = { x: lerp(lerp(-1.5, -2.7, w), -1.42, s), z: lerp(lerp(0.06, 0.5, w), 0.26, s) + tremble };
      p.squash = lerp(lerp(1, 1.07, w), 0.9, s);
      p.leanX = lerp(lerp(0.08, -0.12, w), 0.2, s);
      p.turn = lerp(0, 0.14, w);
      p.lookX = 0.55;
      p.lookY = lerp(-0.25, -0.85, s);
      p.blink = Math.max(p.blink, 0.42 * w * (1 - s));
    } else if (t < END_SWAP) {
      const k = t - BEATS.slam;
      p.squash = 1 - 0.12 * Math.exp(-k * 9) * Math.cos(k * 30);
      const lift = ease.inOutCubic(prog(t, 4.25, 4.6));
      p.armR = { x: lerp(-1.42, -0.35, lift), z: lerp(0.26, 0.95, lift) };
      p.armL = { x: lerp(-1.48, -0.3, lift), z: lerp(0.08, 0.55, lift) };
      p.leanX = lerp(0.2, -0.04, ease.outCubic(prog(t, 4.0, 4.4)));
      p.turn = lerp(0.14, 0.55, ease.inOutCubic(prog(t, 4.1, 4.6)));
      p.lookX = 1;
      p.lookY = 0.6;
      p.happy = t < 4.95;
      p.mouth = t < 4.95 ? 0.7 : 0;
      if (t > 13.9) {
        const h1 = hop(t, 14.25, 0.42, 0.38);
        const h2 = hop(t, 14.82, 0.42, 0.38);
        p.hop = h1.y + h2.y;
        p.squash = h1.squash * h2.squash;
        const up = ease.outBack(prog(t, 14.0, 14.3));
        p.armL = { x: -0.2, z: lerp(0.55, 2.6, up) + 0.2 * Math.sin(t * 15) * up };
        p.armR = { x: -0.2, z: lerp(0.95, 2.6, up) + 0.2 * Math.sin(t * 15 + 1) * up };
        p.happy = true;
        p.mouth = 0.8;
        p.turn = lerp(0.55, 0.15, prog(t, 13.9, 14.3));
        p.lookX = 0.2;
        p.lookY = 0.3;
      }
    } else {
      const wave = Math.sin((t - 17.3) * Math.PI * 2 * 1.8);
      p.armR = { x: -0.25, z: 2.35 + 0.4 * wave };
      p.armL = { x: -0.1, z: 0.4 };
      p.turn = 0.25;
      p.lookX = 0.6;
      p.lookY = 0.5;
      p.mouth = 0.55;
      p.happy = t > 18.3 && t < 18.75;
      p.squash = 1 + 0.02 * Math.sin(t * 6);
    }
    return p;
  }

  function anaPose(t) {
    const p = { turn: 0.25, lookX: 0.8, lookY: -0.15, blink: blinkAt(t, [0.8, 3.4, 6.9, 10.15, 11.05, 14.4, 18.25]) };
    p.squash = 1 + Math.sin(t * Math.PI) * 0.012;
    let sprout = Math.sin(t * 2.3) * 0.05;
    if (t >= 7.3 && t < 8.05) {
      const k = ease.inOutCubic(prog(t, 7.3, 7.65));
      p.lookY = lerp(-0.15, 0.9, k);
      p.lookX = lerp(0.8, 0.3, k);
      p.turn = lerp(0.25, 0.05, k);
    }
    if (t >= 8.05 && t < 12.0) {
      const surprise = ease.outBack(prog(t, 8.08, 8.25));
      p.wide = 1 + 0.25 * surprise * (1 - prog(t, 8.8, 9.2));
      p.mouth = 0.75 * surprise * (1 - prog(t, 9.0, 9.3));
      const h = hop(t, 8.28, 0.36, 0.28);
      p.hop = h.y;
      p.squash *= h.squash;
      sprout += wobble(t, 8.28, 3.2, 3.5, 0.5) + wobble(t, 8.64, 3.2, 3.5, -0.35);
      const armsUp = bump(t, 8.18, 8.85);
      p.armL = { x: -0.3, z: 0.32 + 1.7 * armsUp };
      p.armR = { x: -0.3, z: 0.32 + 1.7 * armsUp };
      const face = ease.inOutCubic(prog(t, 8.6, 9.1));
      p.turn = lerp(0.05, 0.55, face);
      p.lookX = lerp(0.3, 1.0, face);
      p.lookY = lerp(0.9, 0.1, ease.inOutCubic(prog(t, 8.3, 8.9)));
      const watch = ease.inOutCubic(prog(t, 9.2, 10.5));
      p.turn = lerp(p.turn, 0.95, watch);
      p.lookY = lerp(p.lookY, 0.55, bump(t, 9.2, 10.9));
      const ant = ease.inOutCubic(prog(t, 11.15, 11.75));
      p.leanX = 0.1 * ant;
      p.armL = { x: lerp(p.armL.x, -0.95, ant), z: lerp(p.armL.z, 0.02, ant) };
      p.armR = { x: lerp(p.armR.x, -0.95, ant), z: lerp(p.armR.z, 0.02, ant) };
    }
    if (t >= 12.0 && t < END_SWAP) {
      const h1 = hop(t, 12.08, 0.42, 0.48);
      const h2 = hop(t, 12.62, 0.42, 0.42);
      const h3 = hop(t, 14.5, 0.4, 0.32);
      p.hop = h1.y + h2.y + h3.y;
      p.squash *= h1.squash * h2.squash * h3.squash;
      sprout += wobble(t, 12.08, 3.2, 3, 0.55) + wobble(t, 12.62, 3.2, 3, -0.5) + wobble(t, 14.5, 3.2, 3, 0.4);
      const up = ease.outBack(prog(t, 12.0, 12.2));
      p.armL = { x: -0.2, z: lerp(0.3, 2.65, up) + 0.22 * Math.sin(t * 16) };
      p.armR = { x: -0.2, z: lerp(0.3, 2.65, up) + 0.22 * Math.sin(t * 16 + 1.2) };
      p.happy = true;
      p.mouth = 0.85;
      p.turn = lerp(0.95, 0.35, ease.inOutCubic(prog(t, 12.0, 12.5)));
      p.lookX = 0.3;
      p.lookY = 0.2;
    }
    if (t >= END_SWAP) {
      const wave = Math.sin((t - 17.45) * Math.PI * 2 * 1.8 + 1.0);
      p.armL = { x: -0.25, z: 2.35 + 0.4 * wave };
      p.armR = { x: -0.1, z: 0.4 };
      p.turn = -0.3;
      p.lookX = -0.6;
      p.lookY = 0.5;
      p.mouth = 0.55;
      p.happy = t > 18.45 && t < 18.9;
      sprout += wobble(t, 17.55, 3, 3, 0.5);
    }
    p.sprout = sprout;
    return p;
  }

  function bubblyPose(t) {
    // returns placement + expression
    const st = { visible: true, pos: bubblyAt(t), rot: v(0, 0, 0), scale: 1, stretch: 1, face: {} };
    if (t < BEATS.emerge || (t > 8.02 && t < BUB_RETURN)) {
      st.visible = false;
      return st;
    }
    if (t < BEATS.fly0) {
      st.scale = Math.max(0.001, spring(t, BEATS.emerge, 2.8, 0.42));
      st.stretch = 1 + wobble(t, BEATS.emerge, 3.5, 6, 0.25) - 0.16 * bump(t, 4.58, BEATS.fly0);
      st.rot.y = wobble(t, BEATS.emerge, 2, 4, 0.5) + 0.15;
      st.face = { happy: t < 4.28, blinkL: bump(t, 4.4, 4.58), mouth: t < 4.28 ? 0.6 : 0 };
      return st;
    }
    if (t < BEATS.fly1) {
      const u = flightU(t);
      const tan = flight.getTangentAt(Math.min(0.999, u));
      const speed = flight.getLength() * ((flightU(t + 0.02) - flightU(t - 0.02)) / 0.04);
      st.rot.set(-tan.y * 0.25, 0.42, clamp(tan.y * 0.9, -0.5, 0.5));
      st.stretch = 1 + Math.min(0.28, speed * 0.045);
      st.face = { mouth: t > 5.2 && t < 6.4 ? 0.55 : 0, happy: t > 6.4 && t < 7.2, blinkL: blinkAt(t, [5.0]), blinkR: blinkAt(t, [5.0]) };
      return st;
    }
    if (t <= 8.02) {
      const k = prog(t, BEATS.fly1, 8.02);
      st.scale = Math.max(0.001, 1 - ease.inCubic(k));
      st.stretch = 1 + 0.5 * k;
      st.rot.set(0, 0.3, -0.35 * k);
      st.face = { happy: true, mouth: 0.6 };
      return st;
    }
    // After the verify burst: pops back out of the phone, arcs over to the wide shot, then leads the dots to the logo.
    const hover = v(9.6, 3.7, 1.2);
    if (t < 13.5) {
      const k = ease.inOutCubic(prog(t, BUB_RETURN, 13.5));
      st.pos = bezier(phoneFront, phoneFront.clone().add(v(-1.4, 2.4, 1.2)), hover, k);
      st.scale = Math.max(0.001, spring(t, BUB_RETURN, 2.6, 0.45));
      st.stretch = 1 + 0.2 * bump(t, BUB_RETURN + 0.15, 13.4);
      st.rot.set(0, -0.2, 0.25 * Math.sin(k * Math.PI));
      st.face = { happy: true, mouth: 0.7 };
      return st;
    }
    if (t < 15.3) {
      const k = t - 13.5;
      st.pos = v(9.6 + Math.sin(k * 1.8) * 0.5, 3.7 + Math.sin(k * 3.6) * 0.18, 1.2);
      st.rot.set(0, 0.1, Math.cos(k * 1.8) * 0.2);
      st.face = { happy: k > 0.6 && k < 1.2, mouth: 0.4 };
      return st;
    }
    const from = v(9.6 + Math.sin(1.8 * 1.8) * 0.5, 3.7 + Math.sin(1.8 * 3.6) * 0.18, 1.2);
    if (t < 17.4) {
      const k = ease.inOutCubic(prog(t, 15.3, 17.4));
      const ctrl = v(6.0, 12.5, 2.5);
      st.pos = bezier(from, ctrl, bubEnd, k);
      st.rot.set(0, 0.2, Math.sin(k * Math.PI * 2) * 0.35);
      st.stretch = 1 + 0.18 * bump(t, 15.3, 17.0);
      st.face = { mouth: 0.5, happy: k > 0.8 };
      return st;
    }
    st.pos = bubEnd.clone().add(v(0, Math.sin((t - 17.4) * 2.6) * 0.08, 0));
    st.rot.set(0, -0.25, Math.sin((t - 17.4) * 1.3) * 0.08);
    st.stretch = 1 + wobble(t, 17.4, 2.5, 4, 0.12);
    st.face = { blinkL: bump(t, 18.62, 18.85), mouth: 0.15, lookX: -0.6, lookY: -0.3 };
    return st;
  }

  function update(t) {
    // ---- characters (they hop over to the end card once the crane has left the islands)
    const atEnd = t >= END_SWAP;
    const dp = devPose(t);
    if (atEnd) {
      const rise = ease.outBack(prog(t, 17.25, 17.7));
      dev.root.position.copy(devPeek).add(v(0, lerp(-1.9, 0, rise), 0));
      dev.root.rotation.y = 0.15;
    } else {
      dev.root.position.copy(devHome.pos);
      dev.root.rotation.y = devHome.yaw;
    }
    dev.root.visible = !atEnd || t >= 17.25;
    dev.pose(dp);

    const ap = anaPose(t);
    if (atEnd) {
      const rise = ease.outBack(prog(t, 17.4, 17.85));
      ana.root.position.copy(anaPeek).add(v(0, lerp(-1.9, 0, rise), 0));
      ana.root.rotation.y = -0.2;
    } else {
      ana.root.position.copy(anaHome.pos);
      ana.root.rotation.y = anaHome.yaw;
    }
    ana.root.visible = !atEnd || t >= 17.4;
    ana.pose(ap);
    ana.accessories.sprout.rotation.z = ap.sprout;

    // ---- keyboard and the big send key
    pressed.clear();
    strokes.forEach((st, i) => {
      const x = t - st;
      if (x >= 0 && x < 0.1) {
        const list = i % 2 ? rightKeys : leftKeys;
        pressed.set(list[(i * 7) % list.length], Math.sin((x / 0.1) * Math.PI));
      }
    });
    kb.pressKeys(pressed);
    const sendDown = t >= 3.97 ? Math.max(0, 1 - (t - 3.97) / 0.3) : 0;
    kb.send.position.y = 0.05 - 0.045 * ease.outQuad(sendDown) + wobble(t, 4.25, 6, 9, 0.012);
    kb.send.scale.set(1 + 0.06 * sendDown, 1 - 0.25 * sendDown, 1 + 0.06 * sendDown);
    desk.scale.set(1, 1 + wobble(t, BEATS.slam, 7, 9, 0.05), 1);
    const puffK = prog(t, BEATS.slam, 4.45);
    puff.visible = puffK > 0 && puffK < 1;
    puff.scale.setScalar(0.15 + ease.outCubic(puffK) * 0.75);
    puff.material.opacity = 0.85 * (1 - puffK);

    // ---- code window
    code.draw(t);
    codeWin.group.position.copy(codeHome).add(v(0, Math.sin(t * 1.6 + 1) * 0.035, 0));
    codeWin.group.scale.setScalar(1 + wobble(t, BEATS.slam, 4, 7, 0.035) + 0.05 * bump(t, 4.02, 4.3));

    // ---- phone
    phoneScreen.draw(t);
    phoneBase.position.copy(phoneHome).add(v(0, Math.sin(t * 1.7) * 0.04, 0));
    phoneBase.rotation.z = wobble(t, 8.0, 17, 6.5, 0.06);
    phoneBase.scale.setScalar(1 + 0.04 * bump(t, 7.95, 8.2));

    // ---- card, slots, tiles, badge
    cardTitle.draw(t);
    cardBase.position.copy(cardHome).add(v(0, Math.sin(t * 1.5 + 2) * 0.035, 0));
    const cardPop = -0.03 * ease.inOutCubic(prog(t, 11.75, 12.0)) * (t < 12 ? 1 : 0) + wobble(t, BEATS.verify, 3, 6, 0.05);
    cardBase.scale.setScalar(1 + cardPop);
    world.updateMatrixWorld(true);

    card.slots.forEach((slot, i) => {
      const land = S.DIGITS_AT + i * S.DIGIT_GAP + 0.55;
      const scan = 11.3 + i * 0.07;
      const done = BEATS.verify + i * 0.045;
      const flash = Math.max(bump(t, land, land + 0.3), bump(t, scan, scan + 0.16) * 0.9);
      slot.material.color.copy(slotColors.idle).lerp(slotColors.flash, flash);
      if (t >= done) slot.material.color.copy(slotColors.idle).lerp(slotColors.done, ease.outCubic(prog(t, done, done + 0.15)));
      slot.scale.setScalar(1 + wobble(t, done, 4, 7, 0.08));
    });

    const digitsLocal = phoneScreen.layout.digits.map(({ x, y }) =>
      v((x / S.PHONE_CANVAS.w - 0.5) * (1.5 - 0.15), (0.5 - y / S.PHONE_CANVAS.h) * (3.0 - 0.15), 0.03),
    );
    phone.screen.getWorldQuaternion(q1);
    tiles.forEach((tile, i) => {
      const t0 = S.DIGITS_AT + i * S.DIGIT_GAP;
      const t1 = t0 + 0.55;
      if (t < t0) {
        tile.visible = false;
        return;
      }
      tile.visible = true;
      const start = phone.screen.localToWorld(digitsLocal[i].clone());
      const slot = card.slots[i];
      const end = slot.localToWorld(v(0, 0, 0.1));
      slot.getWorldQuaternion(q2);
      const k = ease.inOutCubic(prog(t, t0, t1));
      const ctrl = start.clone().lerp(end, 0.5).add(v(0, 1.15, 1.0));
      tile.position.copy(bezier(start, ctrl, end, k));
      qFlip.setFromAxisAngle(X, Math.PI * 2 * k);
      tile.quaternion.copy(q1).slerp(q2, k).multiply(qFlip);
      let s = 0.45 + 0.55 * ease.outBack(prog(t, t0, t0 + 0.22));
      s *= 1 + wobble(t, t1, 5, 9, 0.14);
      const done = BEATS.verify + i * 0.045;
      tile.position.y += 0.08 * bump(t, done, done + 0.28);
      tile.scale.setScalar(s);
    });

    const sealK = Math.max(0.001, spring(t, BEATS.verify, 2.3, 0.36)) * 1.15;
    seal.scale.setScalar(t < BEATS.verify ? 0.001 : sealK);
    seal.rotation.y = t < BEATS.verify ? 0 : lerp(-Math.PI, 0, ease.outCubic(prog(t, BEATS.verify, 12.5)));
    const shockK = prog(t, BEATS.verify, 12.5);
    shock.visible = shockK > 0 && shockK < 1;
    shock.scale.setScalar(0.4 + 2.3 * ease.outCubic(shockK));
    shock.material.opacity = 0.9 * (1 - shockK);
    burst.update(t, BEATS.verify + 0.02, seal.getWorldPosition(tmp));

    // ---- Bubbly
    const bs = bubblyPose(t);
    bub.root.visible = bs.visible;
    if (bs.visible) {
      bub.root.position.copy(bs.pos);
      bub.root.rotation.set(bs.rot.x, bs.rot.y, bs.rot.z);
      bub.root.scale.setScalar(bs.scale);
      bub.pose({ stretch: bs.stretch, ...bs.face });
    }

    // ---- trail dots -> logo ring
    trail.forEach((d, i) => {
      if (t < d.born) {
        d.m.visible = false;
        return;
      }
      d.m.visible = true;
      const r0 = 0.12;
      const idle = d.pos.clone().add(v(0, Math.sin(t * 2.2 + i) * 0.05, 0));
      let pos = idle;
      let radius = r0 * Math.max(0.001, spring(t, d.born, 3, 0.4));
      d.m.material.color.copy(d.color);
      if (i < 8) {
        const arrive = BEATS.ringArrive0 + i * BEATS.ringGap;
        const launch = arrive - 1.05;
        if (t >= launch) {
          const k = ease.inOutCubic(prog(t, launch, arrive));
          const target = ringSlot(i);
          const ctrl = idle.clone().lerp(target, 0.5).add(v(-1.5 + i * 0.4, 1.5, 2.2));
          pos = bezier(idle, ctrl, target, k);
          radius = lerp(r0, RING.dot, ease.inOutCubic(prog(t, launch + 0.4, arrive)));
          d.m.material.color.copy(d.color).lerp(purple, ease.inOutCubic(prog(t, arrive - 0.45, arrive)));
          if (t >= arrive) {
            radius = RING.dot * (1 + wobble(t, arrive, 4, 7, 0.25));
            const ph = (t - BEATS.logo) * 0.8 - i / 8;
            const pulse = t > BEATS.logo ? Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 3) * 0.1 : 0;
            radius *= 1 + pulse + wobble(t, BEATS.logo, 3, 5, 0.08);
          }
        }
      } else {
        const depart = 15.25 + (i - 8) * 0.06;
        if (t >= depart) {
          const k = prog(t, depart, depart + 0.8);
          pos = idle.clone().add(v(0, ease.inCubic(k) * 4.5, 0));
          radius *= 1 - ease.inCubic(k);
          if (k >= 1) d.m.visible = false;
        }
      }
      d.m.position.copy(pos);
      d.m.scale.setScalar(Math.max(0.001, radius));
    });

    // ---- set dressing
    decor.forEach((d) => {
      d.m.position.copy(d.p).add(v(0, Math.sin(t * 0.9 + d.i * 1.7) * d.bob, 0));
      d.m.rotation.set(Math.sin(t * 0.4 + d.i) * 0.25, t * d.spin + d.i, Math.cos(t * 0.35 + d.i) * 0.15);
    });

    // ---- camera
    cameraAt(t);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    camera.updateMatrixWorld();

    // ---- sky: soft hero sky, warming to the cream ground for the end card
    const endK = ease.inOutCubic(prog(t, 15.6, 17.0));
    sky.uniforms.uTop.value.set(C.skyTop).lerp(new THREE.Color('#f3efff'), endK);
    sky.uniforms.uMid.value.set(C.skyMid).lerp(new THREE.Color(C.ground), endK);
    sky.uniforms.uLow.value.set(C.skyLow).lerp(new THREE.Color('#eafcf3'), endK);

    const ringScreen = RING.center.clone().project(camera);
    const ringEdge = RING.center.clone().add(v(RING.radius + RING.dot, 0, 0)).project(camera);
    const wide = ease.inOutCubic(prog(t, 12.85, 14.2)) * (1 - ease.inOutCubic(prog(t, 15.4, 16.6)));
    return {
      focus: camTgt.clone(),
      shadowSize: lerp(7.5, 12.5, wide),
      fade: Math.max(1 - prog(t, 0, 0.3), prog(t, 19.62, 20.0)),
      flash: 0.22 * Math.max(0, 1 - Math.abs(t - BEATS.verify) / 0.08) + 0.12 * Math.max(0, 1 - Math.abs(t - BEATS.slam) / 0.06),
      ring: { x: (ringScreen.x + 1) * 960, y: (1 - ringScreen.y) * 540, r: (ringEdge.x - ringScreen.x) * 960 },
    };
  }

  return { update, beats: BEATS };
}
