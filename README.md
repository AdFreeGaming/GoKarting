# Kart Enduro

A first-person hire-kart racing game that runs in the browser. You drive a 75 km/h kart around a 540 m circuit in Wollongong, Australia, under the rules of a 4-hour team endurance event: clockwise, consistent laps, no running off the track.

![Aerial view of the circuit](development_assets/Track/Track.png)

## Playing

Open `index.html` in a desktop browser (Chrome, Edge or Firefox). No install or build step is needed. An internet connection is required the first time, because the three.js engine is loaded from a CDN.

Pick one of the two track configurations on the start screen:

| Configuration | Length |
| --- | --- |
| Full Circuit | 540 m |
| Short Circuit | about 423 m |

## Controls

| Key | Action |
| --- | --- |
| `W` | Throttle |
| `S` | Brake (reverse when stopped) |
| `A` / `D` | Steer left / right; the wheel drifts back to centre when released |
| Mouse | Turn the driver's head. Click to release head tracking, click again to resume |
| Arrow keys | Glance left / right / up / down |
| `C` | Re-centre the head |
| `V` | Outside view of the kart |
| `H` | Helmet visor up / down |
| `R` | Reset the kart onto the track |
| `T` or `Shift` + `M` | Pause and go back to the start menu (saves, track, fastest lap time, month and time of day). `T` or `Esc` returns to the race |
| `K` | Quick save |
| `[` / `]` | Time of day earlier / later (15 minutes) |
| `-` / `=` | Previous / next month |
| `M` | Mute |
| `P` | Autopilot demo |
| `Shift` + `Enter` | Restart the session |

## Phones and tablets

Opening `index.html` on an iPhone, iPad or Android device redirects to `index_phone.html`, a touch version of the same game. Hold the device sideways (landscape). On the start menu select a track, set the month, time of day and fastest lap time, then tap **Start with Touch** or **Start with Tilt**.

| Option | Steering | Accelerate / brake | Head |
| --- | --- | --- | --- |
| **Touch** | Pad on the left: drag the knob, or tap the arrows for full lock | Slider on the right: up to accelerate, down to brake | Fixed, looking ahead |
| **Tilt (gyro)** | Turn the device like a steering wheel | Tilt the top away from you to accelerate, towards you to brake | Fixed, looking ahead |

- **Menu** pauses and returns to the start menu, where **Back to race** resumes. **Restart** restarts the session on the same track; tap it twice to confirm.
- In tilt mode, **Centre** resets the neutral position to how you are holding the device. The game also does this about a second after each start.
- Tilt needs the page to be served over `https` (GitHub Pages is fine), and on an iPhone or iPad you must allow motion access when asked. If no sensor data arrives, the game switches to touch controls.
- If accelerate and brake feel the wrong way round in tilt mode, tick **Tilt: swap accelerate and brake** on the start menu.
- Saved sessions are not available in the phone version.
- To use the keyboard version on a tablet, open `index.html?desktop`.

## Event rules

The game follows the rules of the venue's 4-hour enduro. When you break one, the on-screen message shows the rule number.

1. **Event details.** A 4-hour trial of endurance for karts and drivers, run with at least three drivers per kart. The event rewards consistency.
2. **Event format.** The course runs **clockwise**. Each driver does a stint of at least 20 minutes. The winner is the team that completes the most laps with the most consistent lap times. *In the game:* driving the wrong way triggers a Rule 2 warning, and the timing panel shows your lap-time consistency and stint time.
3. **Break-out lap time.** A fastest permitted lap time is nominated for the event. The first and second break-outs earn a warning; from the third, each one costs a 1-lap penalty. There is no penalty for being slower. *In the game:* the break-out time defaults to 32.5 s on the Full Circuit and 26.2 s on the Short Circuit. The **Fastest lap time** slider on the start menu sets your own value from 24 to 40 s.
4. **Driving standards.** No contact between karts, and no running off the track. Repeated offences earn a black flag, and three black flags exclude the driver. *In the game:* leaving the track voids the lap, every third off-track excursion is a black flag, and three black flags end the session.
5. **Trophies** go to 1st, 2nd and 3rd outright.

To enter the real event you must be able to lap in under 40 seconds; the game tells you when your first clean lap on the Full Circuit qualifies.

## Saving your progress

Four hours is a long time to lose, so sessions can be saved in the browser.

- Press `T` to pause, type a label and choose **Save progress**. Saving again under the same label updates that save.
- Press `K` while driving for a quick save to the current slot.
- The game also keeps an **Autosave** of the last completed lap.
- Saved sessions are listed on the menu with **Resume** and **Delete** buttons. Resuming puts the kart back where it was, stationary, with laps, penalties, stint time and time of day restored.

Saves are stored in the browser's IndexedDB on your own machine. They are not uploaded anywhere, and clearing the browser's site data removes them.

## Time of day

The sun is placed for Wollongong (34.43° S, 150.89° E) for the chosen month and time, including daylight saving.

- If you start during daylight hours, the game starts at your computer's clock time and current month. Otherwise it starts at 3:00 pm.
- Time moves on as you play: an hour of driving moves the sun by an hour, so a long session runs through sunset and into floodlit night.
- You can override the month and time on the menu or with the keys above.

## Project layout

| Path | Contents |
| --- | --- |
| `index.html` | Desktop page: markup, HUD and menu |
| `index_phone.html` | Phone and tablet page |
| `css/style.css` | Styles |
| `css/phone.css` | Extra styles for the phone layout and touch pads |
| `js/config.js` | Constants (speed, track width, break-out times) |
| `js/track.js` | Track layouts traced from the aerial images |
| `js/scene.js` | Renderer, lights, procedural textures and materials |
| `js/world.js` | Scenery, sky, sun position, lens flare, floodlights |
| `js/trackmesh.js` | Track surface, kerbs, tyre walls, start line |
| `js/kart.js` | Kart and driver model |
| `js/audio.js` | Synthesised engine, tyre, brake and wind sound |
| `js/game.js` | Physics, lap timing and rules |
| `js/view.js` | Camera, HUD and the frame loop (shared by both pages) |
| `js/storage.js` | Saved sessions (IndexedDB) |
| `js/main.js` | Desktop keyboard and mouse input, menu and saves |
| `js/phone.js` | Phone touch pads, tilt (gyro) controls and menu |
| `development_assets/` | Reference photos, aerial images and the event rules used to build the game; not loaded at runtime |

All textures and sounds are generated in code, so there are no image or audio files to ship.
