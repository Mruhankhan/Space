// game.js — strict pipeline orchestrator.
//   input → camera → movement/physics → render
// State machine + scene lifecycle. All HUD data flows through a
// broadcaster that React subscribes to via a stable callback.

import { renderer }     from './renderer.js'
import { physics }      from './physics.js'
import { input }        from './input.js'
import { sound }        from './sound.js'
import { particles }    from './particles.js'
import { buildMenuScene, buildHangarScene, buildFacilityScene } from './world.js'
import { buildRocket }  from './rocket.js'
import { Character }    from './character.js'
import { Launch }       from './launch.js'
import { getRockets }   from './save.js'

export const STATES = {
  LOADING:   'LOADING',
  PROFILE:   'PROFILE',
  MAIN_MENU: 'MAIN_MENU',
  HANGAR:    'HANGAR',
  FACILITY:  'FACILITY',
  LAUNCH:    'LAUNCH',
}

// Throttle HUD position broadcasts so React doesn't re-render every frame.
const HUD_POSITION_HZ = 6
const HUD_POSITION_INTERVAL = 1 / HUD_POSITION_HZ

class Game {
  constructor() {
    this.state = STATES.LOADING
    this._uiCallback = null
    this._sceneData = {}
    this._character  = null
    this._rocket     = null
    this._launch     = null

    this._menuTime   = 0
    this._timeAcc    = 0
    this._warningFlash = 0

    this._animatedRocketParts = { cores: [], warnings: [] }
    this._rocketConsoleState  = {}
    this._rocketConsoleCount  = 0
    this._hudBroadcastTimer = 0

    // Cinematic state for menu/hangar.
    this._menuRot = { earth: 0, orbit: 0, sat: 0 }
  }

  // ── Init ─────────────────────────────────────────────────
  async init() {
    renderer.init()
    physics.init()
    particles.init(renderer.scene)
    renderer.startLoop(this._frame.bind(this))
    console.log('[game] ready')
  }

  // ── UI callback registration ─────────────────────────────
  onUIUpdate(cb) { this._uiCallback = cb }

  _broadcast(state, payload) {
    if (!this._uiCallback) return
    try { this._uiCallback(state, payload) }
    catch (e) { console.error('[game] UI broadcast error', e) }
  }

  // ── State transitions ────────────────────────────────────
  transition(next, payload = {}) {
    if (this.state === next) return
    const prev = this.state
    this._cleanup(prev, next)

    this.state = next
    this._timeAcc = 0

    switch (next) {
      case STATES.PROFILE: {
        renderer.clearScene()
        renderer.setFog(0x020c1b, 0.04)
        this._sceneData = buildMenuScene(renderer.scene)
        input.disable()
        sound.setAmbient('menu')
        break
      }

      case STATES.MAIN_MENU: {
        renderer.clearScene()
        renderer.setFog(0x020c1b, 0.04)
        this._sceneData = buildMenuScene(renderer.scene)
        renderer.camera.position.set(0, 5, 22)
        renderer.camera.lookAt(0, 3, 0)
        input.disable()
        sound.setAmbient('menu')
        break
      }

      case STATES.HANGAR: {
        renderer.clearScene()
        renderer.setFog(0x06111d, 0.012)
        buildHangarScene(renderer.scene)
        const rocketConfig = payload.rocket || getRockets()[0]
        this._rocket = buildRocket(rocketConfig)
        this._rocket.position.set(0, 0.2, 0)
        renderer.scene.add(this._rocket)
        this._cacheRocketAnimations()
        input.disable()
        sound.setAmbient('hangar')
        renderer.camera.position.set(7, 8, 22)
        renderer.camera.lookAt(0, 9, 0)
        break
      }

      case STATES.FACILITY: {
        renderer.clearScene()
        renderer.setFog(0x04111e, 0.012)
        physics.clearStatic()
        this._sceneData = buildFacilityScene(renderer.scene)

        // Static colliders: ground floors + walls + tower + rocket shell.
        if (this._sceneData.floors) {
          for (const f of this._sceneData.floors) physics.addStatic(f, { tag: 'floor' })
        }
        if (this._sceneData.boxes) {
          for (const b of this._sceneData.boxes) physics.addStatic(b, { tag: 'box' })
        }

        const rocketConfig = payload.rocket || getRockets()[0]
        this._rocket = buildRocket(rocketConfig)
        this._rocket.position.set(0, 0.3, 0)
        renderer.scene.add(this._rocket)
        this._cacheRocketAnimations()
        this._registerRocketColliders()
        this._prepareRocketConsoleState()

        this._character = new Character(renderer.scene)
        this._character.setPosition(8, 1, 8)
        this._character.on('deck', ({ name }) => {
          this._broadcast(STATES.FACILITY, { deckName: name })
        })
        this._character.on('console', ({ consoleId }) => {
          this._activateRocketConsole(consoleId)
        })

        input.enable()
        sound.setAmbient('facility')
        input.requestPointerLock()

        this._broadcast(STATES.FACILITY, {
          launchReady: this._canLaunch(),
          consoleProgress: this._rocketConsoleCount > 0
            ? `0/${this._rocketConsoleCount} systems online`
            : 'No system checks required',
        })
        break
      }

      case STATES.LAUNCH: {
        input.disable()
        this._launch = new Launch(
          renderer.scene,
          renderer.camera,
          this._rocket,
          (result) => this._broadcast(STATES.LAUNCH, { result }),
        )
        this._launch.start()
        break
      }
    }

    this._broadcast(next, payload)
  }

