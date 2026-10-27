// 3D table: an orbital war-room deck above Earth. The game itself is untouched — its two board rows are
// moved into a CSS3D object that lies on the deck, so they stay real DOM (clicks, hover, drag, the 2D
// VFX that read getBoundingClientRect). WebGL draws everything around them, and a second transparent
// WebGL layer draws sparks over the board. Camera: three views (V / 🎥), held still between switches, and
// the game's screenShake() now shakes the camera.
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const $ = id => document.getElementById(id);
const D2R = Math.PI / 180;
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const gameReady = () => { try { return !!(G && G.player && G.enemy); } catch (e) { return false; } };
const vfxOn = () => { try { return VFX.on !== false; } catch (e) { return true; } };

const app = $('app'), slot = document.querySelector('.board-slot');
const rows = app ? [...app.querySelectorAll(':scope > .row')] : [];
if (!slot || rows.length < 2) throw new Error('3D table: board rows not found');

// ---------- renderers (if WebGL is unavailable this throws and the 2D table stays) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const fxRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
for (const r of [renderer, fxRenderer]) { r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); r.outputColorSpace = THREE.SRGBColorSpace; }
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
fxRenderer.setClearColor(0x000000, 0);
$('scene3d').appendChild(renderer.domElement);
$('fx3d').appendChild(fxRenderer.domElement);
const cssRenderer = new CSS3DRenderer();
$('board3dLayer').appendChild(cssRenderer.domElement);
// Backstop for the CSS overflow:clip: if anything still scrolls the 3D containers, put them back.
$('board3dLayer').addEventListener('scroll', e => {
  const t = e.target;
  if (t !== board && !board.contains(t) && (t.scrollLeft || t.scrollTop)) { t.scrollLeft = 0; t.scrollTop = 0; }
}, true);

const scene = new THREE.Scene(), fxScene = new THREE.Scene(), cssScene = new THREE.Scene();
scene.background = new THREE.Color(0x020309);
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 20, 160000);

// ---------- the board: the game's own rows, laid flat on the deck ----------
const board = document.createElement('div'); board.id = 'board3d';
rows.forEach(r => board.appendChild(r));
const boardObj = new CSS3DObject(board);
boardObj.rotation.x = -Math.PI / 2;
cssScene.add(boardObj);
let BW = 0, BH = 0;
const RIM = 46;   // deck margin visible around the mats

// ---------- shared helpers ----------
const BOX = new THREE.BoxGeometry(1, 1, 1);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: .6, roughness: .45, ...o });
const glow = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
function box(parent, m, w, h, d, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(BOX, m); b.scale.set(w, h, d); b.position.set(x, y, z); parent.add(b); return b;
}
function glowTexture(inner, outer = 'rgba(0,0,0,0)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, '#fff'); gr.addColorStop(.18, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_GOLD = glowTexture('rgba(255,196,80,.9)'), TEX_CYAN = glowTexture('rgba(90,200,255,.9)');
const TEX_RED = glowTexture('rgba(255,70,70,.9)'), TEX_WHITE = glowTexture('rgba(255,255,255,.85)');
const sprite = (tex, size, color = 0xffffff) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1); return s;
};

// ---------- lights ----------
const SUN_DIR = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.position.copy(SUN_DIR).multiplyScalar(10000); scene.add(sun);
scene.add(new THREE.HemisphereLight(0x3a5a8c, 0x120c04, 0.9));
const goldLamp = new THREE.PointLight(0xffc04d, 1.6, 3200, 0); goldLamp.position.set(0, 900, 600); scene.add(goldLamp);
const cyanLamp = new THREE.PointLight(0x38bdf8, 1.2, 2600, 0); cyanLamp.position.set(0, -420, 0); scene.add(cyanLamp);

