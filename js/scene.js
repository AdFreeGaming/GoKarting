'use strict';
/* ---------------------------------------------------------------- renderer / scene */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe3f5, 160, 720);
const camera = new THREE.PerspectiveCamera(78, 1, 0.1, 5000);
camera.rotation.order = 'YXZ';
const hemi = new THREE.HemisphereLight(0xffffff, 0x6f7a5c, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
{
  const SH = 180, sc = sun.shadow.camera, sz = Math.min(4096, renderer.capabilities.maxTextureSize);
  sun.castShadow = true; sc.left = -SH; sc.right = SH; sc.top = SH; sc.bottom = -SH; sc.near = 40; sc.far = 900;
  sun.shadow.mapSize.set(sz, sz); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------------------------------------------------------------- procedural textures */
function canvasTex(w, h, draw, rx, ry) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
  t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
}
const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const asphaltTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5d5f63'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 60 + rnd() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(rnd() * w, rnd() * h, 1.6, 1.6); }
  g.strokeStyle = 'rgba(40,40,42,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += rnd() * 40 - 20; y += rnd() * 40; g.lineTo(x, y); } g.stroke(); }
}, 1, 1);
const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#5f8a3a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 14000; i++) { const r = 70 + rnd() * 70 | 0, gr = 110 + rnd() * 70 | 0; g.fillStyle = `rgba(${r},${gr},45,0.55)`; g.fillRect(rnd() * w, rnd() * h, 2, 3); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(170,160,90,0.18)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 8 + rnd() * 22, 0, 7); g.fill(); }
}, 260, 260);
const chequerTex = canvasTex(256, 32, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); } });
const bannerTex = canvasTex(1024, 128, (g, w, h) => {
  g.fillStyle = '#14181d'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff8a2b'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
  g.fillStyle = '#fff'; g.font = 'italic 800 68px Segoe UI, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('KART RACEWAY  •  4 HOUR ENDURO', w / 2, h / 2 + 2);
});

const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
const PO = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide };
const M = {
  asphalt: std({ map: asphaltTex, side: THREE.DoubleSide, roughness: 0.95 }),
  oldAsphalt: std({ map: asphaltTex, color: lin(0xa5a5a5), side: THREE.DoubleSide, roughness: 1 }),
  grass: std({ map: grassTex, roughness: 1 }),
  line: std(Object.assign({ color: lin(0xe9e9e4), roughness: 0.7 }, PO)),
  kerb: std(Object.assign({ vertexColors: true, roughness: 0.75 }, PO)),
  rubber: new THREE.MeshBasicMaterial(Object.assign({ color: 0x000000, transparent: true, opacity: 0.08, depthWrite: false }, PO)),
  tyre: std({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide }),
  lam: (c, r) => std({ color: lin(c), roughness: r === undefined ? 0.85 : r })
};
