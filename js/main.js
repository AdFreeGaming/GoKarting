'use strict';
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
  Object.assign(R, rec.R, { wrong: 0 }); time = rec.time; $('bo').textContent = R.breakout.toFixed(2) + ' s';
  S.x = rec.kart.x; S.z = rec.kart.z; S.h = rec.kart.h; S.v = 0; S.near = nearest(track, S.x, S.z);
  ENV.month = rec.month; ENV.hour = rec.hour; ENV.manual = true; applySun();
  currentSave = rec.id === 'autosave' ? null : { id: rec.id, label: rec.label };
  setLook(true);
  if (R.excluded) say('RULE 4 \u00b7 EXCLUDED \u2013 3 black flags.  ' + RESTART_TIP, '#ff6b5e', 1e9); else say('Resumed: ' + rec.label, '#3ddc84', 2.5);
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
  if (menu.style.display !== 'none') { envKey(e.code); const pickKey = TRACK_KEYS[['Digit1', 'Digit2', 'Digit3'].indexOf(e.code)]; if (pickKey) choose(pickKey); if (e.code === 'KeyT' || e.code === 'Escape') closeMenu(); return; }
  if (e.code === 'KeyR' && !R.excluded) { resetKart(S.near.i); say('Reset to track', '#fff', 1.2); }
  if (e.code === 'KeyC') head.my = head.mp = 0;
  if (e.code === 'KeyM') { if (e.shiftKey) { openMenu(); return; } AU.muted = !AU.muted; }      // Shift+M: back to the start menu
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
for (const key of TRACK_KEYS) drawTrack($('pv_' + key).getContext('2d'), TRACKS[key], 420, 300, '#f2f2f2', 9, true);
initBreakout(() => { for (const key of TRACK_KEYS) $('d_' + key).textContent = Math.round(TRACKS[key].L) + ' m · break-out ' + breakoutFor(key).toFixed(2) + ' s · press ' + (TRACK_KEYS.indexOf(key) + 1); });

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
