'use strict';
/* ---------------------------------------------------------------- the kart
   Modelled on development_assets/GoKart/GoKart1.png: an all-black hire kart with a full wrap-around plastic bumper,
   tall column fairing carrying the number plate, round steering wheel, bucket seat and a rear-right engine.
   Local axes: -z forward, +x right, +y up, origin on the ground under the middle of the kart. */
const kart = new THREE.Group(); scene.add(kart);
const wheelSpin = new THREE.Group(), arms = [], frontWheels = [], rollingWheels = [], driverHead = new THREE.Group(), fpHelmet = new THREE.Group(), visors = [];
const KART_NUMBER = '23';
function limb(mesh, a, b) {
  const d = b.clone().sub(a), l = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5); mesh.scale.set(1, l, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.multiplyScalar(1 / l));
}
(function buildKart() {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const plastic = M.lam(0x1a1b1d, 0.5), matte = M.lam(0x101112, 0.9), recess = M.lam(0x050505, 1), dark = M.lam(0x2a2d31, 0.7),
        metal = M.lam(0xb9bfc5, 0.35), steel = M.lam(0x6d7379, 0.45), rubber = M.lam(0x0f0f10, 0.95), suit = M.lam(0x1c2f57, 0.95),
        glove = M.lam(0x141414, 0.8), shoe = M.lam(0x222222, 0.8), red = M.lam(0xb3261c, 0.5), gold = M.lam(0xb08a3c, 0.4),
        helmet = M.lam(0x0c0c0d, 0.25), visor = M.lam(0x1a2026, 0.08), orange = M.lam(0xff7a1a, 0.45);
  for (const m of [plastic, matte, rubber]) m.side = THREE.DoubleSide;
  const add = (geo, mat, x, y, z, rx, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rx) m.rotation.x = rx; (parent || kart).add(m); return m; };
  const tube = (a, b, r, mat, parent) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat); (parent || kart).add(m); limb(m, a, b); return m; };
  const BEV = { bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 3, curveSegments: 18 };
  // rounded rectangle path in plan view: x = right, y = forward
  const rrect = (path, x0, y0, x1, y1, rf, rr) => {
    path.moveTo(x0 + rr, y0); path.lineTo(x1 - rr, y0); path.absarc(x1 - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
    path.lineTo(x1, y1 - rf); path.absarc(x1 - rf, y1 - rf, rf, 0, Math.PI / 2, false);
    path.lineTo(x0 + rf, y1); path.absarc(x0 + rf, y1 - rf, rf, Math.PI / 2, Math.PI, false);
    path.lineTo(x0, y0 + rr); path.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false); return path;
  };
  const plan = (shape, depth, y, mat, opts) => { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, Object.assign({ depth }, BEV, opts)), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; kart.add(m); return m; };
  // side-profile extrusion: shape x = forward, y = up, extruded across the kart
  const profile = (pts, width, x, mat, opts) => {
    const sh = new THREE.Shape(); pts.forEach((p, i) => sh[i ? 'lineTo' : 'moveTo'](p[0], p[1])); sh.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, Object.assign({ depth: width }, BEV, opts)), mat); m.rotation.y = Math.PI / 2; m.position.x = x - width / 2; kart.add(m); return m;
  };

  // ---- wrap-around bumper (GoKart1.png / Gokart2.png): swept along a curvy plan outline that bulges round the
  //      wheels and pinches in at the waist, with a rounded section whose top edge rises over the wheels and to the rear.
  //      Control points for the right-hand half: [x, forward, top height]; mirrored for the left.
  const HALF = [[0, 1.13, 0.25], [0.34, 1.12, 0.255], [0.6, 1.07, 0.27], [0.72, 0.95, 0.295], [0.745, 0.8, 0.305], [0.72, 0.62, 0.285], [0.65, 0.42, 0.235],
                [0.63, 0.18, 0.225], [0.67, -0.08, 0.27], [0.74, -0.38, 0.33], [0.775, -0.64, 0.365], [0.75, -0.86, 0.36], [0.62, -0.99, 0.335], [0.32, -1.03, 0.31], [0, -1.035, 0.3]];
  const ctrl = HALF.concat(HALF.slice(1, -1).reverse().map(p => [-p[0], p[1], p[2]])).map(p => V(p[0], p[2], p[1]));
  const NB = 220, BASE = 0.07, bp = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal').getSpacedPoints(NB); bp.pop();
  const frames = bp.map((p, i) => { const a = bp[(i + NB - 1) % NB], b = bp[(i + 1) % NB], tx = b.x - a.x, tf = b.z - a.z, l = Math.hypot(tx, tf); return { x: p.x, f: p.z, h: p.y - BASE, nx: -tf / l, nf: tx / l }; });
  const bend = i => { const a = frames[i], b = frames[(i + 1) % NB]; return 1 - (a.nx * b.nx + a.nf * b.nf); };
  // sweep a cross-section ([outward offset, height] pairs) round the outline; `keep` limits it to open strips
  const sweep = (section, mat, keep) => {
    const pos = [], idx = [], m = section(1).length;
    frames.forEach(fr => section(fr.h).forEach(q => pos.push(fr.x + fr.nx * q[0], BASE + q[1], -(fr.f + fr.nf * q[0]))));
    for (let i = 0; i < NB; i++) {
      if (keep && !keep(i)) continue; const j = (i + 1) % NB;
      for (let k = 0; k < (keep ? m - 1 : m); k++) { const k2 = (k + 1) % m, a = i * m + k, b = i * m + k2, c = j * m + k, d = j * m + k2; idx.push(a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat); kart.add(mesh); return mesh;
  };
  const BT = 0.085; recess.side = THREE.DoubleSide;
  sweep(h => [[-BT, 0], [-0.01, -0.012], [0.028, 0.03], [0.045, h * 0.3], [0.047, h * 0.58], [0.034, h * 0.84], [0.005, h * 0.98], [-0.035, h], [-0.07, h * 0.95], [-BT, h * 0.8]], plastic);
  sweep(h => [[0.05, h * 0.38], [0.051, h * 0.58]], recess, i => i % 22 < 15 && bend(i) < 0.004);          // long moulded recesses
  sweep(h => [[0.043, h * 0.14], [0.048, h * 0.25]], recess, i => i % 22 > 2 && i % 22 < 11 && bend(i) < 0.004);
  const POD = { bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 5 };
  for (const s of [-1, 1]) {
    // side pods bridging bumper and seat (the right one stops short to clear the engine)
    plan(rrect(new THREE.Shape(), s > 0 ? 0.36 : -0.58, s > 0 ? -0.2 : -0.9, s > 0 ? 0.58 : -0.36, 0.08, 0.1, 0.06), 0.03, 0.285, plastic, POD);
    add(new THREE.BoxGeometry(0.13, 0.012, s > 0 ? 0.16 : 0.66), recess, s * 0.47, 0.346, s > 0 ? -0.06 : 0.4);
  }

  // ---- chassis
  add(new THREE.BoxGeometry(0.62, 0.012, 1.0), dark, 0, 0.07, -0.45);                               // floor pan
  for (const s of [-1, 1]) {
    tube(V(s * 0.3, 0.09, 0.8), V(s * 0.34, 0.09, -0.2), 0.016, steel); tube(V(s * 0.34, 0.09, -0.2), V(s * 0.22, 0.1, -0.95), 0.016, steel);
    tube(V(s * 0.22, 0.1, -0.95), V(s * 0.5, 0.127, -0.8), 0.014, steel);                            // stub axle
    tube(V(s * 0.46, 0.06, -0.8), V(s * 0.46, 0.2, -0.8), 0.012, metal);                             // king pin
    tube(V(0, 0.14, -0.78), V(s * 0.44, 0.14, -0.74), 0.007, metal);                                 // tie rod
  }
  tube(V(-0.34, 0.09, -0.2), V(0.34, 0.09, -0.2), 0.014, steel); tube(V(-0.3, 0.09, 0.8), V(0.3, 0.09, 0.8), 0.014, steel);
  tube(V(-0.22, 0.1, -0.95), V(0.22, 0.1, -0.95), 0.014, steel);

  // ---- wheels (tucked inside the bumper)
  const tyreGeo = (Rr, w) => { const g = new THREE.LatheGeometry([[0.062, -w / 2], [Rr - 0.035, -w / 2], [Rr - 0.008, -w / 2 + 0.02], [Rr, -w / 2 + 0.045], [Rr, w / 2 - 0.045], [Rr - 0.008, w / 2 - 0.02], [Rr - 0.035, w / 2], [0.062, w / 2]].map(p => new THREE.Vector2(p[0], p[1])), 36); g.rotateZ(Math.PI / 2); return g; };
  const wheel = (Rr, w, parent) => {
    const g = new THREE.Group(); parent.add(g); rollingWheels.push(g);
    g.add(new THREE.Mesh(tyreGeo(Rr, w), rubber));
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.064, w * 0.86, 24), metal); rim.rotation.z = Math.PI / 2; g.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, w * 0.9, 12), steel); hub.rotation.z = Math.PI / 2; g.add(hub);
    for (let q = 0; q < 3; q++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, w * 0.92, 6), steel); b.rotation.z = Math.PI / 2; b.position.set(0, Math.cos(q * 2.094) * 0.04, Math.sin(q * 2.094) * 0.04); g.add(b); }
    return g;
  };
  for (const s of [-1, 1]) {
    const fw = new THREE.Group(); fw.position.set(s * 0.555, 0.127, -0.8); kart.add(fw); frontWheels.push(fw); wheel(0.127, 0.125, fw);
    const rw = new THREE.Group(); rw.position.set(s * 0.515, 0.14, 0.62); kart.add(rw); wheel(0.14, 0.2, rw);
  }
  tube(V(-0.52, 0.14, 0.62), V(0.52, 0.14, 0.62), 0.02, metal);                                      // rear axle
  const sprocket = add(new THREE.CylinderGeometry(0.085, 0.085, 0.008, 28), gold, 0.24, 0.14, 0.62); sprocket.rotation.z = Math.PI / 2;
  const disc = add(new THREE.CylinderGeometry(0.085, 0.085, 0.006, 28), metal, -0.2, 0.14, 0.62); disc.rotation.z = Math.PI / 2;
  add(new THREE.BoxGeometry(0.04, 0.05, 0.07), red, -0.2, 0.2, 0.67);                                // brake caliper
  add(new THREE.BoxGeometry(0.03, 0.04, 0.3), matte, 0.24, 0.2, 0.5);                                // chain guard

  // ---- column fairing with the number plate
  profile([[0.97, 0.12], [0.96, 0.22], [0.68, 0.56], [0.59, 0.56], [0.62, 0.3], [0.76, 0.12]], 0.23, 0, plastic, { bevelThickness: 0.045, bevelSize: 0.035, bevelSegments: 6 });
  const plateTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a2a2c'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#f4f4f2'; g.font = 'italic 800 170px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(KART_NUMBER, w / 2 - 6, h / 2 + 10);
  });
  const plate = add(new THREE.PlaneGeometry(0.23, 0.25), std({ map: plateTex, roughness: 0.4 }), 0, 0.42, -0.8); plate.rotation.set(0.69, Math.PI, 0);
  plate.position.add(V(0, 0.64, -0.77).multiplyScalar(0.038));
  add(new THREE.BoxGeometry(0.2, 0.07, 0.14), matte, 0, 0.625, -0.62);                               // tank / cap block on top of the fairing
  add(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 20), plastic, 0, 0.672, -0.62);
  add(new THREE.BoxGeometry(0.2, 0.13, 0.26), matte, 0, 0.165, -0.4);                                // fuel tank under the column
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 16), red, 0.05, 0.24, -0.36);

  // ---- seat, set low between the rails
  profile([[0.03, 0.175], [-0.3, 0.125], [-0.42, 0.165], [-0.57, 0.68], [-0.615, 0.68], [-0.47, 0.13], [-0.31, 0.085], [0.03, 0.135]], 0.37, 0, matte, { bevelThickness: 0.012, bevelSize: 0.012 });
  for (const s of [-1, 1]) profile([[0.01, 0.17], [-0.42, 0.16], [-0.54, 0.56], [-0.45, 0.4], [-0.33, 0.33], [-0.08, 0.29]], 0.02, s * 0.205, matte, { bevelThickness: 0.008, bevelSize: 0.008 });
  for (const s of [-1, 1]) tube(V(s * 0.2, 0.3, 0.42), V(s * 0.3, 0.1, 0.62), 0.01, steel);          // seat stays

  // ---- engine, rear right
  const eng = new THREE.Group(); eng.position.set(0.37, 0, 0.34); kart.add(eng);
  add(new THREE.BoxGeometry(0.2, 0.15, 0.22), steel, 0, 0.19, 0, 0, eng);                            // crankcase
  for (let q = 0; q < 8; q++) add(new THREE.BoxGeometry(0.17, 0.008, 0.17), metal, 0, 0.275 + q * 0.016, -0.01, 0, eng);   // cylinder fins
  add(new THREE.BoxGeometry(0.15, 0.03, 0.15), steel, 0, 0.41, -0.01, 0, eng);                       // head
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), metal, 0, 0.44, -0.01, 0, eng);             // spark plug
  const recoil = add(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24), matte, 0.125, 0.2, 0, 0, eng); recoil.rotation.z = Math.PI / 2;
  add(new THREE.BoxGeometry(0.2, 0.08, 0.18), matte, -0.02, 0.5, -0.02, 0, eng);                     // tank / air box on top
  add(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16), plastic, -0.02, 0.55, -0.02, 0, eng);
  add(new THREE.BoxGeometry(0.1, 0.1, 0.08), matte, 0, 0.32, -0.14, 0, eng);                         // carb + air filter
  tube(V(-0.02, 0.33, 0.1), V(-0.02, 0.3, 0.26), 0.016, steel, eng); tube(V(-0.02, 0.3, 0.26), V(0.1, 0.27, 0.36), 0.016, steel, eng);   // exhaust header
  const muff = add(new THREE.CylinderGeometry(0.05, 0.05, 0.26, 20), steel, 0.12, 0.27, 0.47, Math.PI / 2, eng);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), steel, 0.12, 0.27, 0.62, Math.PI / 2, eng);

  // ---- pedals
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.075, 0.14, 0.012), metal, s * 0.23, 0.26, -0.83, -0.4);
    tube(V(s * 0.23, 0.08, -0.8), V(s * 0.23, 0.2, -0.82), 0.008, steel);
  }

  // ---- steering wheel (development_assets/GoKart/SteeringWheel_and_Hands.png): chunky squared-off rim, upper spoke with a label,
  //      two worn steel lower spokes and a three-bolt hub
  const tilt = new THREE.Group(); tilt.position.set(0, 0.5, -0.4); tilt.rotation.x = -0.5; kart.add(tilt); tilt.add(wheelSpin);
  const RIM_A = 0.166, RIM_B = 0.152, RIM_E = 2 / 2.7;
  const rimPt = (a, t) => { const c = Math.cos(a), sn = Math.sin(a); return (t || new THREE.Vector3()).set(RIM_A * Math.sign(c) * Math.pow(Math.abs(c), RIM_E), RIM_B * Math.sign(sn) * Math.pow(Math.abs(sn), RIM_E), 0); };
  class RimCurve extends THREE.Curve { getPoint(t, target) { return rimPt(t * Math.PI * 2, target); } }
  const rimM = M.lam(0x131314, 0.72), rustM = M.lam(0x6e4b38, 0.95), boltM = M.lam(0xc9ced3, 0.3);
  const rim = new THREE.Mesh(new THREE.TubeGeometry(new RimCurve(), 140, 0.0195, 18, true), rimM); rim.scale.z = 0.88; wheelSpin.add(rim);
  for (const s of [-1, 1]) for (const y of [0.07, -0.065]) {                                         // moulded thumb / palm swells
    const p = rimPt(Math.atan2(y, s * 0.15)), sw = new THREE.Mesh(new THREE.SphereGeometry(0.0235, 16, 12), rimM); sw.position.copy(p); sw.scale.set(1, 1.9, 0.85); sw.rotation.z = -s * Math.sign(y) * 0.35; wheelSpin.add(sw);
  }
  const spoke = (ang, r0, r1, w0, w1, mat, z, t) => {
    const sh = new THREE.Shape(); sh.moveTo(r0, -w0); sh.lineTo(r1, -w1); sh.lineTo(r1, w1); sh.lineTo(r0, w0); sh.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 }), mat); m.rotation.z = ang; m.position.z = z; wheelSpin.add(m); return m;
  };
  spoke(Math.PI / 2, 0.015, 0.148, 0.03, 0.023, matte, -0.004, 0.006);                               // upper spoke
  spoke(-0.6, 0.02, rimPt(-0.6).length() - 0.006, 0.021, 0.018, rustM, -0.01, 0.004);                // lower spokes, surface-rusted steel
  spoke(Math.PI + 0.6, 0.02, rimPt(Math.PI + 0.6).length() - 0.006, 0.021, 0.018, rustM, -0.01, 0.004);
  const hubPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.01, 32), matte); hubPlate.rotation.x = Math.PI / 2; hubPlate.position.z = -0.002; wheelSpin.add(hubPlate);
  for (let q = 0; q < 3; q++) {
    const a = Math.PI / 2 + q * Math.PI * 2 / 3, bx = Math.cos(a) * 0.03, by = Math.sin(a) * 0.03;
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.003, 20), boltM); washer.rotation.x = Math.PI / 2; washer.position.set(bx, by, 0.0045); wheelSpin.add(washer);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.007, 6), steel); bolt.rotation.x = Math.PI / 2; bolt.position.set(bx, by, 0.008); wheelSpin.add(bolt);
  }
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 16), steel); boss.rotation.x = Math.PI / 2; boss.position.z = 0.005; wheelSpin.add(boss);
  const labelTex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#f3f1ee'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c2185b'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#c2185b'; g.font = 'italic 700 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Kart', w / 2, h / 2 + 2);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.02), std({ map: labelTex, roughness: 0.5 })); label.position.set(0, 0.098, 0.0042); wheelSpin.add(label);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.62, 10), metal); col.rotation.x = Math.PI / 2; col.position.z = -0.31; tilt.add(col);

  // ---- driver
  for (const s of [-1, 1]) {
    const hip = V(s * 0.12, 0.26, 0.22), knee = V(s * 0.2, 0.45, -0.22), foot = V(s * 0.23, 0.22, -0.74);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.068, 1, 16), suit); kart.add(thigh); limb(thigh, hip, knee);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.05, 1, 16), suit); kart.add(shin); limb(shin, knee, foot);
    add(new THREE.SphereGeometry(0.07, 16, 12), suit, knee.x, knee.y, knee.z);
    add(new THREE.BoxGeometry(0.09, 0.2, 0.07), shoe, foot.x, foot.y + 0.04, foot.z - 0.03, -0.4);
    const hand = new THREE.Group(); hand.position.set(s * 0.163, 0.03, 0); wheelSpin.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.044, 20, 14), glove); palm.scale.set(0.75, 1.2, 0.8); palm.position.set(s * 0.012, 0, 0.022); hand.add(palm);
    for (let q = 0; q < 4; q++) {                                                                      // fingers wrapped over the far side of the rim
      const fy = 0.036 - q * 0.023, fin = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0105, 0.058, 10), glove); fin.rotation.z = Math.PI / 2; fin.position.set(-s * 0.004, fy, -0.024); hand.add(fin);
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 10, 8), glove); kn.position.set(s * 0.026, fy, -0.012); hand.add(kn);
    }
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.011, 0.06, 10), glove); thumb.position.set(-s * 0.012, 0.048, 0.02); thumb.rotation.z = s * 0.5; hand.add(thumb);
    const mk = (r1, r2) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 1, 16), suit); kart.add(m); return m; };
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), suit); kart.add(elbow);
    add(new THREE.SphereGeometry(0.075, 16, 12), suit, s * 0.22, 0.61, 0.25);                        // shoulder
    arms.push({ s, hand, upper: mk(0.048, 0.058), fore: mk(0.038, 0.048), elbow, shoulder: V(s * 0.24, 0.6, 0.22) });
  }
  const torso = add(new THREE.CylinderGeometry(0.17, 0.14, 0.42, 24), suit, 0, 0.43, 0.3, 0.1); torso.scale.set(1.25, 1, 0.78);
  add(new THREE.SphereGeometry(0.15, 20, 14), suit, 0, 0.24, 0.27).scale.set(1.25, 0.7, 0.9);        // hips
  // helmet: only shown from the chase camera (it would block the driver's-eye view)
  driverHead.position.set(0, 0.82, 0.2); kart.add(driverHead);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 16), suit, 0, -0.15, 0.02, 0, driverHead);
  // open-face shell with a see-through perspex visor over the aperture (forward is phi = 1.5 pi)
  const PI = Math.PI, shellPatch = (r, p0, pl, t0, tl, mat, parent) => add(new THREE.SphereGeometry(r, 40, 20, p0, pl, t0, tl), mat, 0, 0, 0, 0, parent);
  const shell = new THREE.Group(); shell.scale.set(1, 1.05, 1.14); driverHead.add(shell);
  helmet.side = THREE.DoubleSide;
  shellPatch(0.15, 0, PI * 2, 0, PI * 0.34, helmet, shell); shellPatch(0.15, 0, PI * 2, PI * 0.56, PI * 0.44, helmet, shell);
  shellPatch(0.15, PI * 1.8, PI * 1.4, PI * 0.34, PI * 0.22, helmet, shell);
  const perspex = new THREE.MeshStandardMaterial({ color: lin(0x7d98a8), transparent: true, opacity: 0.3, roughness: 0.04, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  visors.push(shellPatch(0.153, PI * 1.19, PI * 0.62, PI * 0.33, PI * 0.24, perspex, shell));
  add(new THREE.SphereGeometry(0.108, 24, 18), M.lam(0xc99a7c, 0.8), 0, -0.005, -0.012, 0, driverHead);     // face behind the visor
  add(new THREE.SphereGeometry(0.112, 24, 18, 0, PI * 2, PI * 0.5, PI * 0.5), matte, 0, -0.012, -0.012, 0, driverHead);   // balaclava
  add(new THREE.BoxGeometry(0.1, 0.035, 0.03), matte, 0, -0.085, -0.155, 0, driverHead);             // chin vent
  driverHead.visible = false;

  kart.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // ---- driver's-eye helmet: dark shell around the camera with the tinted perspex visor in front of the eyes
  const inside = new THREE.MeshBasicMaterial({ color: 0x060607, side: THREE.BackSide });
  const T0 = PI * 0.335, T1 = PI * 0.705, P0 = PI * 1.21, PL = PI * 0.58;
  shellPatch(0.17, 0, PI * 2, 0, T0, inside, fpHelmet); shellPatch(0.17, 0, PI * 2, T1, PI - T1, inside, fpHelmet);
  shellPatch(0.17, P0 + PL, PI * 2 - PL, T0, T1 - T0, inside, fpHelmet);
  const visorTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = 'rgba(70,95,110,0.10)'; g.fillRect(0, 0, w, h);                  // light smoke tint
    const top = g.createLinearGradient(0, 0, 0, h * 0.34); top.addColorStop(0, 'rgba(12,18,26,0.62)'); top.addColorStop(0.55, 'rgba(14,22,30,0.38)'); top.addColorStop(1, 'rgba(20,30,40,0)');
    g.fillStyle = top; g.fillRect(0, 0, w, h * 0.34);                                // darker sun strip along the top
    g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1;
    for (let i = 0; i < 9; i++) { g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.lineTo(x + rnd() * 50 - 25, y + rnd() * 16 - 8); g.stroke(); }
  });
  const fpVisor = shellPatch(0.166, P0, PL, T0, T1 - T0, new THREE.MeshBasicMaterial({ map: visorTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }), fpHelmet);
  visors.push(fpVisor);
  fpHelmet.traverse(o => { o.castShadow = false; });
  camera.add(fpHelmet);
  kart.add(camera);
})();
