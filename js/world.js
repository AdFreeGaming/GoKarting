'use strict';
/* ---------------------------------------------------------------- static world */
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), M.grass); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
}
// physically based sky (three.js Sky shader) with a plain gradient dome as fallback
const sky = THREE.Sky ? new THREE.Sky() : null;
let domeMat = null;
if (sky) {
  sky.scale.setScalar(4500); const u = sky.material.uniforms;
  u.turbidity.value = 3; u.rayleigh.value = 2.2; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82; scene.add(sky);
} else {
  const g = new THREE.SphereGeometry(2000, 32, 16), col = [], p = g.attributes.position, lo = lin(0xcfe3f5), hi = lin(0x2b78d6), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { c.copy(lo).lerp(hi, Math.pow(clamp(p.getY(i) / 2000, 0, 1), 0.55)); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  scene.add(new THREE.Mesh(g, domeMat));
}
// Illawarra escarpment on the western skyline
const scarpMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
(function escarpment() {
  const pos = [], col = [], idx = [], SEG = 220, top = lin(0x33473a), mid = lin(0x5d7468), bot = lin(0x9fb3bd);
  for (let layer = 0; layer < 2; layer++) {
    const Rr = layer ? 1250 : 1700, base = pos.length / 3;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, a = Math.PI * (0.52 + 1.12 * u), taper = Math.pow(Math.sin(Math.PI * u), 0.45);
      const h = layer ? (38 + 14 * Math.sin(a * 9 + 2) + 7 * Math.sin(a * 23) + 3 * Math.sin(a * 61)) * taper
                      : (120 + 26 * Math.sin(a * 6) + 13 * Math.sin(a * 15 + 1) + 7 * Math.sin(a * 37 + 2) + 3 * Math.sin(a * 83)) * taper;
      const x = Rr * Math.cos(a), z = Rr * Math.sin(a), ct = layer ? mid : top;
      pos.push(x, -4, z, x, h * 0.8, z, x * 1.02, h, z * 1.02); col.push(bot.r, bot.g, bot.b, ct.r, ct.g, ct.b, ct.r * 0.85, ct.g * 0.85, ct.b * 0.85);
      if (i < SEG) { const q = base + i * 3; idx.push(q, q + 1, q + 3, q + 1, q + 4, q + 3, q + 1, q + 2, q + 4, q + 2, q + 5, q + 4); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  scene.add(new THREE.Mesh(g, scarpMat));
})();

const flood = { lights: [], lampMat: new THREE.MeshBasicMaterial({ color: 0x8a8f94 }) };
(function scenery() {
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  // ---- eucalypts and scrub
  const trees = [], shrubs = [];
  for (let tries = 0; tries < 6000 && trees.length < 280; tries++) {
    const x = (rnd() - 0.5) * 460, z = (rnd() - 0.5) * 460, d = trackDist(x, z);
    if (d < 17) continue;
    if (Math.hypot(x, z) < 105 && rnd() > 0.06) continue;
    trees.push([x, z, 0.75 + rnd() * 0.9]);
  }
  for (let tries = 0; tries < 4000 && shrubs.length < 220; tries++) {
    const x = (rnd() - 0.5) * 420, z = (rnd() - 0.5) * 420, d = trackDist(x, z);
    if (d < 13 || (d < 60 && rnd() > 0.1)) continue;
    shrubs.push([x, z, 0.6 + rnd() * 0.9]);
  }
  const trunkG = new THREE.CylinderGeometry(0.16, 0.3, 1, 10, 5);
  { const p = trunkG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 5) * 0.06); p.setZ(i, p.getZ(i) + Math.cos(y * 4) * 0.05); } trunkG.computeVertexNormals(); }
  const trunks = new THREE.InstancedMesh(trunkG, M.lam(0xb9ab95, 0.95), trees.length);
  const blobG = new THREE.IcosahedronGeometry(1, 2);
  { const p = blobG.attributes.position, n = blobG.attributes.normal, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const r = 1 + 0.2 * Math.sin(v.x * 6.1 + v.y * 3.3) + 0.16 * Math.sin(v.z * 7.7 - v.x * 4.2) + 0.1 * Math.sin(v.y * 11.3 + v.z * 5.1);
      n.setXYZ(i, v.x, v.y, v.z); v.multiplyScalar(r); p.setXYZ(i, v.x, v.y * 0.8, v.z); } }
  const BL = 4, leaves = new THREE.InstancedMesh(blobG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), trees.length * BL + shrubs.length);
  let li = 0;
  const blob = (x, y, z, sx, sy, hue, lum) => {
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sx); dummy.rotation.set(rnd() * 0.5, rnd() * 6.3, rnd() * 0.5); dummy.updateMatrix();
    leaves.setMatrixAt(li, dummy.matrix); leaves.setColorAt(li++, c.setHSL(hue, 0.38 + rnd() * 0.14, lum).convertSRGBToLinear());
  };
  trees.forEach((s, i) => {
    const h = 6.5 * s[2];
    dummy.position.set(s[0], h / 2, s[1]); dummy.scale.set(s[2], h, s[2]); dummy.rotation.set((rnd() - 0.5) * 0.12, rnd() * 6.3, (rnd() - 0.5) * 0.12); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    const hue = 0.2 + rnd() * 0.1, lum = 0.2 + rnd() * 0.1;
    for (let b = 0; b < BL; b++) {
      const a = rnd() * 6.3, r = b ? (1.2 + rnd() * 1.3) * s[2] : 0;
      blob(s[0] + Math.cos(a) * r, h + (b ? (rnd() - 0.35) * 2.2 : 0.8) * s[2], s[1] + Math.sin(a) * r, (1.9 + rnd() * 1.1) * s[2], (1.5 + rnd() * 0.9) * s[2], hue + (rnd() - 0.5) * 0.03, lum + (rnd() - 0.5) * 0.06);
    }
  });
  shrubs.forEach(s => blob(s[0], 0.9 * s[2], s[1], 1.7 * s[2], 1.5 * s[2], 0.17 + rnd() * 0.1, 0.24 + rnd() * 0.12));
  trunks.castShadow = leaves.castShadow = true; leaves.receiveShadow = true;
  scene.add(trunks, leaves);

  // ---- buildings / sheds / containers  [px, py, width, depth, height, rotation, wall, roof]
  const B = [[400,130,34,15,5,-0.5,0xd9d2c4,0xb2473c],[330,165,12,7,3.5,-0.5,0xc9c9c9,0x7d8a94],[775,2,10,7,3.5,0.4,0xe6e6e6,0x8a8f96],
    [110,300,10,3,2.8,-0.5,0x2f6fb3,0],[125,345,10,3,2.8,-1.1,0xb23a2f,0],[60,340,9,3,2.8,-0.9,0xdcdcdc,0],
    [100,520,5,11,3.2,0,0x8a8f96,0x5d6a75],[95,580,3,10,2.8,0.1,0x3c7a4a,0],[120,395,3,9,2.8,-0.2,0xe0b23a,0]];
  const winM = M.lam(0x1d2b38, 0.25), doorM = M.lam(0x4b5560, 0.6);
  for (const b of B) {
    const [x, z] = px2w(b[0], b[1]); if (trackDist(x, z) < HW + RUNOFF + Math.max(b[2], b[3]) / 2) continue;
    const g = new THREE.Group(), w = b[2], d = b[3], h = b[4]; g.position.set(x, 0, z); g.rotation.y = b[5];
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.lam(b[6], 0.9)); wall.position.y = h / 2; g.add(wall);
    if (b[7]) {                                    // gabled roof with eaves + windows and a roller door
      const sh = new THREE.Shape(); sh.moveTo(-d / 2 - 0.6, 0); sh.lineTo(0, d * 0.22); sh.lineTo(d / 2 + 0.6, 0); sh.lineTo(-d / 2 - 0.6, 0);
      const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: w + 1, bevelEnabled: false }), M.lam(b[7], 0.7));
      roof.rotation.y = Math.PI / 2; roof.position.set(-(w + 1) / 2, h, 0); g.add(roof);
      for (let q = -w / 2 + 2; q < w / 2 - 1.5; q += 3.2) for (const s of [-1, 1]) { const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.08), winM); win.position.set(q, h * 0.62, s * d / 2); g.add(win); }
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.75, Math.min(3, d * 0.5)), doorM); door.position.set(w / 2, h * 0.375, 0); g.add(door);
    } else {                                       // shipping container: corrugation ribs
      for (let q = -w / 2 + 0.25; q < w / 2; q += 0.5) for (const s of [-1, 1]) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 0.92, 0.06), wall.material); rib.position.set(q, h / 2, s * (d / 2 + 0.02)); g.add(rib); }
      for (let q = -d / 2 + 0.25; q < d / 2; q += 0.5) for (const s of [-1, 1]) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.92, 0.12), wall.material); rib.position.set(s * (w / 2 + 0.02), h / 2, q); g.add(rib); }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
  }

  // ---- floodlight towers: the enduro finishes under lights
  const spots = [];
  const tryPole = (T, i, side) => {
    const o = (HW + RUNOFF + 2.2) * side, x = T.x[i] - T.tz[i] * o, z = T.z[i] + T.tx[i] * o;
    if (trackDist(x, z) < HW + RUNOFF + 1.4 || spots.some(p => Math.hypot(p[0] - x, p[1] - z) < 30)) return;
    spots.push([x, z, Math.atan2(T.tx[i] * side, T.tz[i] * side)]);
  };
  for (const T of [TRACKS.full, TRACKS.short]) for (let i = 0, q = 0; i < T.N; i += 20, q++) { tryPole(T, i, q % 2 ? 1 : -1); }
  const poleM = M.lam(0xa3abb2, 0.5), poleG = new THREE.CylinderGeometry(0.08, 0.16, 12, 12), armG = new THREE.BoxGeometry(2.2, 0.1, 0.1), headG = new THREE.BoxGeometry(0.45, 0.32, 0.2);
  for (const p of spots.slice(0, 16)) {
    const g = new THREE.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = p[2];
    const pole = new THREE.Mesh(poleG, poleM); pole.position.y = 6; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(armG, poleM); arm.position.y = 11.9; g.add(arm);
    for (let q = 0; q < 4; q++) {
      const hd = new THREE.Mesh(headG, poleM); hd.position.set(-0.83 + q * 0.55, 11.65, 0.05); hd.rotation.x = 0.5; g.add(hd);
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.26), flood.lampMat); lens.position.set(-0.83 + q * 0.55, 11.6, 0.16); lens.rotation.x = 0.5; g.add(lens);
    }
    scene.add(g);
    const L = new THREE.PointLight(0xfff0d8, 1.7, 95, 1.6); L.position.set(p[0] + Math.sin(p[2]) * 2, 11.3, p[1] + Math.cos(p[2]) * 2); L.visible = false; scene.add(L); flood.lights.push(L);
  }
})();

