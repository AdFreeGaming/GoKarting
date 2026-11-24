'use strict';
/* ---------------------------------------------------------------- per-layout track geometry */
function ribbon(T, o1, o2, y, mat, vrep, open, i0, i1) {      // open: a path that does not close on itself (pit lane), optionally just points i0..i1
  const n = T.N, pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx = [];
  const first = open ? (i0 || 0) : 0, last = open ? (i1 === undefined ? n - 1 : i1) : n;
  for (let i = first; i <= last; i++) {
    const j = i % n, rx = -T.tz[j], rz = T.tx[j];
    pos.set([T.x[j] + rx * o1, y, T.z[j] + rz * o1, T.x[j] + rx * o2, y, T.z[j] + rz * o2], i * 6);
    uv.set([0, i * T.ds / vrep, (o2 - o1) / vrep, i * T.ds / vrep], i * 4);
    if (i < last) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
  const nrm = new Float32Array((n + 1) * 6); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  return new THREE.Mesh(g, mat);
}
function kerbs(T) {
  const pos = [], col = [], nrm = [], RED = lin(0xc81a14).toArray(), WH = lin(0xeeeeea).toArray();
  for (let i = 0; i < T.N; i++) {
    let kk = 0; for (let m = -3; m <= 3; m++) { const v = T.k[(i + m + T.N) % T.N]; if (Math.abs(v) > Math.abs(kk)) kk = v; }
    if (Math.abs(kk) < 0.032) continue;
    const j = (i + 1) % T.N, s = Math.sign(kk), a = s > 0 ? HW : -HW - 0.9, b = s > 0 ? HW + 0.9 : -HW, c = (i >> 1) % 2 ? RED : WH;
    const P = (q, o) => [T.x[q] - T.tz[q] * o, Math.abs(o) > HW + 0.1 ? 0.085 : 0.038, T.z[q] + T.tx[q] * o];
    pos.push(...P(i, a), ...P(i, b), ...P(j, a), ...P(i, b), ...P(j, b), ...P(j, a));
    for (let q = 0; q < 6; q++) { col.push(...c); nrm.push(0, 1, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return new THREE.Mesh(g, M.kerb);
}
function tyreWalls(T) {
  const off = HW + RUNOFF, list = [];
  for (const side of [1, -1]) {
    let prev = null, carry = 0;
    for (let i = 0; i <= T.N; i++) {
      const j = i % T.N, p = [T.x[j] - T.tz[j] * off * side, T.z[j] + T.tx[j] * off * side];
      if (prev) {
        const dx = p[0] - prev[0], dz = p[1] - prev[1], len = Math.hypot(dx, dz); let s = carry;
        while (s < len) { const x = prev[0] + dx * s / len, z = prev[1] + dz * s / len; if (nearest(T, x, z).d > off - 0.3 && nearest(PIT, x, z).d > PIT_WALL - 0.3) list.push([x, z, j]); s += 0.7; }      // gaps where the pit lane passes through
        carry = s - len;
      }
      prev = p;
    }
  }
  // tyre walls down both sides of the pit lane, wherever it runs outside the track's own walls
  for (const side of [1, -1]) for (let i = 0; i < PIT.N; i++) {
    const x = PIT.x[i] - PIT.tz[i] * PIT_WALL * side, z = PIT.z[i] + PIT.tx[i] * PIT_WALL * side;
    if (nearest(T, x, z).d > off - 0.3 && nearest(PIT, x, z).d > PIT_WALL - 0.3) list.push([x, z, -1]);
  }
  const prof = [];
  for (let q = 0; q < 3; q++) { const y = q * 0.26; for (const p of [[0.2, 0.03], [0.3, 0.004], [0.345, 0.03], [0.36, 0.09], [0.36, 0.17], [0.345, 0.23], [0.3, 0.256], [0.2, 0.23]]) prof.push(new THREE.Vector2(p[0], y + p[1])); }
  const mesh = new THREE.InstancedMesh(new THREE.LatheGeometry(prof, 14), M.tyre, list.length); mesh.castShadow = true;
  const d = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((t, i) => {
    d.position.set(t[0], 0, t[1]); d.rotation.y = i; d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    let kk = 0; if (t[2] >= 0) for (let m = -6; m <= 6; m++) kk = Math.max(kk, Math.abs(T.k[(t[2] + m + T.N) % T.N]));
    if (kk > 0.035) c.set((i / 5 | 0) % 2 ? 0xc8261c : 0xe8e8e8).convertSRGBToLinear(); else c.setScalar(0.012 + (i * 7 % 5) * 0.003);
    mesh.setColorAt(i, c);
  });
  return mesh;
}
/* ---------------------------------------------------------------- pit lane (same for every layout) */
const pitSignTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#12703a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 60px Arial, sans-serif'; g.fillText('PIT', w / 2, 46);
  g.font = '700 30px Arial, sans-serif'; g.fillText('10 km/h', w / 2, 96);
});
function pitLane() {
  const G = new THREE.Group(), P = PIT, bay0 = Math.round(P.N * 0.3), bay1 = Math.round(P.N * 0.74);
  G.add(ribbon(P, -PIT_HW, PIT_HW, 0.018, M.oldAsphalt, 8, true));
  G.add(ribbon(P, -PIT_HW + 0.1, -PIT_HW + 0.22, 0.024, M.line, 1, true), ribbon(P, PIT_HW - 0.22, PIT_HW - 0.1, 0.024, M.line, 1, true));
  // working lane with marked bays down the outer (left) side, painted green like the plan
  const green = std({ color: lin(0x1f8a47), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  G.add(ribbon(P, -PIT_HW + 0.25, -0.5, 0.022, green, 4, true, bay0, bay1));
  for (let i = bay0; i <= bay1; i += 4) {
    const o = (-PIT_HW + 0.25 - 0.5) / 2, bar = new THREE.Mesh(new THREE.PlaneGeometry(PIT_HW - 0.75, 0.12), M.line);
    bar.rotation.x = -Math.PI / 2; bar.rotation.z = -Math.atan2(P.tx[i], -P.tz[i]) + Math.PI / 2;
    bar.position.set(P.x[i] - P.tz[i] * o, 0.026, P.z[i] + P.tx[i] * o); G.add(bar);
  }
  // sign boards at the way in and the way out
  const postM = M.lam(0x30363d), signM = std({ map: pitSignTex, side: THREE.DoubleSide, roughness: 0.6 });
  for (const i of [Math.round(P.N * 0.2), Math.round(P.N * 0.8)]) {
    const s = new THREE.Group(), o = -(PIT_WALL + 0.9);
    s.position.set(P.x[i] - P.tz[i] * o, 0, P.z[i] + P.tx[i] * o); s.rotation.y = Math.atan2(-P.tx[i], -P.tz[i]);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 10), postM); post.position.y = 1.3; post.castShadow = true;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), signM); board.position.y = 2.35; board.castShadow = true;
    s.add(post, board); G.add(s);
  }
  return G;
}
let track = null, trackGroup = null, mapBg = null, mapXf = null;
function buildTrack(key) {
  if (trackGroup) { scene.remove(trackGroup); trackGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const T = track = TRACKS[key], G = trackGroup = new THREE.Group();
  for (const k of TRACK_KEYS) if (k !== key) G.add(ribbon(TRACKS[k], -HW, HW, 0.012, M.oldAsphalt, 8));      // the layouts not in use
  G.add(pitLane());
  G.add(ribbon(T, -HW, HW, 0.03, M.asphalt, 8));
  G.add(ribbon(T, -1.5, 1.5, 0.036, M.rubber, 8));
  G.add(ribbon(T, -HW + 0.12, -HW + 0.27, 0.04, M.line, 1), ribbon(T, HW - 0.27, HW - 0.12, 0.04, M.line, 1));
  G.add(kerbs(T), tyreWalls(T));
  // start / finish line and gantry
  const sf = new THREE.Group(); sf.position.set(T.x[0], 0, T.z[0]); sf.rotation.y = Math.atan2(-T.tx[0], -T.tz[0]);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, 1), std({ map: chequerTex, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  line.rotation.x = -Math.PI / 2; line.position.y = 0.045; sf.add(line);
  const postM = M.lam(0x30363d), W = HW + 1.6;
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.4, 16), postM); p.position.set(s * W, 2.7, 0); p.castShadow = true; sf.add(p); }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 1.3), std({ map: bannerTex, side: THREE.DoubleSide }));
  banner.position.y = 4.7; banner.castShadow = true; sf.add(banner);
  // grid slots
  for (let q = 1; q <= 6; q++) {
    const i = (T.N - q * 5) % T.N, o = q % 2 ? -1.6 : 1.6, slot = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.12), M.line);
    slot.rotation.x = -Math.PI / 2; slot.rotation.z = -Math.atan2(T.tx[i], -T.tz[i]) + Math.PI / 2;
    slot.position.set(T.x[i] - T.tz[i] * o, 0.045, T.z[i] + T.tx[i] * o); G.add(slot);
  }
  G.add(sf);
  // apex cones
  const coneG = new THREE.LatheGeometry([[0.2, 0], [0.2, 0.03], [0.14, 0.035], [0.1, 0.2], [0.103, 0.2], [0.085, 0.3], [0.045, 0.52], [0, 0.53]].map(p => new THREE.Vector2(p[0], p[1])), 20), coneM = M.lam(0xff5a0a, 0.6); coneM.side = THREE.DoubleSide;
  for (let i = 0; i < T.N; i++) {
    const k = Math.abs(T.k[i]); if (k < 0.055 || k < Math.abs(T.k[(i + 1) % T.N]) || k <= Math.abs(T.k[(i + T.N - 1) % T.N])) continue;
    const o = Math.sign(T.k[i]) * (HW + 1.4), cone = new THREE.Mesh(coneG, coneM);
    cone.position.set(T.x[i] - T.tz[i] * o, 0, T.z[i] + T.tx[i] * o); cone.castShadow = true; G.add(cone);
  }
  G.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  scene.add(G);
  // minimap background
  mapBg = document.createElement('canvas'); mapBg.width = mapBg.height = 180;
  mapXf = drawTrack(mapBg.getContext('2d'), T, 180, 180, '#f2f2f2', 5, true);
}
function drawTrack(g, T, w, h, color, lw, ghost) {      // ghost: also show the other layouts faintly
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const t of TRACK_KEYS.map(k => TRACKS[k]).concat(PIT)) for (let i = 0; i < t.N; i++) { x0 = Math.min(x0, t.x[i]); x1 = Math.max(x1, t.x[i]); z0 = Math.min(z0, t.z[i]); z1 = Math.max(z1, t.z[i]); }
  const s = Math.min((w - 24) / (x1 - x0), (h - 24) / (z1 - z0)), ox = (w - (x1 - x0) * s) / 2 - x0 * s, oz = (h - (z1 - z0) * s) / 2 - z0 * s;
  const path = (t, c, l) => { g.beginPath(); for (let i = 0; i <= t.N; i++) { if (i === t.N && t === PIT) break; const j = i % t.N; g[i ? 'lineTo' : 'moveTo'](t.x[j] * s + ox, t.z[j] * s + oz); } g.strokeStyle = c; g.lineWidth = l; g.lineJoin = g.lineCap = 'round'; g.stroke(); };
  if (ghost) for (const k of TRACK_KEYS) if (TRACKS[k] !== T) path(TRACKS[k], 'rgba(255,255,255,0.16)', lw);
  path(PIT, '#3ddc84', lw * 0.6);
  path(T, color, lw);
  g.fillStyle = '#ff8a2b'; g.save(); g.translate(T.x[0] * s + ox, T.z[0] * s + oz); g.rotate(Math.atan2(T.tz[0], T.tx[0])); g.fillRect(-1.5, -lw, 3, lw * 2); g.restore();
  return { s, ox, oz };
}
