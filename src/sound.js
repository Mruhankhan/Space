// sound.js — Web Audio API real-time synthesizer (no audio files needed)

let _ctx = null
let _masterGain = null
let _ambientOsc = null
let _ambientGain = null
let _thrusterNode = null

function _getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)()
    _masterGain = _ctx.createGain()
    _masterGain.gain.value = 0.3
    _masterGain.connect(_ctx.destination)
  }
  return _ctx
}

// ── Ambient Drone ──────────────────────────────────────────
function _startAmbient(freq = 55, detune = 8) {
  const ctx = _getCtx()
  _stopAmbient()

  const o1 = ctx.createOscillator()
  const o2 = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  o1.type = 'sine'; o1.frequency.value = freq
  o2.type = 'sine'; o2.frequency.value = freq + detune
  o2.detune.value = detune

  filter.type = 'lowpass'; filter.frequency.value = 800

  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2)

  o1.connect(filter); o2.connect(filter)
  filter.connect(gain); gain.connect(_masterGain)

  o1.start(); o2.start()
  _ambientOsc = [o1, o2]; _ambientGain = gain
}

function _stopAmbient() {
  if (_ambientOsc) {
    _ambientOsc.forEach(o => { try { o.stop() } catch {} })
    _ambientOsc = null; _ambientGain = null
  }
}

// ── SFX generators ────────────────────────────────────────
function _blip(freq = 880, duration = 0.1, type = 'square') {
  const ctx = _getCtx()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.08, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  o.connect(g); g.connect(_masterGain)
  o.start(); o.stop(ctx.currentTime + duration)
}

function _chime() {
  const ctx = _getCtx()
  ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = freq
    const t = ctx.currentTime + i * 0.12
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.1, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    o.connect(g); g.connect(_masterGain)
    o.start(t); o.stop(t + 0.6)
  })
}

function _thrusterBuild() {
  const ctx = _getCtx()
  if (_thrusterNode) { _thrusterNode.stop(); _thrusterNode = null }

  const bufSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1)

  const source = ctx.createBufferSource()
  source.buffer = buffer; source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'; filter.frequency.value = 120

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3)

  source.connect(filter); filter.connect(gain); gain.connect(_masterGain)
  source.start()
  _thrusterNode = source

  // Rising pitch effect
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.5
  lfo.connect(filter.detune)
  lfo.start()
}

function _stopThruster() {
  if (_thrusterNode) {
    try { _thrusterNode.stop() } catch {}
    _thrusterNode = null
  }
}

// ── Public API ─────────────────────────────────────────────
export const sound = {
  play(name) {
    try {
      switch (name) {
        case 'click':    _blip(660, 0.08, 'square'); break
        case 'hover':    _blip(440, 0.05, 'sine'); break
        case 'success':  _chime(); break
        case 'error':    _blip(180, 0.3, 'sawtooth'); break
        case 'confirm':  _blip(880, 0.15, 'sine'); break
        case 'thruster': _thrusterBuild(); break
        case 'stop_thruster': _stopThruster(); break
      }
    } catch (e) { /* AudioContext may not be available */ }
  },

  setAmbient(scene) {
    try {
      switch (scene) {
        case 'menu':     _startAmbient(55, 6); break
        case 'hangar':   _startAmbient(40, 4); break
        case 'facility': _startAmbient(65, 10); break
        case 'none':     _stopAmbient(); break
      }
    } catch {}
  },

  setMasterVolume(v) {
    if (_masterGain) _masterGain.gain.value = Math.max(0, Math.min(1, v))
  },

  /** Must be called from a user gesture to resume AudioContext */
  resume() {
    try { _getCtx().resume() } catch {}
  },
}
