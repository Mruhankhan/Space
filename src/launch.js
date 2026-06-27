import * as THREE from 'three'
import { particles } from './particles.js'
import { sound } from './sound.js'
import { addLogEntry } from './save.js'

const COUNTDOWN_FROM = 10

export class Launch {
  constructor(scene, camera, rocket, onComplete) {
    this.scene = scene
    this.camera = camera
    this.rocket = rocket
    this.onComplete = onComplete

    this.state = 'idle' 
    this.countdown = COUNTDOWN_FROM
    this._elapsed = 0
    this._flightTime = 0
    this._maxAltitude = 0
    this._success = false

    this._origCamPos = camera.position.clone()
    this._origCamLook = new THREE.Vector3(0, 0, 0)
  }

  start() {
    this.state = 'countdown'
    this.countdown = COUNTDOWN_FROM
    this._elapsed = 0
    sound.setAmbient('none')
    sound.play('confirm')
  }

  abort() {
    this._end(false, 'Mission aborted by pilot')
  }

  /** Called from game loop each frame */
  update(delta, setCountdown, setStatus) {
    if (this.state === 'idle' || this.state === 'result') return

    this._elapsed += delta

    if (this.state === 'countdown') {
      const newCount = Math.ceil(COUNTDOWN_FROM - this._elapsed)
      if (newCount !== this.countdown) {
        this.countdown = newCount
        setCountdown(this.countdown)
        if (this.countdown > 0) sound.play('click')
      }
      if (this._elapsed >= COUNTDOWN_FROM - 3) {
        // Engine ignition at T-3
        if (this.state === 'countdown') {
          setStatus('ENGINE IGNITION')
          sound.play('thruster')
          particles.startEngineFlare(this.rocket.position)
          particles.startSmokePlume(new THREE.Vector3(this.rocket.position.x, 0.3, this.rocket.position.z))
          particles.startSparks(this.rocket.position.clone().setY(1))
        }
      }
      if (this._elapsed >= COUNTDOWN_FROM) {
        this.state = 'flight'
        this._flightTime = 0
        setCountdown(0)
        setStatus('LIFTOFF')
      }
    }

    else if (this.state === 'flight') {
      this._flightTime += delta

      // Rocket rises
      const altitude = Math.pow(this._flightTime, 2) * 4
      this.rocket.position.y = altitude
      this._maxAltitude = Math.max(this._maxAltitude, altitude)

      // Particle systems follow rocket
      // (particles attached to rocket group handle this automatically)

      // Camera follows — pull back and track upward
      const camRadius = 40 + this._flightTime * 5
      const camAngle  = Math.PI * 0.3
      this.camera.position.set(
        Math.sin(camAngle) * camRadius,
        altitude + 15 + this._flightTime * 3,
        Math.cos(camAngle) * camRadius
      )
      this.camera.lookAt(this.rocket.position)

      // Mission complete at T+20
      if (this._flightTime >= 20) {
        this._success = true
        this._end(true, 'Stage 1 complete')
      }
    }
  }

  _end(success, message) {
    this.state = 'result'
    this._success = success
    particles.stopEngineFlare()
    if (!success) sound.play('error')
    else sound.play('success')
    addLogEntry({
      rocket: this.rocket.name || 'Unknown',
      success,
      message,
      altitude: Math.round(this._maxAltitude),
    })
    setTimeout(() => {
      sound.setAmbient('facility')
      this.onComplete({ success, altitude: Math.round(this._maxAltitude), message })
    }, 3000)
  }

  isActive() { return this.state !== 'idle' }
  getResult() { return { success: this._success, altitude: Math.round(this._maxAltitude) } }
}
