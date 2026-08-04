import { useEffect } from 'react'
import { useEditorStore } from '../store'
import { setPreferences } from '../services/api'

function serializePreferences(
  state: ReturnType<typeof useEditorStore.getState>,
): Record<string, unknown> {
  return {
    showPreview: state.showPreview,
    showOutline: state.showOutline,
    showMinimap: state.showMinimap,
    rightPanelView: state.rightPanelView,
    graphFilter: state.graphFilter,
    diffFilter: state.diffFilter,
    lastFileId: state.lastFileId,
    tryIt: {
      selectedServer: state.tryIt.selectedServer,
      customServerUrl: state.tryIt.customServerUrl,
      authConfig: {
        type: state.tryIt.authConfig.type,
        apiKeyLocation: state.tryIt.authConfig.apiKeyLocation,
      },
      requestContentType: state.tryIt.requestContentType,
    },
  }
}

/**
 * Syncs UI preferences to the server. The server is authoritative; localStorage
 * serves as a fast-start cache. Changes are written back debounced.
 */
export function usePreferencesSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let inFlight = ''

    const unsubscribe = useEditorStore.subscribe((state) => {
      if (!state.isHydrated) return
      const serialized = serializePreferences(state)
      const key = JSON.stringify(serialized)
      if (key === inFlight) return
      inFlight = key
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setPreferences(serialized).catch(() => {
          // Server unreachable - localStorage persistence still applies
        })
      }, 400)
    })

    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
    }
  }, [])
}
