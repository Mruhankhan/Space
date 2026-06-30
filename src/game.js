// game.js — State machine and game loop orchestrator

import { renderer } from './renderer.js'
import { physics } from './physics.js'
import { input } from './input.js'
import { sound } from './sound.js'
import { particles } from './particles.js'
import { buildMenuScene, buildHangarScene, buildFacilityScene } from './world.js'
import { loadRocket } from './loaders.js'
import { Character } from './character.js'
import { Launch } from './launch.js'
import { getRockets } from './save.js'

export const STATES = {
  LOADING: 'LOADING',
  PROFILE: 'PROFILE',
  MAIN_MENU: 'MAIN_MENU',
  HANGAR: 'HANGAR',
  FACILITY: 'FACILITY',
  LAUNCH: 'LAUNCH',
}

const FIXED_TICK = 1 / 90
const MAX_ACCUMULATOR = 0.25
const FACILITY_BROADCAST_INTERVAL = 0.1 // seconds (100ms)

class Game {
  constructor() {
    this.state = STATES.LOADING
    this._uiCallback = null
    this._sceneData = {}
    this._character = null
    this._rocket = null
    this._launch = null
    this._menuTime = 0
    this._warningFlash = 0
    this._facilityUiTimer = FACILITY_BROADCAST_INTERVAL
    this._animatedRocketParts = { cores: [], warnings: [] }
    this._accumulator = 0
    this._rocketConsoleState = {}
    this._rocketConsoleCount = 0
    this._rocketLoadSeq = 0
  }

  _prepareRocketConsoleState() {
    this._rocketConsoleState = {}
    this._rocketConsoleCount = 0
    if (!this._rocket) return
    this._rocket.traverse(obj => {
      if (obj.userData.isConsole) {
        this._rocketConsoleCount += 1
        this._rocketConsoleState[obj.userData.consoleId] = false
      }
    })
  }

  _canLaunch() {
    return this._rocketConsoleCount === 0 || Object.values(this._rocketConsoleState).every(Boolean)
  }

  _clearRocket() {
    if (!this._rocket) return
    renderer.disposeObject(this._rocket)
    renderer.scene.remove(this._rocket)
    this._rocket = null
    this._animatedRocketParts = { cores: [], warnings: [] }
  }

  _attachRocket(rocket, position) {
    this._clearRocket()
    this._rocket = rocket
    this._rocket.position.copy(position)
    renderer.scene.add(this._rocket)
    this._cacheRocketAnimations()
  }

  _activateRocketConsole(consoleId) {
    if (!consoleId || !this._rocketConsoleState.hasOwnProperty(consoleId)) return
    if (this._rocketConsoleState[consoleId]) return
    this._rocketConsoleState[consoleId] = true
    const activeCount = Object.values(this._rocketConsoleState).filter(Boolean).length
    this._uiCallback?.(STATES.FACILITY, {
      consoleProgress: `${activeCount}/${this._rocketConsoleCount} systems online`,
      launchReady: this._canLaunch(),
    })
  }

  // ── Initialization ─────────────────────────────────────────
  async init() {
    renderer.init()
    await physics.init()
    particles.init(renderer.scene)
    renderer.startLoop(this._tick.bind(this))
    console.log('[game] Initialised')
  }

