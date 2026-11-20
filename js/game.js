'use strict';
/* ---------------------------------------------------------------- game state */
const keys = {};
const S = { x: 0, z: 0, h: 0, v: 0, steer: 0, rpm: RPM_IDLE, thr: 0, brk: 0, slide: 0, lat: 0, onGrass: false, shake: 0, near: { i: 0, d: 0 } };
const R = {};      // race / rules state
const head = { my: 0, mp: 0, ky: 0, kp: 0 };
let running = false, auto = false, time = 0, chase = false, mouseLook = false, sessionActive = false;

function resetKart(idx) {
  const T = track, i = ((idx === undefined ? T.N - 8 : idx) + T.N) % T.N;
  S.x = T.x[i]; S.z = T.z[i]; S.h = Math.atan2(T.tz[i], T.tx[i]); S.v = 0; S.steer = 0; S.slide = 0; S.lat = 0;
}
function startSession(key) {
  if (key) buildTrack(key);
  resetKart(); time = 0;
  Object.assign(R, { started: false, cp: 3, prevS: 0.98, lapStart: 0, laps: 0, last: null, best: null, valid: [], invalid: false,
    wasOff: false, offs: 0, flags: 0, bo: 0, pen: 0, excluded: false, wrong: 0, breakout: BREAKOUT[track.key] });
  $('trk').textContent = track.name + ' · ' + Math.round(track.L) + ' m'; $('bo').textContent = R.breakout.toFixed(1) + ' s';
  head.my = head.mp = 0; running = true; sessionActive = true;
  say('Cross the line to start your first lap', '#fff', 3.5);
}
let msgT = 0;
function say(text, color, secs) { const m = $('msg'); m.textContent = text; m.style.color = color || '#fff'; m.style.opacity = 1; msgT = secs || 2.5; }
const fmt = t => t == null ? '-' : (t >= 60 ? Math.floor(t / 60) + ':' + (t % 60).toFixed(3).padStart(6, '0') : t.toFixed(3));

/* ---------------------------------------------------------------- autopilot (demo + test driver) */
function autopilot(grip) {
  const T = track, i = S.near.i, Ld = 4.5 + S.v * 0.42, j = (i + Math.round(Ld / T.ds)) % T.N;
  const a = angDiff(Math.atan2(T.z[j] - S.z, T.x[j] - S.x), S.h), dist = Math.hypot(T.x[j] - S.x, T.z[j] - S.z);
  const delta = Math.atan(WHEELBASE * 2 * Math.sin(a) / Math.max(dist, 1));
  const dmax = Math.min(0.55, Math.atan(WHEELBASE * grip / Math.max(S.v * S.v, 1)));
  let vt = VMAX;
  for (let m = 0; m < 70; m++) { const k = Math.abs(T.k[(i + m) % T.N]); vt = Math.min(vt, Math.sqrt(0.82 * 14.5 / Math.max(k, 1e-3) + 2 * 8 * m * T.ds)); }
  return { st: clamp(delta / dmax, -1, 1), thr: S.v < vt ? 1 : 0, brk: S.v > vt + 0.8 ? 1 : 0 };
}