  _cleanup(prev, next) {
    const keepRocket = prev === STATES.FACILITY && next === STATES.LAUNCH
    if (!keepRocket && this._rocket && (prev === STATES.HANGAR || prev === STATES.FACILITY || prev === STATES.LAUNCH)) {
      renderer.disposeObject(this._rocket)
      renderer.scene.remove(this._rocket)
      this._rocket = null
      this._animatedRocketParts = { cores: [], warnings: [] }
    }
    if (prev === STATES.FACILITY && this._character) {
      this._character.dispose()
      this._character = null
    }
    if (prev === STATES.FACILITY || prev === STATES.LAUNCH) {
      particles.stop()
      try { sound.play('stop_thruster') } catch {}
      input.exitPointerLock()
    }
    if (prev === STATES.LAUNCH) {
      this._launch = null
    }
  }

  // ── Main frame ───────────────────────────────────────────
  _frame(delta, time) {
    this._timeAcc      += delta
    this._menuTime     += delta
    this._warningFlash += delta

    input.update()

    // Cinematic scenes: animate + camera only.
    if (this.state === STATES.MAIN_MENU || this.state === STATES.PROFILE || this.state === STATES.HANGAR) {
      this._tickCinematic(delta)
      return
    }

    if (this.state === STATES.FACILITY) {
      this._tickFacility(delta)
      return
    }

    if (this.state === STATES.LAUNCH) {
      this._tickLaunch(delta)
      return
    }
  }

  _tickCinematic(delta) {
    if (this.state === STATES.HANGAR && this._rocket) {
      this._rocket.rotation.y += delta * 0.18
      renderer.camera.position.x = 7 + Math.sin(this._menuTime * 0.16) * 2.5
      renderer.camera.position.z = 22 + Math.cos(this._menuTime * 0.16) * 2
      renderer.camera.position.y = 8 + Math.sin(this._menuTime * 0.10) * 0.8
      renderer.camera.lookAt(0, 9, 0)
    } else {
      this._menuRot.earth += delta * 0.08
      this._menuRot.orbit += delta * 0.30
      this._menuRot.sat   += delta * 0.80

      const { earthSphere, earthWire, orbitRing, sat } = this._sceneData
      if (earthSphere) earthSphere.rotation.y = this._menuRot.earth
      if (earthWire)   earthWire.rotation.y   = -this._menuRot.earth * 0.5
      if (orbitRing)   orbitRing.rotation.z   = this._menuRot.orbit

      if (earthSphere && sat) {
        sat.position.set(
          earthSphere.position.x + Math.cos(this._menuRot.sat) * 5.5,
          earthSphere.position.y,
          earthSphere.position.z + Math.sin(this._menuRot.sat) * 5.5,
        )
      }
      renderer.camera.position.x = Math.sin(this._menuTime * 0.08) * 3
      renderer.camera.position.y = 5 + Math.sin(this._menuTime * 0.05) * 0.5
      renderer.camera.lookAt(0, 3, 0)
    }
    this._animateRocketLights(delta, false)
  }

