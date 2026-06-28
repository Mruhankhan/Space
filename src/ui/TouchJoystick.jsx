import React, { useCallback, useEffect, useRef } from 'react'
import { input } from '../input.js'

/**
 * TouchJoystick — pointer-event-driven thumb stick.
 * Reports a normalised (x, y) in [-1, 1] via `onChange`.
 * Sends the same value to `input.setTouchAxis(channel, x, y)` so the
 * character controller picks it up.
 *
 * `side` is 'left' or 'right' (visual only, no behaviour difference).
 * `channel` defaults to 'move' for left, 'look' for right.
 * `radius` is the touch-zone radius in pixels (default 80).
 */
export default function TouchJoystick({
  side = 'left',
  channel = side === 'right' ? 'look' : 'move',
  radius = 80,
  onChange,
}) {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const stateRef = useRef({ active: false, pointerId: null, rect: null })

  const report = useCallback((x, y) => {
    input.setTouchAxis(channel, x, y)
    onChange?.(x, y)
  }, [channel, onChange])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    if (stateRef.current.active) return
    const rect = baseRef.current?.getBoundingClientRect()
    if (!rect) return
    stateRef.current.active = true
    stateRef.current.pointerId = e.pointerId
    stateRef.current.rect = rect
    e.target.setPointerCapture?.(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e) => {
    const s = stateRef.current
    if (!s.active || e.pointerId !== s.pointerId) return
    const rect = s.rect
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = rect.width / 2
    let nx = dx / maxDist
    let ny = dy / maxDist
    if (dist > maxDist) {
      const k = maxDist / dist
      nx *= k
      ny *= k
    }
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${nx * maxDist}px, ${ny * maxDist}px)`
    }
    report(nx, ny)
  }, [report])

  const handlePointerUp = useCallback((e) => {
    const s = stateRef.current
    if (e.pointerId !== s.pointerId) return
    s.active = false
    s.pointerId = null
    s.rect = null
    if (knobRef.current) knobRef.current.style.transform = 'translate(0, 0)'
    report(0, 0)
  }, [report])

  useEffect(() => {
    return () => { report(0, 0) }
  }, [report])

  const size = radius * 2
  return (
    <div
      className={`touch-joystick touch-joystick--${side}`}
      ref={baseRef}
      style={{ width: size, height: size }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="touch-joystick-base" />
      <div className="touch-joystick-knob" ref={knobRef} />
    </div>
  )
}