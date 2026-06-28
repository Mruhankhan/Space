# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A browser-based 3D rocket builder / test-facility walking sim. Stack is **React 18 + Three.js (r167) + Vite**, no physics library, no networking. The user flow is `PROFILE → MAIN_MENU → HANGAR → FACILITY → LAUNCH`. This is **not** a competitive shooter — do not propose shooter-style architecture (weapons, prediction, lag comp, viewmodels). It is a single-player walking sim in the spirit of *Tacoma* / *Observation*; design pressure should match that.

## Commands

```bash
npm install        # install deps (react, react-dom, three; dev: vite, @vitejs/plugin-react, playwright-core)
npm run dev        # Vite dev server (HMR)
npm run build      # production build → dist/
npm run preview    # serve dist/ locally
```

There is **no test runner configured** (no vitest, jest, playwright script in `package.json`). `playwright-core` is installed as a dev dep but unused. Do not invent test commands. If tests are required, propose adding a runner rather than assuming one exists.

There is **no linter, no formatter, no type checker**. JS is plain `.js`, JSX is plain `.jsx`. Match the existing style (4-space indent in `src/`, 2-space in `src/ui/`, single quotes, no semicolons in JSX, semicolons in JS — verify by reading the file before editing).

## Big-picture architecture

### Module boundaries

```
index.html
  ├─ <div id="loading-screen">       CSS-only spinner, removed once React mounts
  ├─ <canvas id="three-canvas">      ← Three.js renders here, z-index 0
  └─ <div id="root">                 ← React UI overlays, z-index 10, pointer-events:none

src/main.jsx                       React entry → App
src/App.jsx                        React state machine mirror; subscribes to game.onUIUpdate
src/game.js                        The authoritative state machine + game loop
src/renderer.js                    Three.js renderer/camera/scene/loop
src/physics.js                     Custom AABB + sphere-sweep collision (no engine)
src/input.js                       Keyboard / mouse / pointer-lock / gamepad
src/character.js                   Astronaut capsule controller + instant third-person camera
src/world.js                       buildMenuScene / buildHangarScene / buildFacilityScene
src/rocket.js                      buildRocket(config) — exterior + interior geometry
src/launch.js                      Launch sequence (countdown → flight → result)
src/particles.js                   Three.Points particle systems (engine flare, smoke, sparks)
src/sound.js                       Web Audio synth (no audio files) + scene-based ambient
src/save.js                        localStorage persistence (profile, rockets, log)
src/ui/                            React components for each screen + HUD
```

### The two state machines

There are **two** state machines that must stay in sync:

1. `game.state` in `src/game.js` — the source of truth. Transitions go through `game.transition(STATES.X, payload)` (`src/game.js:79-171`), which builds / clears scene + physics + audio + UI callbacks and broadcasts the new state.
2. React `screen` state in `src/App.jsx` — a mirror. `game.init()` registers `handleGameUpdate` via `game.onUIUpdate()` (`src/App.jsx:38-82`), and React renders the matching component from `STATES`.

`App.handleGameUpdate` is **guarded** by `lastScreenRef` (`src/App.jsx:33, 38-42`) so it only calls `setScreen` on actual state transitions, not every tick. Facility and launch payload diffs (`src/App.jsx:43-81`) compare each field before cloning the state object, so React only re-renders when something visible actually changes.

When changing state flow, update **both**: the switch in `src/game.js:79-171` and the render branches in `src/App.jsx:142-191`. There is no codegen or schema linking them — they are coupled by string constants in `STATES` (`src/game.js:17-24`).

### The game loop (`src/game.js:198-221`, `src/renderer.js:111-129`)

`renderer.startLoop(onTick)` runs `requestAnimationFrame`, computes `delta` (clamped to 0.1s), calls `onTick(delta, time)` then `renderer.render`. Inside `onTick` (`_frame` in `game.js`):

1. `input.update()` (`src/game.js:204`) — polls gamepad.
2. State dispatch (`src/game.js:206-220`):
   - `PROFILE | MAIN_MENU | HANGAR` → `_tickCinematic(delta)` — animations + scripted camera, no physics.
   - `FACILITY` → `_tickFacility(delta)` — character update + physics + HUD broadcast.
   - `LAUNCH` → `_tickLaunch(delta)` — countdown + flight.

**There is no fixed-tick accumulator.** `_tickFacility` runs once per render frame with the actual `delta`. Physics is frame-time, not fixed-step. Camera update (`_character.applyCamera`) is called *before* movement inside `_tickFacility` (`src/game.js:257-258`), so it is frame-aligned with mouse delta.

### Coordinate systems

