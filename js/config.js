'use strict';
if (!window.THREE) { document.getElementById('err').style.display = 'block'; throw new Error('three.js missing'); }
const MOBILE = !!window.KART_MOBILE;      // set by index_phone.html before the scripts load
const RESTART_TIP = MOBILE ? 'Tap Restart' : 'Press Enter to restart';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/* ---------------------------------------------------------------- constants */
const VMAX = 75 / 3.6;          // 75 km/h
const FULL_LENGTH = 540;        // metres (development_assets/Track/Track_length.txt)
const HW = 3.75;                // half track width (m)
const RUNOFF = 3.5;             // grass verge before the tyre wall (m)
const WHEELBASE = 1.05;
const BARRIER_LIM = HW + RUNOFF - 0.9;
const RPM_IDLE = 2200, RPM_CLUTCH = 5600, RPM_MAX = 13500;
const BREAKOUT = { full: 32.5, short: 26.2, long: 34.7 };
const PIT_HW = 3;                         // half width of the pit lane (m)
const PIT_WALL = PIT_HW + 1.2;            // tyre wall offset from the pit lane centre
const PIT_LIM = PIT_WALL - 0.9;           // how far the kart centre can get from the pit lane centre
const PIT_SPEED = 10 / 3.6;               // pit lane speed limit for the enduro, 10 km/h