/* ---------------------------------------------------------------- sun position for Wollongong NSW (34.43 S, 150.89 E) */
const ENV = { month: 10, hour: 15 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const smooth = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const clock = h => { const m = Math.round(h * 60), hh = Math.floor(m / 60), mm = m % 60; return ((hh + 11) % 12 + 1) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? ' am' : ' pm'); };
function sunVector(month, hour) {
  const n = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][month] + 15;      // mid-month day of year
  const LAT = -34.4278 * Math.PI / 180, LON = 150.8931;
  const B = 2 * Math.PI * (n - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);   // equation of time, minutes
  const dec = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + n) / 365);
  const tz = (month >= 9 || month <= 2) ? 11 : 10;                                   // AEDT (daylight saving) Oct-Mar, else AEST
  const shift = LON / 15 - tz + eot / 60, H = (hour + shift - 12) * 15 * Math.PI / 180;
  const E = -Math.cos(dec) * Math.sin(H), N = Math.cos(LAT) * Math.sin(dec) - Math.sin(LAT) * Math.cos(dec) * Math.cos(H),
        U = Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(H);
  const H0 = Math.acos(clamp(-Math.tan(LAT) * Math.tan(dec), -1, 1)) * 12 / Math.PI;
  return { x: E, y: U, z: -N, el: Math.asin(U) * 180 / Math.PI, az: (Math.atan2(E, N) * 180 / Math.PI + 360) % 360, rise: 12 - H0 - shift, set: 12 + H0 - shift, tz };
}
// visible sun disc with glow, plus a camera lens flare that is hidden when the sun is behind something
const sunFx = (() => {
  const radial = (stops) => (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(s => r.addColorStop(s[0], s[1])); g.fillStyle = r; g.fillRect(0, 0, w, w); };
  const glowTex = canvasTex(256, 256, radial([[0, 'rgba(255,255,255,1)'], [0.055, 'rgba(255,252,240,1)'], [0.1, 'rgba(255,238,200,0.55)'], [0.3, 'rgba(255,222,165,0.15)'], [1, 'rgba(255,210,150,0)']]));
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
  sprite.scale.set(560, 560, 1); scene.add(sprite);
  const els = []; let flare = null;
  if (THREE.Lensflare) {
    const starTex = canvasTex(512, 512, (g, w) => {
      radial([[0, 'rgba(255,255,255,0.95)'], [0.08, 'rgba(255,245,220,0.5)'], [0.3, 'rgba(255,225,170,0.12)'], [1, 'rgba(255,210,150,0)']])(g, w);
      g.translate(w / 2, w / 2); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {                                // diffraction streaks
        g.rotate(Math.PI * 2 / 14 + (i % 2) * 0.07); const len = (i % 2 ? 0.48 : 0.34) * w, gr = g.createLinearGradient(0, 0, len, 0);
        gr.addColorStop(0, 'rgba(255,245,225,0.5)'); gr.addColorStop(1, 'rgba(255,230,190,0)'); g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, -3.5); g.lineTo(len, 0); g.lineTo(0, 3.5); g.fill();
      }
    });
    const dotTex = canvasTex(128, 128, radial([[0, 'rgba(255,255,255,0.55)'], [0.7, 'rgba(255,255,255,0.4)'], [0.8, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]));
    const ringTex = canvasTex(128, 128, radial([[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.03)'], [0.86, 'rgba(255,255,255,0.4)'], [0.93, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)']]));
    flare = new THREE.Lensflare();
    for (const e of [[starTex, 520, 0, 0xffffff], [dotTex, 50, 0.28, 0x7fb4ff], [ringTex, 110, 0.42, 0xffc27a], [dotTex, 80, 0.58, 0x9dffb0], [dotTex, 36, 0.7, 0xff9a6a], [ringTex, 210, 0.9, 0x86a8ff], [dotTex, 120, 1.08, 0xffd9a0]]) {
      const el = new THREE.LensflareElement(e[0], e[1], e[2], new THREE.Color(e[3])); flare.addElement(el);
      els.push({ el, base: new THREE.Color(e[3]).multiplyScalar(e[2] ? 0.45 : 1) });
    }
    scene.add(flare);
  }
  return { sprite, flare, els, DIST: 3500 };
})();
const fogC = { night: lin(0x060a12), dusk: lin(0xc9977c), day: lin(0xc3d5e6) }, sunC = { low: lin(0xff8436), high: lin(0xfff5e6) };
function applySun() {
  const s = sunVector(ENV.month, ENV.hour), day = smooth(-4, 9, s.el), night = s.el < 3;
  sun.position.set(s.x, Math.max(s.y, 0.03), s.z).multiplyScalar(450);
  sun.intensity = 2.3 * smooth(-0.5, 8, s.el); sun.castShadow = s.el > 0.5;
  sun.color.copy(sunC.low).lerp(sunC.high, smooth(2, 28, s.el));
  hemi.intensity = 0.06 + 0.5 * day; hemi.color.copy(lin(0x3a4a78)).lerp(lin(0xd6e4ff), day); hemi.groundColor.copy(lin(0x15181c)).lerp(lin(0x6f7a5c), day);
  scene.fog.color.copy(fogC.night).lerp(fogC.dusk, smooth(-7, 1.5, s.el)).lerp(fogC.day, smooth(1, 14, s.el));
  scarpMat.color.setScalar(0.03 + 0.97 * day).lerp(scene.fog.color, 0.35);
  if (sky) sky.material.uniforms.sunPosition.value.set(s.x, s.y, s.z); else domeMat.color.setScalar(0.02 + 0.98 * day);
  const glow = smooth(-1.5, 5, s.el);
  sunFx.sprite.visible = glow > 0; sunFx.sprite.material.color.copy(sun.color).multiplyScalar(glow);
  if (sunFx.flare) { sunFx.flare.visible = glow > 0.05; for (const e of sunFx.els) e.el.color.copy(e.base).multiply(sun.color).multiplyScalar(glow); }
  for (const L of flood.lights) L.visible = night;
  flood.lampMat.color.set(night ? 0xfffbe6 : 0x8a8f94); flood.lampMat.toneMapped = !night;
  const txt = MONTHS[ENV.month].slice(0, 3) + ' · ' + clock(ENV.hour);
  $('tod').value = ENV.hour; $('month').value = ENV.month; $('todv').textContent = clock(ENV.hour); $('envhud').textContent = txt;
  const comp = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(s.az / 45) % 8];
  $('suninfo').textContent = (s.el > 0 ? 'Sun ' + s.el.toFixed(0) + '° above the horizon, bearing ' + comp : 'Sun has set – racing under lights') +
    '  ·  sunrise ' + clock(s.rise) + ', sunset ' + clock(s.set) + ' (' + (s.tz === 11 ? 'AEDT' : 'AEST') + ')';
  ENV.sun = s; ENV.applied = ENV.hour;
}