- **Facility scene world coordinates**: launchpad at origin (0,0,0), rocket at (0, 0.3, 0). Player starts at (8, 1, 8) (`src/game.js:139`).
- **Rocket interior is local**: when `insideRocket === true`, position is in rocket-local coordinates. The astronaut teleports to deck heights `DECK_HEIGHTS = [3.25, 10.25, 18.25]` (`src/character.js:38`). The rocket exterior is built at world origin; if the rocket ever moves, interior logic must follow.
- **Deck detection**: by `mesh.position.y` thresholds in `getDeckForY` (`src/rocket.js:384`).
- **Camera**: `rotation.order = 'YXZ'` (`src/renderer.js:57`, `src/character.js:338`) — yaw applied first, then pitch directly via `camera.rotation.x`.

### Userdata tag conventions

`Object3D.userData` is the backbone of cross-module communication — no scene graph events, no observer pattern. There is also a small `Character.on(name, fn)` event bus (`src/character.js:157-171`) used for `'deck'` and `'console'` events (`src/game.js:140-145`).

| Tag | Purpose | Read in |
|-----|---------|---------|
| `isRocketShell` | Exterior rocket geometry collider | collision in `src/character.js` via `physics` |
| `ignoreWhenInside` | Skip when player is inside rocket | sphere sweeps in `src/physics.js` |
| `isInteriorFloor` | Walkable floor inside rocket | same |
| `isConsole` + `consoleId` | Launch-gating interactable | `src/game.js:143-145, 310-340` + `Character._tryActivateConsole` |
| `isCore` | Animated emissive core | `src/game.js:297-307` (pulse + rotate) |
| `isWarning` | Strobe light | `src/game.js:298, 304` + `_tickLaunch` strobe |
| `isTrigger` + `triggerType` | (dead code — unused) | — |
| `persistent` | Survives `clearScene` | `src/renderer.js` PERSISTENT set |
| `orbitEarth` | Animates with menu earth | `src/game.js` cinematic |

### Physics model

`src/physics.js` is **not** a physics engine. It is a flat array of AABBs registered via `physics.addStatic(mesh, {tag})` plus a **capsule sphere-sweep** character controller (`characterMove`, `src/physics.js:78`). The capsule does:

- Independent X / Z / Y slide sweeps against all static AABBs (`_sphereSlideAxis`).
- A slope-step retry on horizontal slide failure (`_tryStepUp`).
- A ground probe (`_groundProbe`) for snap-to-floor after falls.
- `ignoreWhenInside` is honored for all sweeps so the rocket shell does not trap the player.

There is still **no rotation, no continuous CCD for non-capsule objects, and no wall-normal response** (sliding on each axis independently is the sliding response). The character moves kinematically and is gravity-affected (`GRAVITY = -22.0`, `src/character.js:26`).

Colliders are registered during the FACILITY transition by traversing `this._sceneData.floors / .boxes` plus the rocket tree (`src/game.js:122-135, 353`).

### Asset loading

There are **no external assets**. Every mesh is procedural Three.js primitives in `src/world.js` and `src/rocket.js`. Every sound is synthesized in `src/sound.js` via Web Audio (oscillators + noise + filters). The only network resource is the Google Fonts stylesheet in `index.html:11` (Orbitron + Inter) — bundled into the page at first load. The favicon is an inline SVG (`index.html:8`).

State persistence uses `localStorage` keys `srbs_profile`, `srbs_rockets`, `srbs_log` (`src/save.js:3-7`). `getRockets()` re-parses localStorage on every call (no cache); same for `getLog()`.

### Camera

Lives in `src/character.js:308-341`. Third-person follow camera:

- **Instant**: no lerp. `applyCamera` is called before `update` in `_tickFacility` so it is frame-aligned with mouse delta.
- Mouse delta × `MOUSE_SENS = 0.0024` rad/px (`src/character.js:31`); gamepad `PAD_SENS = 0.045` rad/s.
- Yaw stored in `this._yaw` and applied via `camera.rotation.y`. Pitch stored in `this._pitch`, clamped to `[MIN_PITCH=-1.30, MAX_PITCH=1.30]` (`src/character.js:35-36`), applied via `camera.rotation.x` with `rotation.order = 'YXZ'`.
- `lookAt` is computed in `applyCamera` (`src/character.js:328-340`) for the look-vector math; then the rotation is overridden so both yaw and pitch work correctly.

When extracting the camera to its own module, keep `character.js` as the source until extracted — do not write a parallel camera implementation.

### UI broadcasts

`game._uiCallback` (`src/game.js`) is invoked with `(state, payload)`. The handler in `src/App.jsx:38-82`:

