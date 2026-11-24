'use strict';
/* ------------------------------------------- track layouts (traced from the aerial images, pixels) */
const IMG_C = [425, 420];
const COMMON_A = [[420,256],[500,247],[560,240],[600,236]];
const RETURN_B = [[520,510],[480,548],[440,595],[400,640],[350,690],[300,735],[250,772],[210,790],[180,785],
  [163,755],[165,705],[182,640],[215,572],[265,515],[305,462],[320,410],[308,360],[275,328],[250,310],
  [234,286],[246,265],[300,257],[360,258]];
const LAYOUTS = {
  full:  { name: 'Full Circuit',  mid: [[612,230],[628,212],[632,188],[625,160],[610,132],[590,100],[578,65],[590,38],
            [625,28],[665,45],[700,80],[740,125],[775,175],[798,225],[797,265],[775,295],[735,322],[690,352],
            [640,395],[600,430],[560,470]] },
  short: { name: 'Short Circuit', mid: [[640,236],[672,248],[690,272],[686,298],[662,312],[625,316],[600,333],
            [593,362],[597,388],[598,412],[580,445],[550,478]] },
  // development_assets/Track/Track_config3.png: the full circuit's top loop, returning through the short circuit's infield esses
  long:  { name: 'Long Circuit',  mid: [[612,230],[628,212],[632,188],[625,160],[610,132],[590,100],[578,65],[590,38],
            [625,28],[665,45],[700,80],[740,125],[775,175],[798,225],[797,265],[778,290],[745,304],[705,310],[662,312],
            [625,316],[600,333],[593,362],[597,388],[598,412],[580,445],[550,478]] }
};
// pit lane (the green strip in Track_config3.png): leaves the track on the left before the last infield section and rejoins before the line
const PIT_PX = [[165,742],[156,712],[146,680],[139,650],[140,615],[148,580],[152,555],[156,525],[160,490],[166,450],[172,410],[178,370],
  [184,345],[198,316],[218,294],[244,268]];

function rawPath(px) {
  const curve = new THREE.CatmullRomCurve3(px.map(p => new THREE.Vector3(p[0] - IMG_C[0], 0, p[1] - IMG_C[1])), true, 'centripetal');
  let pts = curve.getSpacedPoints(700); pts.pop();
  for (let it = 0; it < 8; it++) {
    const n = pts.length;
    pts = pts.map((p, i) => { const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      return new THREE.Vector3((a.x + 2 * p.x + b.x) / 4, 0, (a.z + 2 * p.z + b.z) / 4); });
  }
  return pts;
}
function pathLen(pts) { let L = 0; for (let i = 0; i < pts.length; i++) L += pts[i].distanceTo(pts[(i + 1) % pts.length]); return L; }
function finalize(pts, k) {
  const n = pts.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + pts[i].distanceTo(pts[(i + 1) % n]) * k);
  const L = cum[n], N = Math.round(L), ds = L / N;
  const T = { N, L, ds, x: new Float32Array(N), z: new Float32Array(N), tx: new Float32Array(N), tz: new Float32Array(N), k: new Float32Array(N) };
  let seg = 0;
  for (let j = 0; j < N; j++) {
    const s = j * ds; while (cum[seg + 1] < s) seg++;
    const f = (s - cum[seg]) / (cum[seg + 1] - cum[seg]), a = pts[seg], b = pts[(seg + 1) % n];
    T.x[j] = (a.x + (b.x - a.x) * f) * k; T.z[j] = (a.z + (b.z - a.z) * f) * k;
  }
  for (let j = 0; j < N; j++) {
    const a = (j + N - 1) % N, b = (j + 1) % N, dx = T.x[b] - T.x[a], dz = T.z[b] - T.z[a], l = Math.hypot(dx, dz);
    T.tx[j] = dx / l; T.tz[j] = dz / l;
  }
  for (let j = 0; j < N; j++) {              // signed curvature, + = right-hand turn
    const a = (j + N - 2) % N, b = (j + 2) % N;
    T.k[j] = Math.asin(clamp(T.tx[a] * T.tz[b] - T.tz[a] * T.tx[b], -1, 1)) / (4 * ds);
  }
  return T;
}
const TRACKS = {};
{
  const raw = {}; for (const key in LAYOUTS) raw[key] = rawPath(COMMON_A.concat(LAYOUTS[key].mid, RETURN_B));
  const K = FULL_LENGTH / pathLen(raw.full);          // metres per image pixel
  for (const key in LAYOUTS) { TRACKS[key] = finalize(raw[key], K); TRACKS[key].key = key; TRACKS[key].name = LAYOUTS[key].name; }
  TRACKS.scale = K;
}
// open path sampled about every metre, in the same form as a track (x, z, tangents) so nearest() and ribbon() work on it
function openPath(px, k) {
  const curve = new THREE.CatmullRomCurve3(px.map(p => new THREE.Vector3((p[0] - IMG_C[0]) * k, 0, (p[1] - IMG_C[1]) * k)), false, 'centripetal');
  const L = curve.getLength(), n = Math.round(L), pts = curve.getSpacedPoints(n), N = n + 1;
  const P = { N, L, ds: L / n, x: new Float32Array(N), z: new Float32Array(N), tx: new Float32Array(N), tz: new Float32Array(N) };
  for (let i = 0; i < N; i++) { P.x[i] = pts[i].x; P.z[i] = pts[i].z; }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1), dx = P.x[b] - P.x[a], dz = P.z[b] - P.z[a], l = Math.hypot(dx, dz); P.tx[i] = dx / l; P.tz[i] = dz / l; }
  return P;
}
const PIT = openPath(PIT_PX, TRACKS.scale);
const px2w = (px, py) => [(px - IMG_C[0]) * TRACKS.scale, (py - IMG_C[1]) * TRACKS.scale];

function nearest(T, x, z) {
  let bi = 0, bd = 1e12;
  for (let i = 0; i < T.N; i++) { const dx = T.x[i] - x, dz = T.z[i] - z, d = dx * dx + dz * dz; if (d < bd) { bd = d; bi = i; } }
  return { i: bi, d: Math.sqrt(bd) };
}
const TRACK_KEYS = Object.keys(LAYOUTS);
// clearance from any layout or the pit lane (the pit lane is narrower, so it is padded to compare like a track)
const trackDist = (x, z) => Math.min(nearest(PIT, x, z).d + (HW + RUNOFF - PIT_WALL), ...TRACK_KEYS.map(k => nearest(TRACKS[k], x, z).d));
