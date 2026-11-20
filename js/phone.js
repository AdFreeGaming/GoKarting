'use strict';
/* ---------------------------------------------------------------- phone / tablet front end (index_phone.html)
   Two control options, chosen on the start menu:
     touch – steering pad on the left, accelerate / brake slider on the right, no head movement
     tilt  – gyro: roll steers, pitch accelerates and brakes, yaw turns the driver's head left / right
   Physics, rules, scenery and the render loop are shared with the desktop game; saved sessions are not offered here. */
const menu = $('menu'), MODE_KEY = 'kart-enduro-controls', NEUTRAL = 0.62;      // NEUTRAL: rest position of the pedal slider (fraction from the top)
INPUT = { thr: 0, brk: 0, st: 0 };
let mode = 'touch';
try { if (localStorage.getItem(MODE_KEY) === 'tilt') mode = 'tilt'; } catch (e) {}
function setMode(m) {
  mode = m; document.body.className = m; mouseLook = m === 'tilt';      // mouseLook keeps the head where the gyro puts it
  for (const b of document.querySelectorAll('.mode')) b.classList.toggle('on', b.dataset.m === m);
  INPUT.thr = INPUT.brk = INPUT.st = 0; head.my = head.mp = 0;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
}

/* ---------------------------------------------------------------- option 1: touch pads */
function pad(el, onMove) {
  let id = null;
  const move = e => { if (e.pointerId !== id) return; const b = el.getBoundingClientRect(); onMove(e.clientX - b.left, e.clientY - b.top, b.width, b.height); e.preventDefault(); };
  const up = e => { if (e.pointerId !== id) return; id = null; onMove(null); };
  el.addEventListener('pointerdown', e => { if (id !== null || mode !== 'touch') return; id = e.pointerId; try { el.setPointerCapture(id); } catch (x) {} move(e); });
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
const KNOB = 31;      // knob radius plus margin (px)
pad($('steer'), (x, y, w) => { INPUT.st = x === null ? 0 : clamp((x - w / 2) / (w / 2 - KNOB), -1, 1); });
pad($('pedal'), (x, y, w, h) => {
  if (x === null) { INPUT.thr = INPUT.brk = 0; return; }
  const n = h * NEUTRAL;
  INPUT.thr = clamp((n - y - 6) / (n - KNOB - 6), 0, 1); INPUT.brk = clamp((y - n - 6) / (h - n - KNOB - 6), 0, 1);
});

/* ---------------------------------------------------------------- option 2: tilt (gyro)
   The device attitude is rebuilt as a rotation matrix (W3C deviceorientation: R = Rz(alpha) Rx(beta) Ry(gamma), earth frame
   X east, Y north, Z up) and read along the screen's own axes, so it works in either landscape direction and in portrait:
     roll  = how far the screen's right edge is above the horizon          -> steering
     pitch = how far the screen leans back from vertical, vs. calibration  -> accelerate / brake
     yaw   = compass heading of the direction the screen faces away from   -> head left / right */
const tilt = { ok: false, roll: 0, pitch: 0, yaw: 0, p0: null, y0: 0, calAt: 0, since: 0, listening: false };
const screenAngle = () => (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
function onOrient(e) {
  if (e.beta == null || e.gamma == null) return;
  const d = Math.PI / 180, a = (e.alpha || 0) * d, b = e.beta * d, g = e.gamma * d;
  const cA = Math.cos(a), sA = Math.sin(a), cB = Math.cos(b), sB = Math.sin(b), cG = Math.cos(g), sG = Math.sin(g);
  const X = [cA * cG - sA * sB * sG, cG * sA + cA * sB * sG, -cB * sG];      // device axes in earth coordinates
  const Y = [-cB * sA, cA * cB, sB], N = [cG * sA * sB + cA * sG, sA * sG - cA * cG * sB, cB * cG];
  const th = screenAngle() * d, c = Math.cos(th), s = Math.sin(th);
  const r = [c * X[0] - s * Y[0], c * X[1] - s * Y[1], c * X[2] - s * Y[2]];      // screen right
  const uz = s * X[2] + c * Y[2];                                                  // screen up (height only)
  tilt.roll = Math.asin(clamp(r[2], -1, 1));
  tilt.pitch = Math.atan2(N[2], uz);
  // heading: use the screen normal while the device is fairly upright, the screen's right edge when it lies flat
  const w = clamp((Math.hypot(N[0], N[1]) - 0.2) / 0.3, 0, 1);
  tilt.yaw = Math.atan2(-N[1] * w + r[0] * (1 - w), -N[0] * w - r[1] * (1 - w));
  tilt.ok = true;
}
// iOS asks the player for motion access, and only from a tap; sensors also need https (or localhost)
function askMotion() {
  const D = window.DeviceOrientationEvent;
  if (!D) return Promise.resolve(false);
  const listen = () => { if (!tilt.listening) { addEventListener('deviceorientation', onOrient); tilt.listening = true; } return true; };
  if (typeof D.requestPermission === 'function') return D.requestPermission().then(r => r === 'granted' && listen(), () => false);
  return Promise.resolve(listen());
}
function calibrate(delay) { tilt.p0 = null; tilt.calAt = performance.now() + (delay || 0); tilt.since = performance.now(); }
const dead = (v, d) => Math.sign(v) * Math.max(0, Math.abs(v) - d);
function tiltInput(dt) {
  const now = performance.now();
  if (!tilt.ok) {                                             // no sensor data (no gyro, or the page is not served over https)
    if (now - tilt.since > 2500) { setMode('touch'); say('No motion sensor data – switched to touch controls', '#ffcf5a', 4); }
    return;
  }
  if (tilt.p0 === null) {                                     // neutral position = how the device is held a moment after starting
    INPUT.thr = INPUT.brk = INPUT.st = 0;
    if (now < tilt.calAt) return;
    tilt.p0 = tilt.pitch; tilt.y0 = tilt.yaw; say('Tilt forward to go, back to brake', '#fff', 2.5);
  }
  const p = angDiff(tilt.pitch, tilt.p0);
  INPUT.st = clamp(-dead(tilt.roll, 0.03) / 0.5, -1, 1);       // full lock at about 30 degrees
  INPUT.thr = clamp(dead(p, 0.07) / 0.3, 0, 1); INPUT.brk = clamp(dead(-p, 0.07) / 0.25, 0, 1);
  const look = clamp(dead(angDiff(tilt.yaw, tilt.y0), 0.04) * 1.8, -1.7, 1.7);      // amplified so the screen stays in view
  head.my += (look - head.my) * Math.min(1, dt * 10); head.mp = 0;
}

/* ---------------------------------------------------------------- per-frame hook: read the controls, move the pad knobs */
const steerEl = $('steer'), pedalEl = $('pedal'), steerKnob = steerEl.querySelector('.knob'), pedalKnob = pedalEl.querySelector('.knob');
preFrame = dt => {
  if (!running) { if (mode === 'tilt') INPUT.thr = INPUT.brk = INPUT.st = 0; }
  else if (mode === 'tilt') tiltInput(dt);
  const w = steerEl.clientWidth, h = pedalEl.clientHeight, n = h * NEUTRAL;
  steerKnob.style.transform = 'translateX(' + (INPUT.st * (w / 2 - KNOB)).toFixed(1) + 'px)';
  pedalKnob.style.transform = 'translateY(' + (INPUT.brk * (h - n - KNOB) - INPUT.thr * (n - KNOB)).toFixed(1) + 'px)';
};

/* ---------------------------------------------------------------- menu, restart, housekeeping */
let wakeLock = null;
function keepAwake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { wakeLock = l; }, () => {}); } catch (e) {} }
function goFullscreen() {                                     // Android only: iPhones have no page fullscreen
  if (!/Android/i.test(navigator.userAgent)) return;
  try {
    const el = document.documentElement, p = el.requestFullscreen && !document.fullscreenElement ? el.requestFullscreen() : null;
    const lock = () => { try { const q = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (q && q.catch) q.catch(() => {}); } catch (e) {} };
    if (p && p.then) p.then(lock, () => {}); else lock();
  } catch (e) {}
}
function openMenu() {
  running = false; menu.style.display = 'flex'; INPUT.thr = INPUT.brk = INPUT.st = 0;
  $('resumebtn').style.display = sessionActive ? 'block' : 'none';
}
function begin() { menu.style.display = 'none'; goFullscreen(); keepAwake(); if (mode === 'tilt') calibrate(900); }
function closeMenu() {
  if (!sessionActive) return;
  const go = ok => { if (!ok) setMode('touch'); begin(); running = true; };
  if (mode === 'tilt') askMotion().then(go); else go(true);      // the mode may have been changed while paused
}
function choose(key) {
  initAudio();
  const go = ok => {
    const denied = mode === 'tilt' && !ok; if (denied) setMode('touch');
    if (!ENV.manual) matchClock();
    begin(); startSession(key);
    if (denied) say('Motion sensors unavailable – using touch controls', '#ffcf5a', 4);
    else if (mode === 'tilt') say('Hold the device how you want to drive…', '#fff', 1.5);
  };
  if (mode === 'tilt') askMotion().then(go); else go(true);
}
for (const b of document.querySelectorAll('.mode')) b.addEventListener('click', () => setMode(b.dataset.m));
for (const b of document.querySelectorAll('.card')) b.addEventListener('click', () => choose(b.dataset.k));
$('resumebtn').addEventListener('click', closeMenu);
$('b_menu').addEventListener('click', openMenu);
$('b_centre').addEventListener('click', () => { calibrate(0); head.my = 0; });
// Restart wipes the session, so it takes a second tap to confirm (unless the driver has been excluded)
let armT = 0;
$('b_restart').addEventListener('click', e => {
  const b = e.currentTarget;
  const disarm = () => { clearTimeout(armT); b.classList.remove('arm'); b.textContent = '↻ Restart'; };
  if (b.classList.contains('arm') || R.excluded) { disarm(); startSession(); if (mode === 'tilt') calibrate(900); }
  else { b.classList.add('arm'); b.textContent = 'Tap again'; armT = setTimeout(disarm, 2500); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (running) openMenu(); } else if (running) keepAwake(); });