- Gates `setScreen` on `lastScreenRef.current !== state`.
- For `FACILITY`, diffs `position`, `deckName`, `insideRocket`, `launchReady`, `consoleProgress` before cloning state.
- For `LAUNCH`, diffs `countdown`, `launchStatus`, `result`.

The facility position broadcast is throttled to **6 Hz** (`HUD_POSITION_HZ = 6`, `src/game.js:27-28`).

### Pointer lock

`input.requestPointerLock()` is called from `src/game.js:149` when entering FACILITY and from a `pointerdown` handler in `src/input.js:118-124`. While locked, `mousemove` accumulates `e.movementX/Y` into `_mouseDelta` (`src/input.js:11, 88-89`), consumed once per frame by `Character.update` via `consumeMouseDelta()` (returns a shared buffer, no per-frame allocation). To exit: Escape (browser default) or `input.exitPointerLock()` (`src/game.js:191`).

### Input enable/disable

`input.enable()` and `input.disable()` gate keyboard, mouse, gamepad polling. UI screens call `input.disable()`; the FACILITY scene calls `input.enable()` (`src/game.js:84, 96, 109, 147, 161`). When adding new screens, gate input the same way.

### Sound

`sound.setAmbient(scene)` picks a looping ambient track (`'menu' | 'hangar' | 'facility'`) called from each transition case (`src/game.js:85, 96, 110, 148`). One-shots are added by extending the switch in `src/sound.js`. Audio context only unlocks after a user gesture — `sound.resume()` is called from UI click handlers (`src/ui/MainMenu.jsx:44`, `src/ui/ProfileScreen.jsx:28`).

## Working in this codebase

- **Edit strings as constants, not magic literals.** `STATES` is the canonical state enum (`src/game.js:17`). Rocket templates use string discriminators: `'falcon9' | 'saturnv' | 'custom'` (`src/rocket.js`, `src/launch.js`).
- **Match factory function style.** Both `src/world.js` and `src/rocket.js` use `function metalMat(color, roughness, metalness)` and similar — call them where materials are needed. Procedural astronaut materials are cached in `getAstronautMaterials` (`src/character.js:41-52`) and shared — do not duplicate.
- **Starfield is cached** in `getStars()` (`src/world.js:60-77`); do not rebuild it per scene transition.
- **New screens go in `src/ui/`** and are wired into `src/App.jsx`'s render block. Pass handlers down — do not reach into `game` directly from UI components.
- **New interactive world objects** need: a `userData` tag in their builder, a collision entry (if static) added in the FACILITY transition, and a usage site that traverses with `obj.traverse`.
- **Sound effects** are added by extending the switch in `src/sound.js`. Audio context only unlocks after a user gesture (`sound.resume`).
- **No network calls.** Do not introduce `fetch` or XHR without explicit reason; persistence is `localStorage` only.

## Known perf / feel issues (from prior architectural review)

These are pre-identified and should not be re-investigated unless the task explicitly asks. Items that have already been resolved are noted as such.

- ~~Camera smoothing at `CAM_SMOOTHING = 10`~~ — **resolved**, camera is now instant.
- ~~Mouse sensitivity 0.005 rad/px~~ — **resolved**, now `0.0024` (`src/character.js:31`).
- ~~Pitch geometry formula does not actually pitch the camera~~ — **resolved**, uses `rotation.order = 'YXZ'` with `camera.rotation.x = this._pitch`.
- ~~Up to 22 fixed ticks per render frame~~ — **resolved**, there is no fixed-tick accumulator; `_tickFacility` runs once per render frame with real delta.
- ~~Mouse delta is cloned every frame via spread~~ — **resolved**, `consumeMouseDelta` returns a shared buffer.
- ~~Star geometry is rebuilt on every scene transition~~ — **resolved**, `getStars()` caches the geometry.
- ~~`App.handleGameUpdate` calls `setScreen` unconditionally~~ — **resolved**, guarded by `lastScreenRef`.
- HUD `consoleProgress` text is built by string-concat every tick — re-create strings only when count changes.
- `getRockets()` re-parses localStorage on every call (`src/save.js:52-57`, called from `src/game.js:104, 130` and `src/ui/HangarScreen.jsx`). Cache it.
- Hover SFX on every mouseover (`src/ui/MainMenu.jsx:45`, `src/ui/ProfileScreen.jsx:21`) thrashes Web Audio.
- `renderer.setPixelRatio` is capped at 1.5 (`src/renderer.js:67`) — verify on hi-DPI displays if sharpness matters.
- Per-frame `Object3D.traverse` in `clearScene` / `disposeObject` walks the entire scene tree on every state transition.