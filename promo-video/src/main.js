import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { C, createSky, FinalShader, setOutlineResolution } from './lib/look.js';
import { buildWorld, FPS, DURATION } from './timeline.js';
import { createOverlay } from './overlay.js';

const W = 1920;
const H = 1080;

async function loadFonts() {
  const faces = [
    '700 100px "Host Grotesk"',
    '600 100px "Host Grotesk"',
    '500 40px "Instrument Sans"',
    '600 40px "Instrument Sans"',
    '700 40px "Instrument Sans"',
    '500 40px "JetBrains Mono"',
    '700 40px "JetBrains Mono"',
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f)));
  await document.fonts.ready;
  for (const f of faces) if (!document.fonts.check(f)) throw new Error(`font failed to load: ${f}`);
}

async function boot() {
  await loadFonts();
  const dpr = window.devicePixelRatio || 1;
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  setOutlineResolution(W, H, dpr);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  scene.fog = new THREE.Fog(new THREE.Color(C.skyMid), 30, 80);
  const sky = createSky();
  scene.add(sky.mesh);

  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#f6fbff', '#eadfcb', 0.45));
  const key = new THREE.DirectionalLight('#fff3e0', 2.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.intensity = 0.82;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#e2f0ff', 0.85);
  scene.add(rim, rim.target);

  const world = buildWorld(scene, camera, { sky });
  const overlay = createOverlay(document.getElementById('overlay'));

  const rt = new THREE.WebGLRenderTarget(W * dpr, H * dpr, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(dpr);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const grade = new ShaderPass(FinalShader);
  grade.uniforms.uRes.value.set(W * dpr, H * dpr);
  composer.addPass(grade);

  const keyOffset = new THREE.Vector3(-5, 9, 6);
  const rimOffset = new THREE.Vector3(6, 6, -10);
  window.renderFrame = (frame) => {
    const t = frame / FPS;
    const info = world.update(t);
    key.position.copy(info.focus).add(keyOffset);
    key.target.position.copy(info.focus);
    const s = info.shadowSize;
    Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    key.shadow.camera.updateProjectionMatrix();
    rim.position.copy(info.focus).add(rimOffset);
    rim.target.position.copy(info.focus);
    grade.uniforms.uFrame.value = frame;
    grade.uniforms.uFade.value = info.fade;
    grade.uniforms.uFlash.value = info.flash;
    overlay.update(t, info);
    composer.render();
    return true;
  };
  window.__meta = { fps: FPS, duration: DURATION, frames: Math.round(FPS * DURATION) };
  window.__ready = true;
}

boot().catch((e) => {
  console.error(e);
  window.__error = String((e && e.stack) || e);
});
