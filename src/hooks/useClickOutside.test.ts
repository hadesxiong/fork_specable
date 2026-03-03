import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createRef } from 'react'
import { useClickOutside } from './useClickOutside'

function fireMouseDown(target: EventTarget) {
  const event = new MouseEvent('mousedown', { bubbles: true })
  Object.defineProperty(event, 'target', { value: target })
  document.dispatchEvent(event)
}

describe('useClickOutside', () => {
  it('calls handler when clicking outside the ref', () => {
    const handler = vi.fn()
    const ref = createRef<HTMLDivElement>()
    const div = document.createElement('div')
    document.body.appendChild(div)
    Object.defineProperty(ref, 'current', { value: div, writable: true })

    renderHook(() => useClickOutside(ref, handler))

    // Click outside
    fireMouseDown(document.body)
    expect(handler).toHaveBeenCalledTimes(1)

    document.body.removeChild(div)
  })

  it('does not call handler when clicking inside the ref', () => {
    const handler = vi.fn()
    const ref = createRef<HTMLDivElement>()
    const div = document.createElement('div')
    document.body.appendChild(div)
    Object.defineProperty(ref, 'current', { value: div, writable: true })

    renderHook(() => useClickOutside(ref, handler))

    fireMouseDown(div)
    expect(handler).not.toHaveBeenCalled()

    document.body.removeChild(div)
  })

  it('supports multiple refs', () => {
    const handler = vi.fn()
    const ref1 = createRef<HTMLDivElement>()
    const ref2 = createRef<HTMLDivElement>()
    const div1 = document.createElement('div')
    const div2 = document.createElement('div')
    document.body.appendChild(div1)
    document.body.appendChild(div2)
    Object.defineProperty(ref1, 'current', { value: div1, writable: true })
    Object.defineProperty(ref2, 'current', { value: div2, writable: true })

    renderHook(() => useClickOutside([ref1, ref2], handler))

    // Click inside ref2 — should NOT fire
    fireMouseDown(div2)
    expect(handler).not.toHaveBeenCalled()

    // Click outside both — should fire
    fireMouseDown(document.body)
    expect(handler).toHaveBeenCalledTimes(1)

    document.body.removeChild(div1)
    document.body.removeChild(div2)
  })

  it('does not attach listener when enabled is false', () => {
    const handler = vi.fn()
    const ref = createRef<HTMLDivElement>()

    renderHook(() => useClickOutside(ref, handler, false))

    fireMouseDown(document.body)
    expect(handler).not.toHaveBeenCalled()
  })

  it('cleans up listener on unmount', () => {
    const handler = vi.fn()
    const ref = createRef<HTMLDivElement>()

    const { unmount } = renderHook(() => useClickOutside(ref, handler))
    unmount()

    fireMouseDown(document.body)
    expect(handler).not.toHaveBeenCalled()
  })
})
