// sound.js — audio bus.
// Plays pre-decoded .wav buffers (loaded via loaders.js).

import { loadAudio, getAudioContext } from './loaders.js'
import { settings } from './settings.js'

// ── State ─────────────────────────────────────────────────
let _masterGain = null

const _ambientSource = { node: null, gain: null }
const _thrusterSource = { node: null, gain: null }

function _ensureMasterGain() {
  if (_masterGain) return
  const ctx = getAudioContext()
  _masterGain = ctx.createGain()
  // Read volume from settings with a fallback
  const vol = settings.get().masterVolume ?? 0.3
  _masterGain.gain.value = vol
  _masterGain.connect(ctx.destination)
}

// ── Sample playback path ──────────────────────────────────
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
    _ensureMasterGain()
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
  // Clear any previous ambient.
  _stopAmbientSource()
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
    _ensureMasterGain()
    gain.connect(_masterGain)
    src.start(0)
    _ambientSource.node = src
    _ambientSource.gain = gain
    return true
  } catch { return false }
}

// ── Public API ────────────────────────────────────────────
export const sound = {
  /**
   * Play a one-shot SFX.
   */
  async play(name) {
    if (name === 'stop_thruster') return this.setThruster(false)
    if (name === 'console') {
      await _playBuffer('success', { volume: 0.5 })
      return
    }
    await _playBuffer(name, { volume: 0.6 })
  },

  async setAmbient(scene) {
    if (scene === 'none') {
      _stopAmbientSource()
      return
    }
    await _startAmbientSource(`ambient-${scene}`)
  },

  /** Continuous thruster control. */
  async setThruster(on) {
    if (on) {
      await _playBuffer('thruster', { loop: true, volume: 0.6 })
    } else {
      _stopAmbientSource()
    }
  },

  setMasterVolume(v) {
    _ensureMasterGain()
    _masterGain.gain.value = Math.max(0, Math.min(1, v))
  },

  /** Must be called from a user gesture to resume AudioContext */
  async resume() {
    try {
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') await ctx.resume()
      _ensureMasterGain()
    } catch {}
  },
}