// ---------- space: stars, sun, Earth ----------
{
  const N = 4200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 110000, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r], i * 3);
    const t = Math.random(), b = .55 + Math.random() * .45;
    col.set(t < .15 ? [b, b * .85, b * .6] : t < .3 ? [b * .7, b * .85, b] : [b, b, b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, depthWrite: false })));
  const sunGlow = sprite(TEX_GOLD, 26000, 0xffe2a8); sunGlow.position.copy(SUN_DIR).multiplyScalar(100000); scene.add(sunGlow);
}
const EARTH_R = 20000;
const earth = new THREE.Group(); earth.position.set(0, -EARTH_R - 3600, 1500); scene.add(earth);
const earthMat = std(0x1d4f7a, { metalness: 0, roughness: .85 });
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), earthMat); earth.add(earthMesh);
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 1, metalness: 0, depthWrite: false });
const clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.008, 96, 64), cloudMat); earth.add(clouds);
earth.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.045, 96, 64), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { sunDir: { value: SUN_DIR } },
  vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW; void main(){ vec3 v=normalize(cameraPosition-vW); float rim=pow(clamp(1.0+dot(v,vN)*1.0,0.,1.),2.2); float lit=.35+.65*clamp(dot(-vN,-sunDir)*.5+.6,0.,1.); gl_FragColor=vec4(vec3(.32,.62,1.)*rim*lit*1.6, rim); }`,
})));

// Procedural Earth: 3D value noise sampled on the sphere (no seams), built after the first frames.
function makeNoise(seed) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const val = new Float32Array(256).map(() => rnd());
  const h = (x, y, z) => val[p[p[p[x & 255] + (y & 255)] + (z & 255)]];
  const f = t => t * t * (3 - 2 * t), L = (a, b, t) => a + (b - a) * t;
  const n = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = f(x - xi), v = f(y - yi), w = f(z - zi);
    return L(L(L(h(xi, yi, zi), h(xi + 1, yi, zi), u), L(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
             L(L(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), L(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
  };
  return (x, y, z, oct) => { let a = 1, fr = 1, sum = 0, norm = 0; for (let o = 0; o < oct; o++) { sum += a * n(x * fr, y * fr, z * fr); norm += a; a *= .5; fr *= 2.03; } return sum / norm; };
}
function buildEarthTextures() {
  const land = makeNoise(1977), sky = makeNoise(79);
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const cW = 512, cH = 256, cc = document.createElement('canvas'); cc.width = cW; cc.height = cH;
  const cg = cc.getContext('2d'), cimg = cg.createImageData(cW, cH), cd = cimg.data;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let j = 0; j < H; j++) {
    const lat = (.5 - (j + .5) / H) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i + .5) / W * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      let n = (land(x * 1.7 + 9, y * 1.7, z * 1.7, 6) - .5) * 2.4 + .5;
      let rgb;
      if (n < .53) rgb = mix([8, 30, 66], [26, 84, 132], Math.max(0, (n - .3) / .23) ** 2);
      else { const e = (n - .53) / .47; rgb = e < .45 ? mix([46, 92, 44], [104, 96, 56], e / .45) : mix([104, 96, 56], [168, 150, 120], Math.min(1, (e - .45) / .55)); }
      const ice = Math.abs(lat) > 1.2 ? Math.min(1, (Math.abs(lat) - 1.2) / .15) : 0;
      if (ice) rgb = mix(rgb, [228, 236, 244], ice);
      const k = (j * W + i) * 4; d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2]; d[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  for (let j = 0; j < cH; j++) {
    const lat = (.5 - (j + .5) / cH) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < cW; i++) {
      const lon = (i + .5) / cW * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const n = (sky(x * 2.6, y * 5.2, z * 2.6, 5) - .5) * 2.2 + .5;
      const a = Math.max(0, Math.min(1, (n - .5) / .22));
      const k = (j * cW + i) * 4; cd[k] = cd[k + 1] = cd[k + 2] = 255; cd[k + 3] = a * 235;
    }
  }
  cg.putImageData(cimg, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  earthMat.map = t; earthMat.color.set(0xffffff); earthMat.needsUpdate = true;
  const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace;
  cloudMat.map = ct; cloudMat.opacity = .9; cloudMat.needsUpdate = true;
}

// ---------- the station deck under the board ----------
const deck = new THREE.Group(); scene.add(deck);
const plateTopMat = std(0x2a241a, { metalness: .7, roughness: .5 });
const plateSideMat = std(0x16120c, { metalness: .8, roughness: .4 });
const plate = new THREE.Mesh(BOX, [plateSideMat, plateSideMat, plateTopMat, plateSideMat, plateSideMat, plateSideMat]);
deck.add(plate);
const trimMat = glow(0xd4a017), cyanMat = glow(0x38bdf8), redMat = glow(0xff3b3b);
const lowerMat = std(0x0f1118, { metalness: .85, roughness: .35 });
const lower = box(deck, lowerMat, 1, 1, 1);
const trims = [0, 1, 2, 3].map(() => box(deck, trimMat, 1, 1, 1));
const brackets = [];
for (let i = 0; i < 8; i++) brackets.push(box(deck, trimMat, 1, 1, 1));
const column = new THREE.Mesh(new THREE.CylinderGeometry(150, 240, 2200, 24, 1, true), std(0x15161c, { side: THREE.DoubleSide }));
column.position.y = -1220; deck.add(column);
const ringLight = new THREE.Mesh(new THREE.TorusGeometry(250, 9, 8, 48), cyanMat); ringLight.rotation.x = Math.PI / 2; ringLight.position.y = -430; deck.add(ringLight);
const struts = [0, 1, 2, 3].map(() => box(deck, lowerMat, 1, 1, 1));
const runLights = new THREE.InstancedMesh(BOX, glow(0x6fd3ff), 120); deck.add(runLights);
const pylonLights = [0, 1, 2, 3].map(() => { const s = sprite(TEX_RED, 90); deck.add(s); return s; });

function deckTexture(w, h) {
  const S = 1024 / Math.max(w, h), cw = Math.round(w * S), ch = Math.round(h * S);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d');
  g.fillStyle = '#2b251b'; g.fillRect(0, 0, cw, ch);
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5;
  for (let x = 0; x < cw; x += 64 * S * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ch); g.stroke(); }
  for (let y = 0; y < ch; y += 64 * S * 2) { g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke(); }
  // hazard band around the edge of the deck
  const b = Math.max(6, RIM * S * .42);
  g.save(); g.beginPath(); g.rect(0, 0, cw, ch); g.rect(b, b, cw - 2 * b, ch - 2 * b); g.clip('evenodd');
  g.fillStyle = '#1a1408'; g.fillRect(0, 0, cw, ch); g.strokeStyle = 'rgba(212,160,23,.55)'; g.lineWidth = b * .45;
  for (let i = -ch; i < cw + ch; i += b * 1.3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + ch, ch); g.stroke(); }
  g.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function layoutDeck() {
  const w = BW + RIM * 2, d = BH + RIM * 2;
  plate.scale.set(w, 36, d); plate.position.y = -19;
  if (plateTopMat.map) plateTopMat.map.dispose();
  plateTopMat.map = deckTexture(w, d); plateTopMat.color.set(0xffffff); plateTopMat.needsUpdate = true;
  lower.scale.set(w + 220, 26, d + 220); lower.position.y = -96;
  const t = 5, hgt = 6, y = 1;
  trims[0].scale.set(w, hgt, t); trims[0].position.set(0, y, -d / 2);
  trims[1].scale.set(w, hgt, t); trims[1].position.set(0, y, d / 2);
  trims[2].scale.set(t, hgt, d); trims[2].position.set(-w / 2, y, 0);
  trims[3].scale.set(t, hgt, d); trims[3].position.set(w / 2, y, 0);
  // gold corner brackets out on the lower tier, echoing the frame corners of the 2D backdrop
  const L = 120, ox = (w + 220) / 2 - 18, oz = (d + 220) / 2 - 18;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    brackets[i * 2].scale.set(L, 5, 8); brackets[i * 2].position.set(sx * (ox - L / 2), -82, sz * oz);
    brackets[i * 2 + 1].scale.set(8, 5, L); brackets[i * 2 + 1].position.set(sx * ox, -82, sz * (oz - L / 2));
    const s = struts[i], ex = sx * (w / 2 + 40), ez = sz * (d / 2 + 40), len = Math.hypot(ex, ez, 1000);
    s.scale.set(30, len, 30); s.position.set(ex / 2, -110 - 500, ez / 2);
    s.lookAt(0, -1110, 0); s.rotateX(Math.PI / 2);
    pylonLights[i].position.set(sx * ((w + 220) / 2), -70, sz * ((d + 220) / 2));
  });
  // running lights along the lower tier's edge
  const m = new THREE.Matrix4(), pw = w + 220, pd = d + 220, per = 2 * (pw + pd), n = runLights.count;
  for (let i = 0; i < n; i++) {
    let s = (i / n) * per, x, z;
    if (s < pw) { x = -pw / 2 + s; z = pd / 2; } else if ((s -= pw) < pd) { x = pw / 2; z = pd / 2 - s; }
    else if ((s -= pd) < pw) { x = pw / 2 - s; z = -pd / 2; } else { s -= pw; x = -pw / 2; z = -pd / 2 + s; }
    m.makeScale(6, 4, 6); m.setPosition(x, -82, z); runLights.setMatrixAt(i, m);
  }
  runLights.instanceMatrix.needsUpdate = true;
  placeSuits();
}

// ---------- mobile suits holding station off the deck ----------
function buildSuit({ armor, trim, accent, frame, eye, mono }) {
  const g = new THREE.Group(), A = std(armor), T = std(trim), X = std(accent), F = std(frame, { metalness: .8 }), E = glow(eye);
  box(g, F, 1.5, .8, 1, 0, 4.6, 0);                                // waist
  box(g, A, 2.4, 1.8, 1.5, 0, 6, 0);                                // torso
  box(g, T, 2.5, .8, 1.56, 0, 6.5, 0);                              // chest plate
  box(g, X, .5, .5, .1, 0, 5.5, .78);                               // chest core
  box(g, glow(0xffc04d), .5, .18, .05, -.6, 6.5, .8); box(g, glow(0xffc04d), .5, .18, .05, .6, 6.5, .8);   // vents
  const head = new THREE.Group(); head.position.set(0, 7.35, 0); g.add(head);
  box(head, A, .8, .8, .85);
  if (mono) {
    box(head, F, .82, .2, .1, 0, .05, .43);
    const eyeDot = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 8), E); eyeDot.position.set(0, .05, .48); head.add(eyeDot);
    const eg = sprite(TEX_RED, .9, eye); eg.position.copy(eyeDot.position); head.add(eg);
    head.userData.scan = eyeDot; head.userData.scanGlow = eg;
    box(head, F, .16, .7, .16, 0, .7, -.1);                         // antenna crest
  } else {
    const finL = box(head, glow(0xf6c445), .08, .7, .08, -.2, .55, .38); finL.rotation.z = .9;
    const finR = box(head, glow(0xf6c445), .08, .7, .08, .2, .55, .38); finR.rotation.z = -.9;
    box(head, X, .18, .14, .1, 0, .3, .43);
    box(head, E, .22, .08, .05, -.17, .05, .44); box(head, E, .22, .08, .05, .17, .05, .44);
    const eg = sprite(TEX_CYAN, .9, eye); eg.position.set(0, .05, .5); head.add(eg);
  }
  for (const s of [-1, 1]) {
    box(g, T, 1.1, 1, 1.3, s * 1.85, 6.6, 0);                       // shoulder
    const arm = new THREE.Group(); arm.position.set(s * 1.95, 6.1, 0); arm.rotation.x = -.25; arm.rotation.z = s * .08; g.add(arm);
    box(arm, F, .6, 1.3, .6, 0, -.7, 0); box(arm, A, .78, 1.4, .82, 0, -2, .05); box(arm, F, .5, .5, .5, 0, -2.9, .1);
    if (s > 0) box(arm, F, .32, .42, 2.8, .05, -2.9, .9);           // rifle
    else box(arm, T, .25, 1.8, 1.2, -.42, -2, .1);                  // shield
    const leg = new THREE.Group(); leg.position.set(s * .55, 4.2, 0); leg.rotation.x = s > 0 ? .18 : -.08; g.add(leg);
    box(leg, F, .75, 1.6, .85, 0, -.8, 0); box(leg, A, 1, 2.1, 1.1, 0, -2.6, 0); box(leg, X, .7, .5, .3, 0, -1.7, .56); box(leg, T, 1, .42, 1.6, 0, -3.8, .2);
  }
  box(g, F, 1.6, 1.6, .8, 0, 6.2, -1.1);                            // backpack
  const flames = [];
  for (const s of [-1, 1]) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(.18, .34, .6, 10), F); noz.position.set(s * .5, 5.2, -1.3); g.add(noz);
    const fl = sprite(TEX_CYAN, 1.6, 0x9ad8ff); fl.position.set(s * .5, 4.75, -1.35); g.add(fl); flames.push(fl);
  }
  g.userData.flames = flames; g.userData.head = head;
  g.scale.setScalar(95);
  return g;
}
const suits = [
  buildSuit({ armor: 0xe6eaf0, trim: 0x2f5bd0, accent: 0xc8323a, frame: 0x3a3f4a, eye: 0x7cf3a0, mono: false }),
  buildSuit({ armor: 0x5b7a42, trim: 0x34492a, accent: 0x8a9a5b, frame: 0x30352c, eye: 0xff3d7f, mono: true }),
];
suits.forEach(s => scene.add(s));
function placeSuits() {
  const gx = BW / 2 + RIM + 1100;
  suits[0].position.set(-gx, -900, -BH * .9); suits[0].rotation.y = .6;
  suits[1].position.set(gx, -820, -BH * 1.3); suits[1].rotation.y = -.7;
  suits.forEach(s => { s.userData.baseY = s.position.y; });
}

// Drifting debris for depth.
const rocks = [];
{
  const geo = new THREE.IcosahedronGeometry(1, 0), m = std(0x4a4339, { metalness: .2, roughness: .9, flatShading: true });
  for (let i = 0; i < 46; i++) {
    const r = new THREE.Mesh(geo, m), a = Math.random() * Math.PI * 2, d = 1500 + Math.random() * 3200;
    r.position.set(Math.cos(a) * d, -300 - Math.random() * 2200, Math.sin(a) * d * .8);
    r.scale.set(20 + Math.random() * 60, 18 + Math.random() * 50, 20 + Math.random() * 55);
    r.userData.spin = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(.4);
    scene.add(r); rocks.push(r);
  }
}

// ---------- spark particles over the board (fx layer) ----------
const PN = 700;
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3);
const pLife = new Float32Array(PN), pMax = new Float32Array(PN), pBase = new Float32Array(PN * 3);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const sparks = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 15, map: TEX_WHITE, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false; fxScene.add(sparks);
let pNext = 0, fxAlive = 0;
const rings = [], flashes = [];
for (let i = 0; i < 8; i++) {
  const r = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  r.rotation.x = -Math.PI / 2; r.visible = false; r.userData = { t: 0, life: 0, size: 0 }; fxScene.add(r); rings.push(r);
  const f = sprite(TEX_WHITE, 1); f.material.depthTest = false; f.visible = false; f.userData = { t: 0, life: 0, size: 0 }; fxScene.add(f); flashes.push(f);
}
const COLORS = { die: [1, .55, .18], hit: [1, .82, .45], shield: [.45, .8, 1], enter: [.4, .85, 1], attack: [.55, .9, 1] };
function emit(at, kind) {
  const c = COLORS[kind] || COLORS.hit, n = kind === 'die' ? 110 : kind === 'enter' ? 50 : kind === 'shield' ? 70 : 34;
  const sp = kind === 'die' ? 520 : kind === 'enter' ? 160 : 360;
  for (let i = 0; i < n; i++) {
    const k = pNext, a = Math.random() * Math.PI * 2, up = kind === 'enter' ? .2 + Math.random() * .6 : .3 + Math.random() * 1.1, s = sp * (.35 + Math.random() * .75);
    pNext = (pNext + 1) % PN;
    pPos.set([at.x, 4, at.z], k * 3);
    pVel.set([Math.cos(a) * s, up * s, Math.sin(a) * s], k * 3);
    const tint = .75 + Math.random() * .25; pBase.set([c[0] * tint, c[1] * tint, c[2] * tint], k * 3);
    pMax[k] = pLife[k] = (kind === 'die' ? .6 : .4) + Math.random() * .5;
  }
  const ring = rings.find(r => !r.visible) || rings[0];
  ring.visible = true; ring.position.set(at.x, 3, at.z); ring.material.color.setRGB(...c);
  Object.assign(ring.userData, { t: 0, life: kind === 'die' ? .6 : .45, size: kind === 'die' ? 210 : kind === 'enter' ? 120 : 140 });
  const fl = flashes.find(f => !f.visible) || flashes[0];
  fl.visible = true; fl.position.set(at.x, 30, at.z); fl.material.color.setRGB(...c);
  Object.assign(fl.userData, { t: 0, life: kind === 'die' ? .45 : .25, size: kind === 'die' ? 420 : 220 });
  fxAlive = 1.2;
}
function updateFx(dt) {
  if (fxAlive <= 0) return false;
  fxAlive -= dt;
  for (let k = 0; k < PN; k++) {
    if (pLife[k] <= 0) { pCol[k * 3] = pCol[k * 3 + 1] = pCol[k * 3 + 2] = 0; continue; }
    pLife[k] -= dt; const i = k * 3, f = Math.max(0, pLife[k] / pMax[k]);
    pVel[i + 1] -= 900 * dt; pVel[i] *= .97; pVel[i + 2] *= .97;
    pPos[i] += pVel[i] * dt; pPos[i + 1] = Math.max(2, pPos[i + 1] + pVel[i + 1] * dt); pPos[i + 2] += pVel[i + 2] * dt;
    pCol[i] = pBase[i] * f; pCol[i + 1] = pBase[i + 1] * f; pCol[i + 2] = pBase[i + 2] * f;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  for (const r of rings) if (r.visible) {
    const u = r.userData; u.t += dt; const p = u.t / u.life;
    if (p >= 1) { r.visible = false; continue; }
    r.scale.setScalar(u.size * (.2 + p)); r.material.opacity = (1 - p) * .9;
  }
  for (const f of flashes) if (f.visible) {
    const u = f.userData; u.t += dt; const p = u.t / u.life;
    if (p >= 1) { f.visible = false; continue; }
    f.scale.setScalar(u.size * (.5 + p * .8)); f.material.opacity = 1 - p;
  }
  return true;
}
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitPt = new THREE.Vector3();
function worldAt(elm) {
  // Layout position inside the board, so a card mid-animation (lifted, lunging) still maps to its spot.
  let x = elm.offsetWidth / 2, y = elm.offsetHeight / 2, e = elm;
  while (e && e !== board && board.contains(e)) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
  if (e === board && elm.offsetWidth) return new THREE.Vector3(x - BW / 2, 0, y - BH / 2);
  const r = elm.getBoundingClientRect(); if (!r.width) return null;
  ray.setFromCamera(new THREE.Vector2((r.left + r.width / 2) / innerWidth * 2 - 1, -((r.top + r.height / 2) / innerHeight * 2 - 1)), camera);
  return ray.ray.intersectPlane(groundPlane, hitPt) ? hitPt.clone() : null;
}
function fxFor(elm, kind) {
  if (!vfxOn() || reduced()) return;
  const at = worldAt(elm); if (at) emit(at, kind);
}
const FX_CLASSES = [['fx-die', 'die'], ['fx-hit', 'hit'], ['zone-hit', 'shield'], ['fx-enter', 'enter'], ['fx-attack', 'attack']];
new MutationObserver(list => {
  for (const m of list) {
    if (m.type === 'attributes') {
      const t = m.target, old = ' ' + (m.oldValue || '') + ' ';
      if (!t.classList) continue;
      for (const [c, kind] of FX_CLASSES) if (t.classList.contains(c) && !old.includes(' ' + c + ' ')) { fxFor(t, kind); break; }
    } else for (const nd of m.addedNodes) {
      if (!nd.classList) continue;
      for (const [c, kind] of FX_CLASSES) if (nd.classList.contains(c)) { fxFor(nd, kind); break; }
    }
  }
}).observe(board, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });

// ---------- camera ----------
const VIEWS = [
  { id: 'table', name: 'Tabletop', phi: 34, theta: 0 },
  { id: 'top', name: 'Top-down', phi: 3, theta: 0 },
  { id: 'cine', name: 'Cinematic', phi: 55, theta: -16 },
];
let viewIdx = Math.max(0, VIEWS.findIndex(v => v.id === lsGet('gtcg3d_view')));
const cur = { phi: 34, theta: 0, dist: 2400, ox: 0, oy: 0 }, goal = { ...cur };
let snapNext = true, settleT = 0;
const tmpCam = new THREE.PerspectiveCamera(36, 1, 20, 160000), v3 = new THREE.Vector3();
function place(cam, phi, theta, dist) {
  const p = phi * D2R, t = theta * D2R;
  cam.position.set(Math.sin(p) * Math.sin(t) * dist, Math.cos(p) * dist, Math.sin(p) * Math.cos(t) * dist);
  cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
}
function projectedBox(phi, theta, dist, W, H) {
  tmpCam.aspect = W / H; tmpCam.updateProjectionMatrix(); place(tmpCam, phi, theta, dist);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const hw = BW / 2 + RIM, hd = BH / 2 + RIM;
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    v3.set(x, 0, z).project(tmpCam);
    const sx = (v3.x + 1) / 2 * W, sy = (1 - v3.y) / 2 * H;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x0, x1, y0, y1 };
}
function computeGoal() {
  if (!BW) return;
  const v = VIEWS[viewIdx], W = innerWidth, H = innerHeight, r = slot.getBoundingClientRect();
  const regW = Math.max(120, W - 24), regH = Math.max(120, r.height - 8);
  const top = r.top + 4, cx = W / 2, cy = top + regH / 2;
  let lo = 200, hi = 60000;
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2, b = projectedBox(v.phi, v.theta, mid, W, H);
    if (b.x1 - b.x0 <= regW && b.y1 - b.y0 <= regH) hi = mid; else lo = mid;
  }
  const b = projectedBox(v.phi, v.theta, hi, W, H);
  Object.assign(goal, { phi: v.phi, theta: v.theta, dist: hi, ox: (b.x0 + b.x1) / 2 - cx, oy: (b.y0 + b.y1) / 2 - cy });
  if (snapNext || reduced()) { Object.assign(cur, goal); snapNext = false; }
  settleT = 1.6;
}
function toast(text) {
  const t = $('camToast'); if (!t) return;
  t.textContent = text; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1300);
}
function cycleView() {
  viewIdx = (viewIdx + 1) % VIEWS.length; lsSet('gtcg3d_view', VIEWS[viewIdx].id);
  computeGoal(); toast('📷 ' + VIEWS[viewIdx].name + ' view');
  const b = $('camBtn'); if (b) b.title = 'Camera: ' + VIEWS[viewIdx].name + ' (V to change)';
}
$('camBtn') && $('camBtn').addEventListener('click', cycleView);
document.addEventListener('keydown', e => {
  if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || ''))) cycleView();
});


// The game's screen shake (direct hits, Shield breaks, destroyed Units) now shakes the camera.
const shake = { t: 0, amp: 0 };
window.screenShake = function () { if (reduced()) return; shake.t = .45; shake.amp = 11; };
// Mat-picture framing needs the mat's real shape, not its on-screen (tilted) outline.
window.matAspect = function (side) {
  const m = document.querySelector('.mat.' + side);
  return m && m.offsetWidth > 40 && m.offsetHeight > 40 ? m.offsetWidth / m.offsetHeight : (innerWidth > innerHeight ? 2.6 : 1.3);
};

// ---------- sizing ----------
function sizeBoard() {
  const r = slot.getBoundingClientRect();
  const w = Math.round(Math.max(300, Math.min(r.width, 1640)));
  board.style.width = w + 'px'; board.style.height = 'auto';
  const h = Math.round(Math.max(board.offsetHeight, r.height, 280));
  board.style.height = h + 'px';
  const changed = w !== BW || h !== BH;
  if (changed) { BW = w; BH = h; layoutDeck(); if (gameReady()) try { fitBattlefields(); } catch (e) {} }
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H, false); fxRenderer.setSize(W, H, false); cssRenderer.setSize(W, H);
  computeGoal();
}
let sizeQ = 0;
const queueSize = () => { cancelAnimationFrame(sizeQ); sizeQ = requestAnimationFrame(sizeBoard); };
addEventListener('resize', queueSize);
new ResizeObserver(queueSize).observe(slot);
// Phones stack the rows, so the board's natural height follows its content.
setInterval(() => { if (!document.hidden && (innerWidth <= 820 || innerHeight <= 560)) sizeBoard(); }, 1500);

// ---------- frame loop ----------
let last = performance.now(), T = 0, arrowT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  const calm = reduced(), k = 1 - Math.exp(-dt * 4.5);
  for (const key in goal) cur[key] += (goal[key] - cur[key]) * k;
  // The board never moves on its own (no sway, no parallax), so a card stays where the pointer is aiming.
  place(camera, cur.phi, cur.theta, cur.dist);
  let sx = 0, sy = 0;
  if (shake.t > 0) { const f = shake.t / .45; sx = (Math.random() * 2 - 1) * shake.amp * f; sy = (Math.random() * 2 - 1) * shake.amp * f; shake.t -= dt; }
  camera.aspect = innerWidth / innerHeight;
  camera.setViewOffset(innerWidth, innerHeight, cur.ox + sx, cur.oy + sy, innerWidth, innerHeight);
  // The attack arrow is drawn in screen space from card rects: keep it on its cards while the camera moves.
  if (settleT > 0) { settleT -= dt; arrowT -= dt; if (arrowT <= 0) { arrowT = .1; try { drawBattleArrow(); } catch (e) {} } }

  if (!calm) {
    earth.rotation.y += dt * .004; clouds.rotation.y += dt * .002;
    rocks.forEach(r => { r.rotation.x += r.userData.spin.x * dt; r.rotation.y += r.userData.spin.y * dt; });
    suits.forEach((s, i) => {
      s.position.y = s.userData.baseY + Math.sin(T * .6 + i * 2) * 22;
      s.userData.flames.forEach(f => f.scale.setScalar(1.3 + Math.random() * .7));
      const h = s.userData.head; if (h.userData.scan) { const x = Math.sin(T * 1.4) * .26; h.userData.scan.position.x = x; h.userData.scanGlow.position.x = x; }
    });
    const blink = (Math.sin(T * 3) > .6) ? 1 : .15; pylonLights.forEach(p => p.material.opacity = blink);
    trimMat.color.setRGB(.83 + Math.sin(T * 1.2) * .08, .63, .09);
  }
  renderer.render(scene, camera);
  cssRenderer.render(cssScene, camera);
  if (updateFx(dt) || fxAlive > -1) { fxRenderer.render(fxScene, camera); if (fxAlive <= 0) fxAlive = -2; }
}

// ---------- go ----------
document.documentElement.classList.add('is3d');
sizeBoard();
requestAnimationFrame(frame);
setTimeout(() => { try { buildEarthTextures(); } catch (e) {} }, 400);
