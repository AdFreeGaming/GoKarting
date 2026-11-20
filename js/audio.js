'use strict';
/* ---------------------------------------------------------------- audio: 2-stroke engine, brakes, tyres, wind */
const AU = { ctx: null, muted: false };
function initAudio() {
  if (AU.ctx) { AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const C = AU.ctx = new AC(), G = v => { const g = C.createGain(); g.gain.value = v; return g; };
  AU.master = G(0.55); const comp = C.createDynamicsCompressor(); AU.master.connect(comp); comp.connect(C.destination);
  // engine: one firing pulse per rev (2-stroke single) = rpm/60 Hz. saw + sub square + detuned octave, driven hard.
  const osc = (type, g) => { const o = C.createOscillator(); o.type = type; const gg = G(g); o.connect(gg); o.start(); return [o, gg]; };
  const [o1, g1] = osc('sawtooth', 0.55), [o2, g2] = osc('square', 0.3), [o3, g3] = osc('sawtooth', 0.3);
  AU.o = [o1, o2, o3];
  const shaper = C.createWaveShaper(), curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(3.2 * x); }
  shaper.curve = curve;
  AU.peak = C.createBiquadFilter(); AU.peak.type = 'peaking'; AU.peak.Q.value = 2.2; AU.peak.gain.value = 13;   // expansion-chamber "ring"
  AU.lp = C.createBiquadFilter(); AU.lp.type = 'lowpass'; AU.lp.Q.value = 0.8;
  AU.burble = G(1); AU.eng = G(0);
  g1.connect(shaper); g2.connect(shaper); g3.connect(shaper);
  shaper.connect(AU.peak); AU.peak.connect(AU.lp); AU.lp.connect(AU.burble); AU.burble.connect(AU.eng); AU.eng.connect(AU.master);
  AU.lfo = C.createOscillator(); AU.lfo.type = 'square'; AU.lfoG = G(0); AU.lfo.connect(AU.lfoG); AU.lfoG.connect(AU.burble.gain); AU.lfo.start();
  // shared noise source
  const buf = C.createBuffer(1, C.sampleRate * 2, C.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  AU.noiseBuf = buf;
  const noise = C.createBufferSource(); noise.buffer = buf; noise.loop = true; noise.start();
  const branch = (type, f, q, out) => { const b = C.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; const g = G(0); noise.connect(b); b.connect(g); g.connect(out || AU.master); return [b, g]; };
  [AU.raspF, AU.rasp] = branch('bandpass', 1500, 1.2);     // exhaust rasp
  [AU.sqF, AU.squeal] = branch('bandpass', 1750, 16);      // tyre squeal
  [, AU.brake] = branch('bandpass', 620, 0.9);             // brake / tyre scrub
  [, AU.wind] = branch('lowpass', 420, 0.5);               // wind past the helmet
}
function audioUpdate(dt) {
  const C = AU.ctx; if (!C) return;
  const t = C.currentTime, set = (p, v, tc) => p.setTargetAtTime(v, t, tc || 0.04);
  const f = S.rpm / 60, rf = (S.rpm - RPM_IDLE) / (RPM_MAX - RPM_IDLE), thr = S.thr, sp = Math.abs(S.v);
  set(AU.o[0].frequency, f); set(AU.o[1].frequency, f * 0.5); set(AU.o[2].frequency, f * 2.012);
  set(AU.peak.frequency, 500 + f * 5.5); set(AU.lp.frequency, 500 + rf * 2600 + thr * 2800, 0.06);
  set(AU.eng.gain, running ? 0.16 + 0.1 * rf + 0.5 * thr : 0, 0.06);
  // off-throttle a 2-stroke "four-strokes": irregular misfire burble
  const depth = (1 - thr) * (0.22 + 0.2 * (1 - rf));
  set(AU.burble.gain, 1 - depth, 0.03); set(AU.lfoG.gain, depth, 0.03);
  AU.lfo.frequency.setValueAtTime(clamp(f / (3 + Math.random() * 3), 4, 60), t);
  set(AU.raspF.frequency, 700 + f * 9); set(AU.rasp.gain, running ? thr * (0.05 + 0.1 * rf) : 0);
  set(AU.sqF.frequency, 1500 + S.slide * 500 + sp * 12); set(AU.squeal.gain, S.onGrass ? 0 : S.slide * clamp(sp / 8, 0, 1) * 0.55, 0.05);
  set(AU.brake.gain, S.brk * clamp(sp / 9, 0, 1) * (S.onGrass ? 0.5 : 0.3) + (S.onGrass ? clamp(sp / 8, 0, 1) * 0.35 : 0), 0.05);
  set(AU.wind.gain, Math.pow(sp / VMAX, 2) * 0.5, 0.1);
  set(AU.master.gain, AU.muted ? 0 : 0.55, 0.05);
}
function thud(strength) {
  const C = AU.ctx; if (!C) return;
  const t = C.currentTime, src = C.createBufferSource(), lp = C.createBiquadFilter(), g = C.createGain();
  src.buffer = AU.noiseBuf; lp.type = 'lowpass'; lp.frequency.value = 260;
  g.gain.setValueAtTime(clamp(strength / 8, 0.2, 1) * 1.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  src.connect(lp); lp.connect(g); g.connect(AU.master); src.start(t, Math.random()); src.stop(t + 0.32);
}
