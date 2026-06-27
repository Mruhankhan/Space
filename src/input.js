// input.js — centralised keyboard/mouse input, remappable, disable-aware

const _keys = new Set()
const _pressed = new Set()
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

const GAMEPAD_DEADZONE = 0.18

function _applyDeadzone(value) {
  if (Math.abs(value) < GAMEPAD_DEADZONE) return 0
  return value > 0
    ? (value - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)
    : (value + GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)
}

function _getGamepadAxes() {
  const pads = navigator.getGamepads?.()
  if (!pads || !pads[0]) return null
  const gp = pads[0]
  if (!gp.axes) return null
  return {
    leftX:  _applyDeadzone(gp.axes[0] ?? 0),
    leftY:  _applyDeadzone(gp.axes[1] ?? 0),
    rightX: _applyDeadzone(gp.axes[2] ?? 0),
    rightY: _applyDeadzone(gp.axes[3] ?? 0),
  }
}

// ── Event listeners ────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (!_enabled) return
  if (!_keys.has(e.code)) _pressed.add(e.code)
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

  consumeAction(name) {
    if (!_enabled) return false
    const codes = _actions[name] || []
    const hit = codes.some(code => _pressed.has(code))
    codes.forEach(code => _pressed.delete(code))
    return hit
  },

  /** Movement vector {x, z} normalised, ready for Three.js */
  getMovement() {
    if (!_enabled) return { x: 0, z: 0 }
    let x = 0, z = 0
    if (this.isAction('moveForward'))  z -= 1
    if (this.isAction('moveBack'))     z += 1
    if (this.isAction('moveLeft'))     x -= 1
    if (this.isAction('moveRight'))    x += 1

    if (x === 0 && z === 0) {
      const gp = _getGamepadAxes()
      if (gp) {
        x = gp.leftX
        z = gp.leftY
      }
    }

    const len = Math.sqrt(x * x + z * z)
    if (len > 1) { x /= len; z /= len }
    return { x, z }
  },

  getLookDelta() {
    if (!_enabled) return { x: 0, y: 0 }
    const gp = _getGamepadAxes()
    if (!gp) return { x: 0, y: 0 }
    return {
      x: gp.rightX * 6,
      y: gp.rightY * 6,
    }
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

  disable() { _enabled = false; _keys.clear(); _pressed.clear() },
  enable()  { _enabled = true },
}

window.addEventListener('pointerdown', e => {
  const canvas = document.getElementById('three-canvas')
  if (!_enabled || _pointerLocked || e.button !== 0 || e.target !== canvas) return
  canvas.requestPointerLock()
})
