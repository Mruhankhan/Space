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
  └─ <canvas id="three-canvas">    ← Three.js renders here, z-index 0
  └─ <div id="root">               ← React UI overlays, z-index 10, pointer-events:none

src/main.jsx                       React entry → App
src/App.jsx                        React state machine mirror; subscribes to game.onUIUpdate
src/game.js                        The authoritative state machine + game loop
src/renderer.js                    Three.js renderer/camera/scene/loop
src/physics.js                     Custom AABB collision (no engine)
src/input.js                       Keyboard / mouse / pointer-lock / gamepad
src/character.js                   Astronaut model + kinematic controller + camera
src/world.js                       buildMenuScene / buildHangarScene / buildFacilityScene
src/rocket.js                      buildRocket(config) — exterior + interior geometry
src/launch.js                      Launch sequence (countdown → flight → result)
src/particles.js                   Three.Points particle systems (engine flare, smoke, sparks)
src/sound.js                       Web Audio synth (no audio files)
src/save.js                        localStorage persistence (profile, rockets, log)
src/ui/                            React components for each screen + HUD
```

### The two state machines

There are **two** state machines that must stay in sync:

1. `game.state` in `src/game.js` — the source of truth. Transitions go through `game.transition(STATES.X, payload)`, which builds / clears scene + physics + audio + UI callbacks.
2. React `screen` state in `src/App.jsx` — a mirror. `game.init()` registers `handleGameUpdate` via `game.onUIUpdate()` and React renders the matching component from `STATES`.

When changing state flow, update **both**: the switch in `src/game.js:88-176` and the render branches in `src/App.jsx:107-157`. There is no codegen or schema linking them — they are coupled by string constants in `STATES` (`src/game.js:14-21`).

### The game loop (`src/game.js:235-272`)

`renderer.startLoop(onTick)` (`src/renderer.js:62-73`) runs `requestAnimationFrame`, computes `delta`, calls `onTick(delta)` then `renderer.render`. Inside `onTick` (`_tick` in `game.js`), an accumulator drains at fixed `FIXED_TICK = 1/90` (`src/game.js:23`). Up to **22 fixed ticks per render frame** are possible at 30 FPS due to `MAX_ACCUMULATOR = 0.25` — this is a known issue documented in the architectural review.

Per fixed tick the order is: state switch → particles.update → physics.step. **Camera update lives inside `Character.update` which is called from `_tickFacility`, so the camera runs at physics tick rate, not render rate** — this is the root cause of camera lag perception.

### Coordinate systems

- **Facility scene world coordinates**: launchpad at origin (0,0,0), rocket at (0, 0.3, 0). Player starts at (8, 2, 8).
- **Rocket interior is local**: when `insideRocket === true`, position is in rocket-local coordinates. The astronaut teleports to deck heights `[3.25, 10.25, 18.25]` (`src/character.js:28`). The rocket exterior is built at world origin; if the rocket ever moves, interior logic must follow.
- **Deck detection**: by `mesh.position.y` thresholds in `getDeckForY` (`src/rocket.js:321-325`).

### Userdata tag conventions

`Object3D.userData` is the backbone of cross-module communication — no scene graph events, no observer pattern.

| Tag | Set in | Read in |
|-----|--------|---------|
| `isRocketShell` | `src/rocket.js:28` | `src/game.js:227` (collision) |
| `ignoreWhenInside` | `src/rocket.js:29` | `src/physics.js:32` (skip shell when inside) |
| `isInteriorFloor` | `src/rocket.js:165,206,250` | `src/game.js:227` (collision) |
| `isConsole` + `consoleId` | `src/rocket.js:217,230` | `src/game.js:48-67` (launch gating), `src/character.js:308-321` (interact) |
| `isCore` | `src/rocket.js:260` | `src/game.js:218-223` (pulse animation) |
| `isWarning` | `src/rocket.js:286` | `src/game.js:219,343-346` (strobe) |
| `isTrigger` + `triggerType` | `src/rocket.js:313-314` | currently unused — dead code |
| `persistent` | `src/renderer.js:46` | `src/renderer.js:83` (clearScene keeps) |
| `orbitEarth` | `src/world.js:112` | `src/game.js:288-294` |

### Physics model

`src/physics.js` is **not** a physics engine. It is a flat array of AABBs with a single-point overlap test. The character moves kinematically (`characterMove` does `position += velocity * dt`, then revert-if-overlap). There is no rotation, no forces, no continuous collision detection, no wall-normal response (so the player snaps instead of slides).

Colliders are registered by traversing the scene in `src/game.js:131-133, 142, 225-231` and pushing into `physics._staticBoxes` (private to `physics.js`). The rocket shell is excluded when the player is inside via `ignoreWhenInside`.

### Asset loading

There are **no external assets**. Every mesh is procedural Three.js primitives in `src/world.js` and `src/rocket.js`. Every sound is synthesized in `src/sound.js` via Web Audio (oscillators + noise + filters). The only network resource is the Google Fonts stylesheet in `index.html:11` (Orbitron + Inter) — bundled into the page at first load.

State persistence uses `localStorage` keys `srbs_profile`, `srbs_rockets`, `srbs_log` (`src/save.js:3-7`).

### Camera

Currently embedded inside `src/character.js:144-264`. It is a third-person follow camera with:
- Mouse delta × 0.005 rad/px sensitivity (`src/character.js:156-157`).
- Lerp-based smoothing at `CAM_SMOOTHING = 10` (`src/character.js:25, 260`) — this is the dominant source of perceived camera lag.
- A pitch formula that is geometrically incorrect (`src/character.js:253-257`) — see the architectural review.

When extracting the camera to its own module (planned refactor), keep this file as the source until extracted — do not write a parallel camera implementation.

### UI broadcasts

`game._uiCallback` (`src/game.js:29`) is invoked with `(state, payload)`. The handler in `src/App.jsx:19-40` **always** calls `setScreen(state)` even when state is unchanged, which triggers a full React reconciliation. The facility position broadcast is throttled to 8 Hz (`src/game.js:321-333`). When fixing this, gate `setScreen` on a ref comparison — do not remove the broadcast entirely, as the deck/console state still needs to flow.

### Pointer lock

`input.requestPointerLock()` is called from `src/game.js:159` when entering FACILITY and from a `pointerdown` handler in `src/input.js:138-142`. While locked, `mousemove` accumulates `e.movementX/Y` into `_mouseDelta`, consumed by `Character.update` once per call. To exit: Escape (browser default) or `input.exitPointerLock()` (`src/game.js:199`).

## Working in this codebase

- **Edit strings as constants, not magic literals.** `STATES` is the canonical state enum (`src/game.js:14`). Rocket templates use string discriminators: `'falcon9' | 'saturnv' | 'custom'` (`src/rocket.js:105`, `src/launch.js:74, 90`).
- **Match factory function style.** Both `src/world.js` and `src/rocket.js` use `function metalMat(color, roughness, metalness)` and similar — call them where materials are needed; do not import a single shared material instance (none exist yet).
- **New screens go in `src/ui/`** and are wired into `src/App.jsx`'s render block. Pass handlers down — do not reach into `game` directly from UI components.
- **New interactive world objects** need: a `userData` tag in their builder, a collision entry (if static) in `src/game.js:225-231`, and a usage site that traverses with `obj.traverse`.
- **Sound effects** are added by extending the switch in `src/sound.js:122-131`. Audio context only unlocks after a user gesture (`sound.resume`).
- **No network calls.** Do not introduce `fetch` or XHR without explicit reason; persistence is `localStorage` only.

## Known perf / feel issues (from prior architectural review)

These are pre-identified and should not be re-investigated unless the task explicitly asks:

- Camera smoothing at `CAM_SMOOTHING = 10` causes persistent lag (`src/character.js:25, 260`).
- Mouse sensitivity 0.005 rad/px is low for the look feel the user wants (`src/character.js:156-157`).
- Pitch geometry formula does not actually pitch the camera (`src/character.js:253-257`).
- Up to 22 fixed ticks per render frame is allowed (`src/game.js:24, 241`).
- `physics.characterMove` does 3 substeps × up-to-22 ticks × per-render-frame = up to ~67 collision tests per player frame (`src/physics.js:50`).
- `clearScene` disposes every non-persistent material on every state transition (`src/renderer.js:80-91`) — first-frame jank after transitions.
- No frustum culling, LOD, instancing, or material caching anywhere in `src/`.
- `App.handleGameUpdate` calls `setScreen` unconditionally (`src/App.jsx:19-40`).
- Mouse delta is cloned every frame via spread (`src/input.js:117-122`).
- Star geometry is rebuilt on every scene transition (`src/world.js:36-50`).
- React components are not memoized; HUD re-renders fully 8 Hz.
- `getRockets()` re-parses localStorage on every call (`src/save.js:52-57`, called from `src/game.js:111` and `src/ui/HangarScreen.jsx:23`).
- Hover SFX on every mouseover (`src/ui/MainMenu.jsx:45`, `src/ui/ProfileScreen.jsx:21`) thrashes Web Audio.
- 4–6 dynamic lights in the facility scene; only one is needed.