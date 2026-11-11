import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// OtpWave "playful geometric" design tokens (web/app/globals.css).
export const C = {
  ground: '#fffdf5',
  panel: '#ffffff',
  ink: '#252b3a',
  inkUi: '#253044',
  purple: '#6434df',
  pink: '#ff78c5',
  yellow: '#ffd05b',
  mint: '#9bf1cd',
  mintSoft: '#e9fff5',
  lilac: '#f1ebff',
  rule: '#b8b6c5',
  muted: '#59606e',
  skyTop: '#cfe5e8',
  skyMid: '#e6f0ec',
  skyLow: '#f1eadb',
};

export const ACCENTS = [C.purple, C.pink, C.yellow, C.mint];

export const view = { width: 1920, height: 1080, pixelRatio: 1 };

// ---------------------------------------------------------------------------
// Ink outlines (inverted hull). Width is in output pixels and thins with depth,
// echoing the 2-3px borders used across the site.
const outlineUniforms = {
  uRes: { value: new THREE.Vector2(1920, 1080) },
  uWidth: { value: 4.0 },
};

function makeOutlineMaterial(color = C.ink, widthScale = 1) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uRes: outlineUniforms.uRes,
      uWidth: outlineUniforms.uWidth,
      uScale: { value: widthScale },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      uniform vec2 uRes;
      uniform float uWidth;
      uniform float uScale;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vec2 dir = (projectionMatrix * vec4(n, 0.0)).xy * uRes;
        float len = length(dir);
        dir = len > 1e-6 ? dir / len : vec2(0.0);
        float px = uWidth * uScale * clamp(7.5 / max(clip.w, 0.001), 0.42, 1.12);
        clip.xy += dir * px * 2.0 / uRes * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }`,
  });
}

const sharedOutline = makeOutlineMaterial();
const hullCache = new WeakMap();

export function setOutlineResolution(w, h, pixelRatio) {
  outlineUniforms.uRes.value.set(w * pixelRatio, h * pixelRatio);
  outlineUniforms.uWidth.value = 4.0 * pixelRatio;
}

/** Adds an ink hull to a mesh. Hull normals are welded so hard seams don't crack. */
export function outline(mesh, { scale = 1, color = null } = {}) {
  let hull = hullCache.get(mesh.geometry);
  if (!hull) {
    let g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g = mergeVertices(g, 1e-3);
    g.computeVertexNormals();
    hull = g;
    hullCache.set(mesh.geometry, hull);
  }
  const mat = scale === 1 && !color ? sharedOutline : makeOutlineMaterial(color || C.ink, scale);
  const o = new THREE.Mesh(hull, mat);
  o.name = 'outline';
  o.castShadow = false;
  o.receiveShadow = false;
  mesh.add(o);
  return mesh;
}

// ---------------------------------------------------------------------------
// Materials: soft vinyl/clay, so the scene reads as handmade toys rather than chrome.
export function clay(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.5,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.42,
    ...opts,
  });
}

export function matte(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...opts });
}

export function unlit(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

export function mesh(geometry, material, { cast = true, receive = false, ink = true, inkScale = 1 } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  if (ink) outline(m, { scale: inkScale });
  return m;
}

// ---------------------------------------------------------------------------
let blobTexture = null;
/** Soft contact shadow decal (cheap ambient occlusion under objects). */
export function contactShadow(size = 1, opacity = 0.32) {
  if (!blobTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(37,43,58,1)');
    gr.addColorStop(0.42, 'rgba(37,43,58,0.6)');
    gr.addColorStop(1, 'rgba(37,43,58,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    blobTexture = new THREE.CanvasTexture(c);
    blobTexture.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false, opacity }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.setScalar(size);
  m.renderOrder = 2;
  m.userData.baseOpacity = opacity;
  return m;
}

// ---------------------------------------------------------------------------
/** Full-screen gradient sky, drawn first. Colors can be blended per frame. */
export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color(C.skyTop) },
    uMid: { value: new THREE.Color(C.skyMid) },
    uLow: { value: new THREE.Color(C.skyLow) },
    uGlow: { value: new THREE.Vector3(0.5, 0.86, 0.55) },
    uGlowColor: { value: new THREE.Color('#ffffff') },
    uAspect: { value: 16 / 9 },
  };
  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uLow, uGlowColor, uGlow;
      uniform float uAspect;
      varying vec2 vUv;
      void main() {
        float y = vUv.y;
        vec3 col = y > 0.48 ? mix(uMid, uTop, smoothstep(0.48, 1.0, y)) : mix(uLow, uMid, smoothstep(0.0, 0.48, y));
        vec2 d = (vUv - uGlow.xy) * vec2(uAspect, 1.0) * vec2(0.62, 1.15);
        float glow = exp(-dot(d, d) * 3.2) * uGlow.z;
        col = mix(col, uGlowColor, glow);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  m.frustumCulled = false;
  m.renderOrder = -1000;
  return { mesh: m, uniforms };
}

// ---------------------------------------------------------------------------
/** Final grade: soft highlight shoulder, sRGB encode, vignette, fine grain, fades. */
export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1920, 1080) },
    uFrame: { value: 0 },
    uGrain: { value: 0.017 },
    uVignette: { value: 0.12 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Vector3(1.0, 0.992, 0.961) },
    uFlash: { value: 0 },
    uAberration: { value: 0.0008 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uFrame, uGrain, uVignette, uFade, uFlash, uAberration;
    uniform vec3 uFadeColor;
    varying vec2 vUv;

    vec3 shoulder(vec3 c) {
      vec3 x = max(c - 0.86, 0.0);
      return min(c, vec3(0.86)) + 0.14 * (1.0 - exp(-x / 0.14));
    }
    vec3 toSRGB(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec2 off = d * r2 * uAberration * 4.0;
      vec3 col = vec3(
        texture2D(tDiffuse, vUv + off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - off).b
      );
      col = toSRGB(shoulder(col));
      col *= 1.0 - uVignette * smoothstep(0.08, 0.62, r2 * 1.6);
      col = mix(col, vec3(1.0), uFlash);
      col = mix(col, uFadeColor, uFade);
      vec2 px = floor(vUv * uRes);
      float n = hash(px + vec2(mod(uFrame, 97.0) * 17.0, mod(uFrame, 89.0) * 31.0)) +
                hash(px * 1.37 + vec2(uFrame * 3.1, 7.0)) - 1.0;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col += n * uGrain * (0.55 + 0.45 * (1.0 - lum));
      gl_FragColor = vec4(col, 1.0);
    }`,
};