  _tickFacility(delta) {
    if (!this._character) return

    // Camera first (instant, frame-aligned with mouse delta).
    this._character.applyCamera(renderer.camera)

    // Then movement + physics.
    this._character.update(delta, this._rocket)

    // Cosmetic animations.
    this._animateRocketLights(delta, true)

    // Throttled HUD broadcast.
    this._hudBroadcastTimer += delta
    if (this._hudBroadcastTimer >= HUD_POSITION_INTERVAL) {
      this._hudBroadcastTimer = 0
      const snap = this._character.snapshot()
      this._broadcast(STATES.FACILITY, {
        position: { x: snap.x, y: snap.y, z: snap.z },
        insideRocket: snap.insideRocket,
        deckName: snap.deck,
        launchReady: this._canLaunch(),
        consoleProgress: this._rocketConsoleCount > 0
          ? `${Object.values(this._rocketConsoleState).filter(Boolean).length}/${this._rocketConsoleCount} systems online`
          : 'No system checks required',
      })
    }
  }

  _tickLaunch(delta) {
    if (!this._launch) return
    this._launch.update(
      delta,
      (count)    => this._broadcast(STATES.LAUNCH, { countdown: count }),
      (status)   => this._broadcast(STATES.LAUNCH, { launchStatus: status }),
    )
    // Strobing warning lights.
    const on = (Math.floor(this._warningFlash * 6) % 2 === 0)
    for (const obj of this._animatedRocketParts.warnings) {
      obj.material.emissiveIntensity = on ? 2 : 0
    }
  }

  _animateRocketLights(delta, rotateCore) {
    const corePulse = 1.5 + Math.sin(this._menuTime * 3) * 0.5
    const warnPulse = (Math.floor(this._warningFlash * 2) % 2 === 0) ? 1.5 : 0.1
    for (const obj of this._animatedRocketParts.cores) {
      obj.material.emissiveIntensity = corePulse
      if (rotateCore) obj.rotation.y += delta * 0.5
    }
    for (const obj of this._animatedRocketParts.warnings) {
      obj.material.emissiveIntensity = warnPulse
    }
  }

  // ── Console activation logic ─────────────────────────────
  _prepareRocketConsoleState() {
    this._rocketConsoleState = {}
    this._rocketConsoleCount = 0
    if (!this._rocket) return
    this._rocket.traverse(obj => {
      if (obj.userData && obj.userData.isConsole) {
        this._rocketConsoleCount += 1
        this._rocketConsoleState[obj.userData.consoleId] = false
      }
    })
  }

  _canLaunch() {
    if (this._rocketConsoleCount === 0) return true
    for (const k in this._rocketConsoleState) {
      if (!this._rocketConsoleState[k]) return false
    }
    return true
  }

  _activateRocketConsole(consoleId) {
    if (!consoleId || !this._rocketConsoleState.hasOwnProperty(consoleId)) return
    if (this._rocketConsoleState[consoleId]) return
    this._rocketConsoleState[consoleId] = true
    let active = 0
    for (const k in this._rocketConsoleState) if (this._rocketConsoleState[k]) active++
    this._broadcast(STATES.FACILITY, {
      consoleProgress: `${active}/${this._rocketConsoleCount} systems online`,
      launchReady: this._canLaunch(),
    })
  }

  _cacheRocketAnimations() {
    const cores = []
    const warnings = []
    this._rocket?.traverse(obj => {
      if (!obj.material) return
      if (obj.userData.isCore)    cores.push(obj)
      if (obj.userData.isWarning) warnings.push(obj)
    })
    this._animatedRocketParts = { cores, warnings }
  }

  _registerRocketColliders() {
    this._rocket?.traverse(obj => {
      if (!obj.geometry) return
      if (obj.userData.isInteriorFloor) {
        physics.addStatic(obj, { tag: 'floor' })
      } else if (obj.userData.isRocketShell) {
        physics.addStatic(obj, { tag: 'shell' })
      }
    })
  }

  // ── Public actions ───────────────────────────────────────
  startLaunch() {
    if (this.state !== STATES.FACILITY) return
    if (!this._canLaunch()) {
      sound.play('error')
      this._broadcast(STATES.FACILITY, {
        launchReady: false,
        consoleProgress: `${Object.values(this._rocketConsoleState).filter(Boolean).length}/${this._rocketConsoleCount} systems online`,
        launchHint: 'Activate all consoles before launch',
      })
      return
    }
    this.transition(STATES.LAUNCH)
  }

  previewRocket(config) {
    if (this.state !== STATES.HANGAR || !config) return
    if (this._rocket) {
      renderer.disposeObject(this._rocket)
      renderer.scene.remove(this._rocket)
    }
    this._rocket = buildRocket(config)
    this._rocket.position.set(0, 0.2, 0)
    renderer.scene.add(this._rocket)
    this._cacheRocketAnimations()
  }

  returnToMenu() { this.transition(STATES.MAIN_MENU) }
}

export const game = new Game()