'use strict';
/* ---------------------------------------------------------------- per-layout track geometry */
function ribbon(T, o1, o2, y, mat, vrep) {
  const n = T.N, pos = new Float32Array((n + 1) * 6), uv = new Float32Array((n + 1) * 4), idx = [];
  for (let i = 0; i <= n; i++) {
    const j = i % n, rx = -T.tz[j], rz = T.tx[j];
    pos.set([T.x[j] + rx * o1, y, T.z[j] + rz * o1, T.x[j] + rx * o2, y, T.z[j] + rz * o2], i * 6);
    uv.set([0, i * T.ds / vrep, (o2 - o1) / vrep, i * T.ds / vrep], i * 4);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
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
        while (s < len) { const x = prev[0] + dx * s / len, z = prev[1] + dz * s / len; if (nearest(T, x, z).d > off - 0.3) list.push([x, z, j]); s += 0.7; }
        carry = s - len;
      }
      prev = p;
    }
  }
  const prof = [];
  for (let q = 0; q < 3; q++) { const y = q * 0.26; for (const p of [[0.2, 0.03], [0.3, 0.004], [0.345, 0.03], [0.36, 0.09], [0.36, 0.17], [0.345, 0.23], [0.3, 0.256], [0.2, 0.23]]) prof.push(new THREE.Vector2(p[0], y + p[1])); }
  const mesh = new THREE.InstancedMesh(new THREE.LatheGeometry(prof, 14), M.tyre, list.length); mesh.castShadow = true;
  const d = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((t, i) => {
    d.position.set(t[0], 0, t[1]); d.rotation.y = i; d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
    let kk = 0; for (let m = -6; m <= 6; m++) kk = Math.max(kk, Math.abs(T.k[(t[2] + m + T.N) % T.N]));
    if (kk > 0.035) c.set((i / 5 | 0) % 2 ? 0xc8261c : 0xe8e8e8).convertSRGBToLinear(); else c.setScalar(0.012 + (i * 7 % 5) * 0.003);
    mesh.setColorAt(i, c);
  });
  return mesh;
}
let track = null, trackGroup = null, mapBg = null, mapXf = null;
function buildTrack(key) {
  if (trackGroup) { scene.remove(trackGroup); trackGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const T = track = TRACKS[key], G = trackGroup = new THREE.Group();
  const other = TRACKS[key === 'full' ? 'short' : 'full'];
  G.add(ribbon(other, -HW, HW, 0.012, M.oldAsphalt, 8));
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
  mapXf = drawTrack(mapBg.getContext('2d'), T, 180, 180, '#f2f2f2', 5, other);
}
function drawTrack(g, T, w, h, color, lw, ghost) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const t of [TRACKS.full, TRACKS.short]) for (let i = 0; i < t.N; i++) { x0 = Math.min(x0, t.x[i]); x1 = Math.max(x1, t.x[i]); z0 = Math.min(z0, t.z[i]); z1 = Math.max(z1, t.z[i]); }
  const s = Math.min((w - 24) / (x1 - x0), (h - 24) / (z1 - z0)), ox = (w - (x1 - x0) * s) / 2 - x0 * s, oz = (h - (z1 - z0) * s) / 2 - z0 * s;
  const path = (t, c, l) => { g.beginPath(); for (let i = 0; i <= t.N; i++) { const j = i % t.N; g[i ? 'lineTo' : 'moveTo'](t.x[j] * s + ox, t.z[j] * s + oz); } g.strokeStyle = c; g.lineWidth = l; g.lineJoin = 'round'; g.stroke(); };
  if (ghost) path(ghost, 'rgba(255,255,255,0.16)', lw);
  path(T, color, lw);
  g.fillStyle = '#ff8a2b'; g.save(); g.translate(T.x[0] * s + ox, T.z[0] * s + oz); g.rotate(Math.atan2(T.tz[0], T.tx[0])); g.fillRect(-1.5, -lw, 3, lw * 2); g.restore();
  return { s, ox, oz };
}
