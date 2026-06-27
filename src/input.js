// input.js — centralised keyboard/mouse input, remappable, disable-aware

const _keys = new Set()
const _mousePos = { x: 0, y: 0 }
const _mouseDelta = { x: 0, y: 0 }
let _enabled = true
let _pointerLocked = false

const _actions = {
  moveForward:  ['KeyW', 'ArrowUp'],
  moveBack:     ['KeyS', 'ArrowDown'],
  moveLeft:     ['KeyA', 'ArrowLeft'],
  moveRight:    ['KeyD', 'ArrowRight'],
  jump:         ['Space'],
  interact:     ['KeyE'],
  sprint:       ['ShiftLeft', 'ShiftRight'],
  pause:        ['Escape'],
}

// ── Event listeners ────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (!_enabled) return
  _keys.add(e.code)
  if (e.code === 'Space') e.preventDefault()
})
window.addEventListener('keyup',   e => _keys.delete(e.code))

window.addEventListener('mousemove', e => {
  _mousePos.x = e.clientX
  _mousePos.y = e.clientY
  if (_pointerLocked) {
    _mouseDelta.x += e.movementX
    _mouseDelta.y += e.movementY
  }
})

document.addEventListener('pointerlockchange', () => {
  _pointerLocked = document.pointerLockElement !== null
})

// ── Public API ─────────────────────────────────────────────
export const input = {
  /** Is a raw key code currently held? */
  isKey(code) { return _keys.has(code) },

  /** Is a named action currently held? */
  isAction(name) {
    if (!_enabled) return false
    return (_actions[name] || []).some(code => _keys.has(code))
  },

  /** Movement vector {x, z} normalised, ready for Three.js */
  getMovement() {
    if (!_enabled) return { x: 0, z: 0 }
    let x = 0, z = 0
    if (this.isAction('moveForward'))  z -= 1
    if (this.isAction('moveBack'))     z += 1
    if (this.isAction('moveLeft'))     x -= 1
    if (this.isAction('moveRight'))    x += 1
    // normalise diagonal
    const len = Math.sqrt(x * x + z * z)
    if (len > 0) { x /= len; z /= len }
    return { x, z }
  },

  /** Consume and return accumulated mouse delta (resets after read) */
  consumeMouseDelta() {
    const d = { ..._mouseDelta }
    _mouseDelta.x = 0
    _mouseDelta.y = 0
    return d
  },

  isSprinting() { return this.isAction('sprint') },
  isPointerLocked() { return _pointerLocked },

  requestPointerLock() {
    document.getElementById('three-canvas')?.requestPointerLock()
  },
  exitPointerLock() {
    document.exitPointerLock?.()
  },

  disable() { _enabled = false; _keys.clear() },
  enable()  { _enabled = true },
}
