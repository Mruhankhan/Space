// sound.js — audio bus.
// Primary path: THREE.Audio playing pre-decoded buffers (loaded via loaders.js).
// Fallback: in-browser Web Audio synth (the original v0.1 path) when no .wav
// is available yet — keeps the game playable before `npm run build:assets`.

import { loadAudio, getAudioContext } from './loaders.js'

// ── Synth fallback ────────────────────────────────────────
let _ctx = null
let _masterGain = null
let _ambientOsc = null
let _ambientGain = null
let _thrusterNode = null
let _unlocked = false
let _pendingAmbient = null

function _getCtx() {
  if (!_ctx) {
    _ctx = getAudioContext()
    _masterGain = _ctx.createGain()
    _masterGain.gain.value = 0.3
    _masterGain.connect(_ctx.destination)
  }
  return _ctx
}

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
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.5
  lfo.connect(filter.detune)
  lfo.start()
}

function _stopThruster() {
  if (_thrusterNode) { try { _thrusterNode.stop() } catch {} ; _thrusterNode = null }
}

// ── Sample playback path ──────────────────────────────────
// One persistent AudioBufferSourceNode pool per name (rewound on replay).
const _sources = new Map()   // name → { gain, buffer }
const _ambientSource = { node: null, gain: null }
const _thrusterSource = { node: null, gain: null }

async function _playBuffer(name, { loop = false, volume = 0.6 } = {}) {
  const buf = await loadAudio(name)
  if (!buf) return false
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = loop
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(gain)
    if (!_masterGain) _getCtx()
    gain.connect(_masterGain)
    src.start(0)
    if (!loop) {
      src.onended = () => { try { src.disconnect() } catch {} }
    }
    return true
  } catch (e) {
    return false
  }
}

function _stopAmbientSource() {
  if (_ambientSource.node) {
    try { _ambientSource.node.stop() } catch {}
    _ambientSource.node = null
    _ambientSource.gain = null
  }
}

async function _startAmbientSource(name) {
  await _stopAmbientSourceSentinel()
  const buf = await loadAudio(name)
  if (!buf) return false
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0.18
    src.connect(gain)
    if (!_masterGain) _getCtx()
    gain.connect(_masterGain)
    src.start(0)
    _ambientSource.node = src
    _ambientSource.gain = gain
    return true
  } catch { return false }
}

async function _stopAmbientSourceSentinel() {
  _stopAmbientSource()
}

// ── Public API ────────────────────────────────────────────
export const sound = {
  /**
   * Play a one-shot SFX. Tries the loaded buffer first; falls back to synth.
   */
  async play(name) {
    // Special cases.
    if (name === 'stop_thruster') return this.setThruster(false)
    if (name === 'console') {
      // Console activation: chime + confirm blip layered.
      _playBuffer('success', { volume: 0.5 }).catch(() => _chime())
      return
    }
    const played = await _playBuffer(name, { volume: 0.6 })
    if (played) return
    // Fallback to synth.
    try {
      if (!_ctx && !_unlocked) return
      switch (name) {
        case 'click':    _blip(660, 0.08, 'square'); break
        case 'hover':    _blip(440, 0.05, 'sine'); break
        case 'success':  _chime(); break
        case 'error':    _blip(180, 0.3, 'sawtooth'); break
        case 'confirm':  _blip(880, 0.15, 'sine'); break
        case 'thruster': _thrusterBuild(); break
        case 'footstep': _blip(140, 0.05, 'triangle'); break
      }
    } catch (e) { /* AudioContext may not be available */ }
  },

  async setAmbient(scene) {
    if (scene === 'none') {
      _stopAmbient()
      _stopAmbientSource()
      return
    }
    if (!_ctx && !_unlocked) {
      _pendingAmbient = scene
      return
    }
    // Try sample first.
    const name = `ambient-${scene}`
    const ok = await _startAmbientSource(name)
    if (ok) {
      _stopAmbient()
      return
    }
    // Fallback to synth.
    try {
      switch (scene) {
        case 'menu':     _startAmbient(55, 6); break
        case 'hangar':   _startAmbient(40, 4); break
        case 'facility': _startAmbient(65, 10); break
        case 'none':     _stopAmbient(); break
      }
    } catch {}
  },

  /**
   * Continuous thruster control. `on` toggles between running and stopped.
   */
  async setThruster(on) {
    if (on) {
      const ok = await _playBuffer('thruster', { loop: true, volume: 0.6 })
      if (!ok) _thrusterBuild()
    } else {
      _stopThruster()
      _stopAmbientSource()
    }
  },

  setMasterVolume(v) {
    if (_masterGain) _masterGain.gain.value = Math.max(0, Math.min(1, v))
  },

  /** Must be called from a user gesture to resume AudioContext */
  async resume() {
    try {
      _unlocked = true
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') await ctx.resume()
      _getCtx() // ensure master gain
      if (_pendingAmbient) {
        const scene = _pendingAmbient
        _pendingAmbient = null
        await this.setAmbient(scene)
      }
    } catch {}
  },
}
