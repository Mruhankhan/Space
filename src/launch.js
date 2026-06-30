import { Vector3 } from 'three'
import { particles } from './particles.js'
import { sound } from './sound.js'
import { addLogEntry, addMissionResult } from './save.js'
import { scoreMission } from './missions.js'

const COUNTDOWN_FROM = 10

export class Launch {
  constructor(scene, camera, rocket, onComplete, mission = null) {
    this.scene = scene
    this.camera = camera
    this.rocket = rocket
    this.onComplete = onComplete
    this.mission = mission

    this.state = 'idle'
    this.countdown = COUNTDOWN_FROM
    this._elapsed = 0
    this._flightTime = 0
    this._maxAltitude = 0
    this._peakVelocity = 0
    this._success = false

    this._origCamPos = camera.position.clone()
    this._origCamLook = new Vector3(0, 0, 0)
    this.config = rocket.userData?.config || {}
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
          particles.startSmokePlume(new Vector3(this.rocket.position.x, 0.3, this.rocket.position.z))
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

      const stageCount = Math.max(1, Math.min(3, this.config.stages || 2))
      const templateBonus = this.config.template === 'saturnv' ? 1.4 : this.config.template === 'falcon9' ? 1.2 : 1.0
      const speedFactor = 4 + stageCount * 0.9 + templateBonus
      const altitude = Math.pow(this._flightTime, 2) * speedFactor
      // Velocity = d(altitude)/dt = 2 * flightTime * speedFactor
      const velocity = 2 * this._flightTime * speedFactor
      this.rocket.position.y = altitude
      this._maxAltitude = Math.max(this._maxAltitude, altitude)
      this._peakVelocity = Math.max(this._peakVelocity, velocity)

      const camRadius = 40 + this._flightTime * 5
      const camAngle  = Math.PI * 0.3
      this.camera.position.set(
        Math.sin(camAngle) * camRadius,
        altitude + 15 + this._flightTime * 3,
        Math.cos(camAngle) * camRadius
      )
      this.camera.lookAt(this.rocket.position)

      if (this._flightTime >= 20) {
        const expectedStages = this.config.template === 'saturnv' ? 3 : 2
        let message = 'Stage 1 complete'
        let success = true

        if (stageCount < expectedStages) {
          success = false
          message = 'Staging failure: missing upper stage'
        } else if (this.config.template === 'custom' && stageCount < 2) {
          success = false
          message = 'Design instability caused a failure'
        }

        this._end(success, message)
      }
    }
  }

  _end(success, message) {
    this.state = 'result'
    this._success = success
    particles.stopEngineFlare()
    if (!success) sound.play('error')
    else sound.play('success')
    const altitude = Math.round(this._maxAltitude)
    addLogEntry({
      rocket: this.rocket.name || 'Unknown',
      success,
      message,
      altitude,
    })

    // Mission scoring.
    const result = { success, altitude, flightTime: this._flightTime, peakVelocity: this._peakVelocity, message }
    const scored = this.mission
      ? scoreMission(result, this.mission)
      : { score: success ? 100 : 0, tier: success ? 'bronze' : 'fail', label: 'Flight Complete' }
    if (this.mission) {
      addMissionResult({
        missionId: this.mission.id,
        missionLabel: this.mission.label,
        rocket: this.rocket.name || 'Unknown',
        success,
        score: scored.score,
        tier: scored.tier,
        altitude,
      })
    }

    setTimeout(() => {
      sound.setAmbient('facility')
      this.onComplete({
        success,
        altitude,
        flightTime: this._flightTime,
        peakVelocity: Math.round(this._peakVelocity),
        message,
        score: scored.score,
        tier: scored.tier,
        mission: this.mission,
      })
    }, 3000)
  }

}
