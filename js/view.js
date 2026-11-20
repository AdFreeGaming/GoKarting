'use strict';
/* ---------------------------------------------------------------- view + HUD (shared by the desktop and phone pages) */
const tmpV = new THREE.Vector3(), tmpE = new THREE.Vector3(), mapG = $('mapc').getContext('2d');
function render(dt) {
  // head look: mouse is persistent, arrow keys glance and spring back
  const ty = ((keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0)) * 1.25, tp = ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * 0.45;
  head.ky += (ty - head.ky) * Math.min(1, dt * 7); head.kp += (tp - head.kp) * Math.min(1, dt * 7);
  if (!mouseLook) { head.my -= head.my * Math.min(1, dt * 5); head.mp -= head.mp * Math.min(1, dt * 5); }   // tracking released: face forward again
  const sp = Math.abs(S.v), sf = sp / VMAX;
  kart.position.set(S.x, 0, S.z); kart.rotation.y = -S.h - Math.PI / 2;
  S.shake = Math.max(0, S.shake - dt * 3);
  const rough = (S.onGrass ? 0.02 : 0.0035) * Math.min(1, sp / 5) + S.shake * 0.05;
  if (chase) {                                        // outside view orbiting the kart
    const yaw = head.my + head.ky;
    camera.position.set(Math.sin(yaw) * 3.4, 1.45, Math.cos(yaw) * 3.4);
    camera.rotation.set(-0.3 + (head.mp + head.kp) * 0.5, yaw, 0);
  } else {
    camera.position.set(clamp(S.lat * 0.0035, -0.06, 0.06) + (Math.random() - 0.5) * rough, 0.83 + (Math.random() - 0.5) * rough, 0.14);
    camera.rotation.y = clamp(head.my + head.ky, -2.1, 2.1) - S.steer * 0.12 * Math.min(1, sp / 8);
    camera.rotation.x = clamp(head.mp + head.kp, -0.9, 0.7) - 0.06;
    camera.rotation.z = clamp(-S.lat * 0.0025, -0.05, 0.05);
  }
  driverHead.visible = chase; fpHelmet.visible = !chase;
  const sd = ENV.sun, sx = S.x + sd.x * sunFx.DIST, sy = sd.y * sunFx.DIST, sz = S.z + sd.z * sunFx.DIST;
  sunFx.sprite.position.set(sx, sy, sz); if (sunFx.flare) sunFx.flare.position.set(sx, sy, sz);
  const fov = 78 + sf * sf * 8; if (Math.abs(fov - camera.fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  wheelSpin.rotation.z = -S.steer * 1.25;
  for (const w of frontWheels) w.rotation.y = -S.steer * 0.45;
  for (const w of rollingWheels) w.rotation.x -= S.v * dt / 0.133;
  kart.updateMatrixWorld(true);
  for (const a of arms) {
    a.hand.getWorldPosition(tmpV); kart.worldToLocal(tmpV);
    tmpE.copy(a.shoulder).add(tmpV).multiplyScalar(0.5); tmpE.x += a.s * 0.09; tmpE.y -= 0.1; tmpE.z += 0.03;
    limb(a.upper, a.shoulder, tmpE); limb(a.fore, tmpE, tmpV); a.elbow.position.copy(tmpE);
  }
  renderer.render(scene, camera);

  // HUD
  $('spd').firstChild.nodeValue = Math.round(sp * 3.6);
  $('rpm').style.width = clamp(S.rpm / RPM_MAX * 100, 0, 100) + '%'; $('rpmtxt').textContent = (Math.round(S.rpm / 100) * 100) + ' RPM' + (auto ? '  ·  AUTOPILOT' : '');
  $('lapn').textContent = R.started ? R.laps + 1 - R.pen : 'out';
  const cur = $('cur'); cur.textContent = fmt(R.started ? time - R.lapStart : 0); cur.className = 'big' + (R.invalid ? ' bad' : '');
  $('last').textContent = fmt(R.last); $('best').textContent = fmt(R.best);
  if (R.valid.length > 1) { const m = R.valid.reduce((a, b) => a + b) / R.valid.length; $('cons').textContent = '±' + Math.sqrt(R.valid.reduce((a, b) => a + (b - m) * (b - m), 0) / R.valid.length).toFixed(3) + ' s'; } else $('cons').textContent = '-';
  $('stint').textContent = Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0');
  $('bon').textContent = Math.min(R.bo, 2); $('offn').textContent = R.offs % 3; $('bfn').textContent = R.flags; $('pen').textContent = R.pen;
  if (msgT > 0 && (msgT -= dt) <= 0) $('msg').style.opacity = 0;
  if (mapBg) {
    mapG.clearRect(0, 0, 180, 180); mapG.drawImage(mapBg, 0, 0);
    mapG.save(); mapG.translate(S.x * mapXf.s + mapXf.ox, S.z * mapXf.s + mapXf.oz); mapG.rotate(S.h);
    mapG.fillStyle = '#ff8a2b'; mapG.strokeStyle = '#000'; mapG.lineWidth = 1.5; mapG.beginPath(); mapG.moveTo(8, 0); mapG.lineTo(-5, -5); mapG.lineTo(-5, 5); mapG.closePath(); mapG.fill(); mapG.stroke(); mapG.restore();
  }
}
let lastT = performance.now(), preFrame = null;      // preFrame: optional per-frame input hook (phone controls)
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (preFrame) preFrame(dt);
  if (running) { update(dt / 2); update(dt / 2); }
  if (Math.abs(ENV.hour - ENV.applied) > 1 / 1800) applySun();      // move the sun every couple of seconds of play
  audioUpdate(dt); render(dt);
}

/* ---------------------------------------------------------------- break-out time slider (both menus) */
function initBreakout(describe) {
  const el = $('bot');
  const show = () => { $('botv').textContent = BO_CUSTOM ? BO_CUSTOM.toFixed(2) + ' s' : 'track default'; describe(); };
  el.value = BREAKOUT.full;
  el.addEventListener('input', () => {
    BO_CUSTOM = +el.value;
    if (sessionActive) { R.breakout = BO_CUSTOM; $('bo').textContent = BO_CUSTOM.toFixed(2) + ' s'; }      // applies to the paused session too
    show();
  });
  show();
}
