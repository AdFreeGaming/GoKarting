'use strict';
/* ---------------------------------------------------------------- view + HUD */
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
let lastT = performance.now();
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  if (running) { update(dt / 2); update(dt / 2); }
  if (Math.abs(ENV.hour - ENV.applied) > 1 / 1800) applySun();      // move the sun every couple of seconds of play
  audioUpdate(dt); render(dt);
}

/* ---------------------------------------------------------------- input + menu */
const menu = $('menu');
function lockMouse() { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
// head tracking with the mouse: one click turns it on, the next click releases it
let wasLocked = false;
function setLook(on) {
  mouseLook = on;
  if (on) lockMouse(); else if (document.pointerLockElement) document.exitPointerLock();
  $('hint').textContent = on ? 'Head tracking on · click to release' : 'Click to turn your head with the mouse';
}
function openMenu() { running = false; menu.style.display = 'flex'; setLook(false); refreshSaves(); }
function closeMenu() { if (!sessionActive) return; menu.style.display = 'none'; running = true; setLook(true); }
function choose(key) { menu.style.display = 'none'; initAudio(); if (!ENV.manual) matchClock(); currentSave = null; startSession(key); setLook(true); }
// start at the computer's clock time if it is daytime at the circuit, otherwise at 3 pm
function matchClock() {
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
  ENV.month = now.getMonth(); ENV.hour = (h >= 8 && h <= 19 && sunVector(ENV.month, h).el > 0) ? h : 15; applySun();
}

/* ---------------------------------------------------------------- saving progress (see storage.js) */
let currentSave = null;                                   // { id, label } of the slot this session was last saved to / loaded from
const snapshot = (id, label) => ({ id, label, saved: Date.now(), track: track.key, time, hour: ENV.hour, month: ENV.month,
  kart: { x: S.x, z: S.z, h: S.h }, R: JSON.parse(JSON.stringify(R)) });
function saveGame(label) {
  if (!sessionActive) return Promise.resolve();
  label = (label || '').trim().slice(0, 40) || (currentSave && currentSave.label) || 'Session ' + new Date().toLocaleString();
  const id = currentSave && currentSave.label === label ? currentSave.id : Store.newId();
  currentSave = { id, label };
  return Store.put(snapshot(id, label)).then(() => { say('Saved: ' + label, '#3ddc84', 1.8); refreshSaves(); }, () => say('Could not save in this browser', '#ff6b5e', 3));
}
function autosave() { if (sessionActive && !auto) Store.put(snapshot('autosave', 'Autosave (last completed lap)')).catch(() => {}); }
function loadGame(rec) {
  menu.style.display = 'none'; initAudio(); startSession(rec.track);
  Object.assign(R, rec.R, { wrong: 0 }); time = rec.time;
  S.x = rec.kart.x; S.z = rec.kart.z; S.h = rec.kart.h; S.v = 0; S.near = nearest(track, S.x, S.z);
  ENV.month = rec.month; ENV.hour = rec.hour; ENV.manual = true; applySun();
  currentSave = rec.id === 'autosave' ? null : { id: rec.id, label: rec.label };
  setLook(true);
  if (R.excluded) say('RULE 4 \u00b7 EXCLUDED \u2013 3 black flags.  Press Enter to restart', '#ff6b5e', 1e9); else say('Resumed: ' + rec.label, '#3ddc84', 2.5);
}
function refreshSaves() {
  $('savebar').style.display = sessionActive ? 'flex' : 'none';
  if (sessionActive && document.activeElement !== $('savelabel')) $('savelabel').value = currentSave ? currentSave.label : '';
  Store.list().then(list => {
    const box = $('savelist'); box.textContent = '';
    if (!list.length) { box.textContent = 'No saved sessions yet.'; return; }
    for (const rec of list) {
      const row = document.createElement('div'), info = document.createElement('div'), name = document.createElement('b'), meta = document.createElement('span');
      row.className = 'saverow'; name.textContent = rec.label;
      const laps = rec.R.laps - rec.R.pen, mins = Math.floor(rec.time / 60);
      meta.textContent = TRACKS[rec.track].name + ' \u00b7 ' + laps + ' lap' + (laps === 1 ? '' : 's') + ' \u00b7 ' + (mins >= 60 ? Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min' : mins + ' min') +
        ' driven \u00b7 ' + clock(rec.hour) + ' \u00b7 saved ' + new Date(rec.saved).toLocaleString();
      info.append(name, meta);
      const go = document.createElement('button'), del = document.createElement('button');
      go.textContent = 'Resume'; go.addEventListener('click', () => loadGame(rec));
      del.textContent = 'Delete'; del.className = 'ghost'; del.addEventListener('click', () => Store.remove(rec.id).then(refreshSaves));
      row.append(info, go, del); box.appendChild(row);
    }
  });
}
$('savebtn').addEventListener('click', () => saveGame($('savelabel').value));
$('savelabel').addEventListener('keydown', e => { if (e.code === 'Enter') saveGame($('savelabel').value); });
$('resumebtn').addEventListener('click', closeMenu);
addEventListener('keydown', e => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;      // typing a save label, not driving
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return; keys[e.code] = true;
  if (menu.style.display !== 'none') { envKey(e.code); if (e.code === 'Digit1') choose('full'); if (e.code === 'Digit2') choose('short'); if (e.code === 'KeyT' || e.code === 'Escape') closeMenu(); return; }
  if (e.code === 'KeyR' && !R.excluded) { resetKart(S.near.i); say('Reset to track', '#fff', 1.2); }
  if (e.code === 'KeyC') head.my = head.mp = 0;
  if (e.code === 'KeyM') AU.muted = !AU.muted;
  if (e.code === 'KeyP') { auto = !auto; say(auto ? 'Autopilot demo ON' : 'Autopilot OFF', '#fff', 1.5); }
  if (e.code === 'KeyT') openMenu();
  if (e.code === 'KeyV') chase = !chase;
  if (e.code === 'KeyH') { const up = visors[0].visible; for (const v of visors) v.visible = !up; say(up ? 'Visor up' : 'Visor down', '#fff', 1); }
  envKey(e.code);
  if (e.code === 'KeyK') saveGame();
  if (e.code === 'Enter') { if (R.excluded || e.shiftKey) { currentSave = null; startSession(); } else say('Shift + Enter restarts the session', '#fff', 1.8); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('click', () => { initAudio(); setLook(!mouseLook); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (wasLocked && !locked && mouseLook) setLook(false);          // Esc released the mouse
  wasLocked = locked;
});
addEventListener('mousemove', e => {
  if (!mouseLook || !running) return;
  if (document.pointerLockElement !== canvas) {      // no mouse capture available: the head follows the cursor position
    const dz = v => Math.sign(v) * Math.max(0, Math.abs(v) - 0.04) / 0.96;
    head.my = -dz(e.clientX / innerWidth * 2 - 1) * 1.9; head.mp = -dz(e.clientY / innerHeight * 2 - 1) * 0.6;
    return;
  }
  head.my =clamp(head.my - e.movementX * 0.0024, -2.1, 2.1); head.mp = clamp(head.mp - e.movementY * 0.0024, -0.8, 0.6);
});
for (const b of document.querySelectorAll('.card')) b.addEventListener('click', () => choose(b.dataset.k));
for (const key of ['full', 'short']) {
  drawTrack($('pv_' + key).getContext('2d'), TRACKS[key], 420, 300, '#f2f2f2', 9, TRACKS[key === 'full' ? 'short' : 'full']);
  $('d_' + key).textContent = Math.round(TRACKS[key].L) + ' m · break-out ' + BREAKOUT[key].toFixed(1) + ' s · press ' + (key === 'full' ? 1 : 2);
}

function envKey(code) {
  if (code === 'BracketLeft') ENV.hour = Math.max(8, ENV.hour - 0.25); else if (code === 'BracketRight') ENV.hour = Math.min(19, ENV.hour + 0.25);
  else if (code === 'Minus') ENV.month = (ENV.month + 11) % 12; else if (code === 'Equal') ENV.month = (ENV.month + 1) % 12; else return;
  ENV.manual = true; applySun();
}
MONTHS.forEach((m, i) => { const o = document.createElement('option'); o.value = i; o.textContent = m; $('month').appendChild(o); });
$('month').addEventListener('change', e => { ENV.month = +e.target.value; ENV.manual = true; applySun(); });
$('tod').addEventListener('input', e => { ENV.hour = +e.target.value; ENV.manual = true; applySun(); });
matchClock();
refreshSaves();
buildTrack('full'); resetKart();
Object.assign(R, { started: false, laps: 0, pen: 0, valid: [], offs: 0, flags: 0, bo: 0 });
window.game = { Store, saveGame, loadGame, matchClock, get time() { return time; }, ENV, applySun, sunVector, renderer, scene, camera, sun, S, R, TRACKS, update, choose, setAuto: v => { auto = v; }, setChase: v => { chase = v; }, sunFx, visors, head, kart, get mouseLook() { return mouseLook; }, get track() { return track; } };
requestAnimationFrame(frame);
