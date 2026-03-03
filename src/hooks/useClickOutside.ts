import { useEffect, type RefObject } from 'react'

/**
 * Calls `handler` when a mousedown event occurs outside all of the provided refs.
 */
export function useClickOutside(
  refs: RefObject<Element | null> | RefObject<Element | null>[],
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return

    function onMouseDown(event: MouseEvent) {
      const refsArray = Array.isArray(refs) ? refs : [refs]
      const clickedInside = refsArray.some(
        (ref) => ref.current?.contains(event.target as Node),
      )
      if (!clickedInside) {
        handler()
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [refs, handler, enabled])
}