  // ── State transitions ──────────────────────────────────────
  async transition(newState, payload = {}) {
    console.log(`[game] ${this.state} → ${newState}`)

    // Cleanup previous state
    this._cleanupState(this.state, newState)

    this.state = newState

    switch (newState) {
      case STATES.PROFILE:
        renderer.clearScene()
        renderer.setFog(0x020c1b, 0.04)
        this._buildMenuRoom()
        input.disable()
        sound.setAmbient('menu')
        break

      case STATES.MAIN_MENU:
        renderer.clearScene()
        renderer.setFog(0x020c1b, 0.04)
        this._sceneData = buildMenuScene(renderer.scene)
        input.disable()
        sound.setAmbient('menu')
        renderer.camera.position.set(0, 5, 22)
        renderer.camera.lookAt(0, 3, 0)
        break

      case STATES.HANGAR: {
        renderer.clearScene()
        renderer.setFog(0x06111d, 0.012)
        buildHangarScene(renderer.scene)
        const rockets = getRockets()
        const rocketConfig = payload.rocket || rockets[0]
        const loadSeq = ++this._rocketLoadSeq
        const rocket = await loadRocket(rocketConfig)
        if (this.state === STATES.HANGAR && loadSeq === this._rocketLoadSeq && rocket) {
          this._attachRocket(rocket, { x: 0, y: 0.2, z: 0 })
        } else if (rocket) {
          renderer.disposeObject(rocket)
        }
        input.disable()
        sound.setAmbient('hangar')
        renderer.camera.position.set(5, 9, 22)
        renderer.camera.lookAt(0, 9.5, 0)
        break
      }

      case STATES.FACILITY: {
        renderer.clearScene()
        renderer.setFog(0x04111e, 0.012)
        physics.clearStatic()
        this._sceneData = buildFacilityScene(renderer.scene)

        // Register collidable geometry
        if (this._sceneData.collidables) {
          this._sceneData.collidables.forEach(m => physics.addStatic(m))
        }

        const rocketConfig = payload.rocket || getRockets()[0]
        const loadSeq = ++this._rocketLoadSeq
        const rocket = await loadRocket(rocketConfig)
        if (this.state === STATES.FACILITY && loadSeq === this._rocketLoadSeq && rocket) {
          this._attachRocket(rocket, { x: 0, y: 0.3, z: 0 })
          this._registerRocketColliders()
          this._prepareRocketConsoleState()
          physics.addStatic(this._sceneData.ground)

          this._character = new Character(renderer.scene)
          this._uiCallback?.(STATES.FACILITY, {
            launchReady: this._canLaunch(),
            consoleProgress: this._rocketConsoleCount > 0
              ? `0/${this._rocketConsoleCount} systems online`
              : 'No system checks required',
          })

          this._character.setPosition(8, 2, 8)
          // Use proper event emitter instead of direct property assignment.
          this._character.on('deck', (e) => {
            this._uiCallback?.(STATES.FACILITY, { deckName: e.name })
          })
          this._character.on('console', (e) => this._activateRocketConsole(e.consoleId))

          input.enable()
          sound.setAmbient('facility')
          input.requestPointerLock()
        } else if (rocket) {
          renderer.disposeObject(rocket)
        }
        break
      }

      case STATES.LAUNCH:
        // Launch is triggered from within FACILITY state
        input.disable()
        this._launch = new Launch(
          renderer.scene,
          renderer.camera,
          this._rocket,
          (result) => {
            this._uiCallback?.(STATES.LAUNCH, { result })
          }
        )
        this._launch.start()
        break
    }

    this._uiCallback?.(newState, payload)
  }

  _cleanupState(prev, next) {
    const keepRocketForLaunch = prev === STATES.FACILITY && next === STATES.LAUNCH

    if (prev === STATES.FACILITY && this._character) {
      this._character.dispose()
      this._character = null
    }

    if (!keepRocketForLaunch && (prev === STATES.HANGAR || prev === STATES.FACILITY || prev === STATES.LAUNCH)) {
      this._rocketLoadSeq += 1
      this._clearRocket()
    }
    if (prev === STATES.FACILITY || prev === STATES.LAUNCH) {
      particles.stop()
      sound.play('stop_thruster')
      input.exitPointerLock()
    }
    if (prev === STATES.LAUNCH) {
      this._launch = null
    }
  }

  _buildMenuRoom() {
    this._sceneData = buildMenuScene(renderer.scene)
    renderer.camera.position.set(0, 5, 22)
    renderer.camera.lookAt(0, 3, 0)
  }

  // ── UI callback registration ───────────────────────────────
  onUIUpdate(cb) { this._uiCallback = cb }

  _cacheRocketAnimations() {
    const cores = []
    const warnings = []
    this._rocket?.traverse(obj => {
      if (obj.userData.isCore && obj.material) cores.push(obj)
      if (obj.userData.isWarning && obj.material) warnings.push(obj)
    })
    this._animatedRocketParts = { cores, warnings }
  }

  _registerRocketColliders() {
    this._rocket?.traverse(obj => {
      if (obj.userData.isInteriorFloor || obj.userData.isRocketShell) {
        physics.addStatic(obj, { ignoreWhenInside: !!obj.userData.ignoreWhenInside })
      }
    })
  }

  // ── Game loop tick ─────────────────────────────────────────
  _tick(delta) {
    this._accumulator += delta
    if (this._accumulator > MAX_ACCUMULATOR) {
      this._accumulator = MAX_ACCUMULATOR
    }

    while (this._accumulator >= FIXED_TICK) {
      this._fixedTick(FIXED_TICK)
      this._accumulator -= FIXED_TICK
    }
  }

  _fixedTick(delta) {
    this._menuTime += delta
    this._warningFlash += delta

    switch (this.state) {
      case STATES.MAIN_MENU:
      case STATES.PROFILE:
        this._tickMenu(delta)
        break

      case STATES.HANGAR:
        this._tickHangar(delta)
        break

      case STATES.FACILITY:
        this._tickFacility(delta)
        break

      case STATES.LAUNCH:
        this._tickLaunch(delta)
        break
    }

    particles.update(delta)
    physics.step(delta)
  }

