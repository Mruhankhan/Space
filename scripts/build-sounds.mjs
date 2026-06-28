#!/usr/bin/env node
// scripts/build-sounds.mjs
// Procedurally generates short .wav samples matching the existing Web
// Audio synth cues. PCM 16-bit mono 22050 Hz. Output → public/sounds/.
//
// Idempotent: skips files that already exist unless --force is passed.

import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'sounds')
const FORCE = process.argv.includes('--force')

const SAMPLE_RATE = 22050

// ── WAV writer ──
function writeWav(filename, samples) {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = SAMPLE_RATE * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const dataLength = samples.length * 2
  const buffer = Buffer.alloc(44 + dataLength)
  let p = 0
  buffer.write('RIFF', p); p += 4
  buffer.writeUInt32LE(36 + dataLength, p); p += 4
  buffer.write('WAVE', p); p += 4
  buffer.write('fmt ', p); p += 4
  buffer.writeUInt32LE(16, p); p += 4      // fmt size
  buffer.writeUInt16LE(1, p); p += 2        // PCM
  buffer.writeUInt16LE(numChannels, p); p += 2
  buffer.writeUInt32LE(SAMPLE_RATE, p); p += 4
  buffer.writeUInt32LE(byteRate, p); p += 4
  buffer.writeUInt16LE(blockAlign, p); p += 2
  buffer.writeUInt16LE(bitsPerSample, p); p += 2
  buffer.write('data', p); p += 4
  buffer.writeUInt32LE(dataLength, p); p += 4
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    buffer.writeInt16LE((s * 32767) | 0, p); p += 2
  }
  writeFileSync(filename, buffer)
}

// ── Sample synth ──
function envelope(t, attack, decay, sustain, release, total) {
  if (t < attack) return t / attack
  if (t < attack + decay) {
    const k = (t - attack) / decay
    return 1 - k * (1 - sustain)
  }
  if (t < total - release) return sustain
  if (t < total) {
    const k = (t - (total - release)) / release
    return sustain * (1 - k)
  }
  return 0
}

function blip({ freq = 880, duration = 0.1, type = 'square', attack = 0.005, decay = 0.02, sustain = 0.6, release = 0.03, detune = 0, volume = 0.5 } = {}) {
  const total = Math.max(duration, attack + decay + 0.05)
  const n = Math.floor(total * SAMPLE_RATE)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const env = envelope(t, attack, decay, sustain, release, total)
    const phase = 2 * Math.PI * (freq + detune * t) * t
    let v = 0
    switch (type) {
      case 'square':  v = Math.sign(Math.sin(phase)); break
      case 'saw':     v = 2 * (phase / (2 * Math.PI) - Math.floor(0.5 + phase / (2 * Math.PI))); break
      case 'triangle': {
        const x = (phase / Math.PI) % 2
        v = x < 1 ? x - 0.5 : 1.5 - x
        break
      }
      default: v = Math.sin(phase)
    }
    buf[i] = v * env * volume
  }
  return buf
}

function chime(freqs = [523.25, 659.25, 783.99, 1046.5], volume = 0.4) {
  const total = freqs.length * 0.12 + 0.5
  const n = Math.floor(total * SAMPLE_RATE)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    let v = 0
    for (let k = 0; k < freqs.length; k++) {
      const start = k * 0.12
      const local = t - start
      if (local < 0) continue
      const env = Math.exp(-local * 3.5)
      v += Math.sin(2 * Math.PI * freqs[k] * local) * env
    }
    buf[i] = v * volume * 0.6
  }
  return buf
}

function thruster(duration = 4.0, volume = 0.4) {
  const n = Math.floor(duration * SAMPLE_RATE)
  const buf = new Float32Array(n)
  // White noise with low-pass + slow LFO.
  let prev = 0
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    // 1-pole low-pass at ~400 Hz.
    const alpha = 0.18
    const noise = (Math.random() * 2 - 1)
    prev = prev + alpha * (noise - prev)
    // Slow LFO modulates amplitude.
    const lfo = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.4 * t)
    // Envelope in over first 1s, hold, fade out in last 0.5s.
    let env
    if (t < 1) env = t
    else if (t > duration - 0.5) env = (duration - t) / 0.5
    else env = 1
    buf[i] = prev * lfo * env * volume
  }
  return buf
}

function ambientDrone(freq = 55, detune = 8, duration = 6.0, volume = 0.3) {
  const n = Math.floor(duration * SAMPLE_RATE)
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.min(1, t / 1.5) * Math.min(1, (duration - t) / 0.5)
    const a = Math.sin(2 * Math.PI * freq * t)
    const b = Math.sin(2 * Math.PI * (freq + detune) * t + 0.4)
    const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.1 * t)
    buf[i] = (a * 0.5 + b * 0.5) * env * lfo * volume
  }
  return buf
}

function footstep(volume = 0.3) {
  // Two short low thumps ~0.1s apart.
  const out = []
  for (let i = 0; i < 2; i++) {
    const b = blip({ freq: 140, duration: 0.07, type: 'triangle', attack: 0.005, decay: 0.02, sustain: 0.4, release: 0.04, volume })
    out.push(b)
    out.push(new Float32Array(Math.floor(0.07 * SAMPLE_RATE)))
  }
  return concat(out)
}

function concat(arrays) {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Float32Array(total)
  let p = 0
  for (const a of arrays) { out.set(a, p); p += a.length }
  return out
}

// ── Manifest ──
const SAMPLES = [
  ['click',          () => blip({ freq: 660, duration: 0.08, type: 'square', volume: 0.5 })],
  ['hover',          () => blip({ freq: 440, duration: 0.05, type: 'sine',   volume: 0.4 })],
  ['success',        () => chime()],
  ['error',          () => blip({ freq: 180, duration: 0.3,  type: 'saw',    volume: 0.5 })],
  ['confirm',        () => blip({ freq: 880, duration: 0.15, type: 'sine',   volume: 0.5 })],
  ['thruster',       () => thruster(4.0, 0.4)],
  ['footstep',       () => footstep(0.35)],
  ['ambient-menu',   () => ambientDrone(55, 6, 6, 0.3)],
  ['ambient-hangar', () => ambientDrone(40, 4, 6, 0.3)],
  ['ambient-facility', () => ambientDrone(65, 10, 6, 0.3)],
]

function main() {
  mkdirSync(OUT, { recursive: true })
  let written = 0, skipped = 0
  for (const [name, gen] of SAMPLES) {
    const path = join(OUT, `${name}.wav`)
    if (existsSync(path) && !FORCE) {
      skipped++
      continue
    }
    const samples = gen()
    writeWav(path, samples)
    written++
    const stat = statSync(path)
    console.log(`[build-sounds] ${name}.wav  (${(stat.size / 1024).toFixed(1)} KB)`)
  }
  console.log(`[build-sounds] wrote ${written}, skipped ${skipped} → ${OUT}`)
}

main()