/* ---------------------------------------------------------------- physics + rules step */
function update(dt) {
  time += dt;
  ENV.hour = Math.min(23.98, ENV.hour + dt / 3600);          // the day moves on while you race
  const T = track;
  let thr = keys.KeyW ? 1 : 0, brk = keys.KeyS ? 1 : 0, st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const grip = S.onGrass ? 5.5 : 14.5;
  if (auto) { const a = autopilot(grip); thr = a.thr; brk = a.brk; st = a.st; S.steer += clamp(st - S.steer, -9 * dt, 9 * dt); }
  else if (st !== 0) S.steer += clamp(st - S.steer, -3.4 * dt, 3.4 * dt);
  else S.steer -= S.steer * Math.min(1, dt * 1.5);          // keys released: the wheel drifts back to centre rather than snapping
  if (R.excluded) { thr = 0; brk = 1; }

  // steering: bicycle model, lock reduces with speed so full input sits right at the grip limit
  let v = S.v; const av = Math.abs(v);
  const dmax = Math.min(0.55, Math.atan(WHEELBASE * grip / Math.max(av * av, 1)));
  let yaw = v * Math.tan(S.steer * dmax) / WHEELBASE, lat = v * yaw;
  if (Math.abs(lat) > grip) { yaw *= grip / Math.abs(lat); lat = Math.sign(lat) * grip; }
  S.lat = lat; S.slide = clamp((Math.abs(lat) / grip - 0.82) / 0.18, 0, 1) * clamp(av / 6, 0, 1);

  // drive / brake
  let drive = 0, resist = 0.07 * Math.abs(lat);
  if (thr) drive = v < -0.1 ? 8 : 6.2 * (1 - Math.pow(Math.max(v, 0) / VMAX, 2)) * (S.onGrass ? 0.5 : 1);
  if (brk) { if (v > 0.3) resist += S.onGrass ? 5 : 10.5; else if (!thr) drive = -2.5 * (1 + v / 3); }
  if (!thr && !brk) resist += 0.55 + 0.035 * av;
  if (S.onGrass) resist += 1.5 + 0.25 * av;
  v += drive * dt; v = Math.sign(v) * Math.max(0, Math.abs(v) - resist * dt);
  S.v = v; S.thr += clamp(thr - S.thr, -8 * dt, 8 * dt); S.brk = brk;
  S.h += yaw * dt; S.x += Math.cos(S.h) * v * dt; S.z += Math.sin(S.h) * v * dt;

  // where are we on the circuit?
  const near = S.near = nearest(T, S.x, S.z), ci = near.i;
  S.onGrass = near.d > HW + 0.35;
  if (near.d > BARRIER_LIM) {                           // tyre wall
    const nx = (S.x - T.x[ci]) / near.d, nz = (S.z - T.z[ci]) / near.d;
    S.x = T.x[ci] + nx * BARRIER_LIM; S.z = T.z[ci] + nz * BARRIER_LIM;
    const fx = Math.cos(S.h), fz = Math.sin(S.h), fn = fx * nx + fz * nz;
    if (fn * S.v > 0) {
      const imp = Math.abs(fn * S.v);
      S.v *= Math.max(0.15, 1 - Math.abs(fn) * 1.3);
      const tx = fx - fn * nx, tz = fz - fn * nz;
      if (Math.hypot(tx, tz) > 0.05) S.h += angDiff(Math.atan2(tz, tx), S.h) * Math.min(1, dt * 8);
      if (imp > 1.2) { thud(imp); S.shake = Math.min(1, imp / 8); }
    }
  }

  // engine speed: centrifugal clutch slips at ~5600 rpm until the kart catches up
  const wheelRpm = RPM_IDLE * 0.6 + (RPM_MAX - RPM_IDLE * 0.6) * Math.abs(S.v) / VMAX;
  const target = Math.max(wheelRpm, thr ? RPM_CLUTCH : RPM_IDLE);
  S.rpm += clamp(target - S.rpm, -9000 * dt, 14000 * dt);

  // ---- rules
  if (R.excluded) return;
  const s = ci / T.N;
  if (near.d < HW + RUNOFF) {
    if (R.cp < 3 && s > 0.25 * (R.cp + 1) && s < 0.25 * (R.cp + 1) + 0.15) R.cp++;
    if (R.cp >= 3 && R.prevS > 0.85 && s < 0.15) crossLine();
    R.prevS = s;
  }
  const off = near.d > HW + 0.6;
  if (off && !R.wasOff && R.started) {
    R.offs++; R.invalid = true;
    if (R.offs % 3 === 0) {
      R.flags++;
      if (R.flags >= 3) { R.excluded = true; say('RULE 4 · EXCLUDED – 3 black flags.  Press Enter to restart', '#ff6b5e', 1e9); }
      else say('RULE 4 · BLACK FLAG ' + R.flags + '/3 – repeated running off the track', '#ff6b5e', 4);
    } else say('RULE 4 · OFF TRACK – lap void', '#ffcf5a', 2);
  }
  R.wasOff = off;
  const dot = Math.cos(S.h) * T.tx[ci] + Math.sin(S.h) * T.tz[ci];
  R.wrong = (S.v > 3 && dot < -0.4) ? R.wrong + dt : 0;
  if (R.wrong > 1.5) { say('RULE 2 · WRONG WAY – the course runs clockwise', '#ff6b5e', 1); R.wrong = 1; }
}
function crossLine() {
  if (!R.started) { R.started = true; say('GO!', '#3ddc84', 1.5); }
  else {
    const t = time - R.lapStart; R.laps++;
    if (R.invalid) say('LAP ' + fmt(t) + '  –  VOID (Rule 4: off track)', '#ffcf5a', 3.5);
    else {
      const prev = R.last; R.last = t; R.valid.push(t);
      if (R.best == null || t < R.best) R.best = t;
      if (t < R.breakout) {
        R.bo++;
        if (R.bo >= 3) { R.pen++; say('RULE 3 · BREAK-OUT ' + fmt(t) + '  –  1 LAP PENALTY', '#ff6b5e', 4); }
        else say('RULE 3 · BREAK-OUT ' + fmt(t) + '  –  warning ' + R.bo + '/2', '#ffcf5a', 4);
      } else {
        const d = prev == null ? '' : '   (' + (t - prev >= 0 ? '+' : '') + (t - prev).toFixed(3) + ')';
        const q = track.key === 'full' && t < 40 && R.valid.length === 1 ? '   – Enduro qualified' : '';
        say('LAP ' + fmt(t) + d + q, '#fff', 3.5);
      }
    }
  }
  R.lapStart = time; R.cp = 0; R.invalid = false;
  if (typeof autosave === 'function') autosave();
}