  _tickMenu(delta) {
    // Slow cinematic camera drift
    renderer.camera.position.x = Math.sin(this._menuTime * 0.08) * 3
    renderer.camera.position.y = 5 + Math.sin(this._menuTime * 0.05) * 0.5
    renderer.camera.lookAt(0, 3, 0)

    // Rotate earth / orbit ring
    const { earthSphere, earthWire, orbitRing, sat } = this._sceneData
    if (earthSphere) {
      earthSphere.rotation.y += delta * 0.1
      earthWire.rotation.y -= delta * 0.05
      orbitRing.rotation.z += delta * 0.3
    }
    if (sat && earthSphere) {
      sat.userData.orbitEarth.angle += delta * 0.8
      const { radius, angle } = sat.userData.orbitEarth
      sat.position.set(
        earthSphere.position.x + Math.cos(angle) * radius,
        earthSphere.position.y,
        earthSphere.position.z + Math.sin(angle) * radius
      )
    }
  }

  _tickHangar(delta) {
    // Slow rocket display rotation
    if (this._rocket) this._rocket.rotation.y += delta * 0.15

    // Camera orbit for dramatic display
    renderer.camera.position.x = 5 + Math.sin(this._menuTime * 0.16) * 2.5
    renderer.camera.position.z = 22 + Math.cos(this._menuTime * 0.16) * 2
    renderer.camera.position.y = 9 + Math.sin(this._menuTime * 0.1) * 0.8
    renderer.camera.lookAt(0, 9.5, 0)

    // Animate engineering core and warning lights
    this._animateRocketLights(delta, false)
  }

  _tickFacility(delta) {
    if (!this._character) return

    const deck = this._character.update(delta, renderer.camera, this._rocket)

    // Animate rocket interior
    this._animateRocketLights(delta, true)

    // Broadcast position to UI at max 100ms (10Hz).
    this._facilityUiTimer += delta
    if (this._facilityUiTimer < FACILITY_BROADCAST_INTERVAL) return
    this._facilityUiTimer = 0
    const pos = this._character.mesh.position
    this._uiCallback?.(STATES.FACILITY, {
      position: { x: pos.x, y: pos.y, z: pos.z },
      insideRocket: this._character.insideRocket,
      deckName: this._character.insideRocket ? (this._character.currentDeckName || 'BOARDING...') : null,
      playerYaw: this._character.yaw || 0,
      launchReady: this._canLaunch(),
      consoleProgress: this._rocketConsoleCount > 0
        ? `${Object.values(this._rocketConsoleState).filter(Boolean).length}/${this._rocketConsoleCount} systems online`
        : 'No system checks required',
    })
  }

  _tickLaunch(delta) {
    if (!this._launch) return
    this._launch.update(
      delta,
      (count) => this._uiCallback?.(STATES.LAUNCH, { countdown: count }),
      (status) => this._uiCallback?.(STATES.LAUNCH, { launchStatus: status })
    )
    // Animate warning lights during launch
    for (const obj of this._animatedRocketParts.warnings) {
      obj.material.emissiveIntensity = Math.floor(this._warningFlash * 4) % 2 === 0 ? 2 : 0
    }
  }

  _animateRocketLights(delta, rotateCore) {
    const corePulse = 1.5 + Math.sin(this._menuTime * 3) * 0.5
    const warningPulse = Math.floor(this._warningFlash * 2) % 2 === 0 ? 1.5 : 0.1
    for (const obj of this._animatedRocketParts.cores) {
      obj.material.emissiveIntensity = corePulse
      if (rotateCore) obj.rotation.y += delta * 0.5
    }
    for (const obj of this._animatedRocketParts.warnings) {
      obj.material.emissiveIntensity = warningPulse
    }
  }

  startLaunch() {
    if (this.state !== STATES.FACILITY) return
    if (!this._canLaunch()) {
      sound.play('error')
      this._uiCallback?.(STATES.FACILITY, {
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
    const loadSeq = ++this._rocketLoadSeq
    this._clearRocket()
    loadRocket(config).then((rocket) => {
      if (this.state !== STATES.HANGAR || loadSeq !== this._rocketLoadSeq) {
        if (rocket) renderer.disposeObject(rocket)
        return
      }
      this._attachRocket(rocket, { x: 0, y: 0.2, z: 0 })
    })
  }

  returnToMenu() {
    this.transition(STATES.MAIN_MENU)
  }
}

export const game = new Game()