const portrait = window.matchMedia('(orientation: portrait)');
const onTurn = () => { if (portrait.matches && running) openMenu(); };
if (portrait.addEventListener) portrait.addEventListener('change', onTurn); else if (portrait.addListener) portrait.addListener(onTurn);
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());      // iOS pinch zoom

for (const key of ['full', 'short']) {
  drawTrack($('pv_' + key).getContext('2d'), TRACKS[key], 420, 300, '#f2f2f2', 9, TRACKS[key === 'full' ? 'short' : 'full']);
  $('d_' + key).textContent = Math.round(TRACKS[key].L) + ' m · break-out ' + BREAKOUT[key].toFixed(1) + ' s';
}
MONTHS.forEach((m, i) => { const o = document.createElement('option'); o.value = i; o.textContent = m; $('month').appendChild(o); });
$('month').addEventListener('change', e => { ENV.month = +e.target.value; ENV.manual = true; applySun(); });
$('tod').addEventListener('input', e => { ENV.hour = +e.target.value; ENV.manual = true; applySun(); });
setMode(mode);
matchClock();
buildTrack('full'); resetKart();
Object.assign(R, { started: false, laps: 0, pen: 0, valid: [], offs: 0, flags: 0, bo: 0 });
window.game = { INPUT, tilt, onOrient, setMode, get mode() { return mode; }, get running() { return running; }, get time() { return time; }, ENV, S, R, head, TRACKS, update, choose, openMenu, closeMenu, setAuto: v => { auto = v; } };
requestAnimationFrame(frame);
