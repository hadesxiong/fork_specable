import { useEffect, useRef } from 'react'
import { MainLayout } from './components/Layout'
import { FullscreenPreview } from './components/Preview/FullscreenPreview'
import { useEditorStore } from './store'
import { loadSharedSpec, clearSharedHash } from './services/share'
import * as api from './services/api'
import { usePreferencesSync } from './hooks/usePreferencesSync'

function App() {
  const params = new URLSearchParams(window.location.search)
  const isPreviewMode = params.get('view') === 'preview'
  const hasLoadedRef = useRef(false)

  usePreferencesSync()

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    if (isPreviewMode) return

    const shared = loadSharedSpec()
    if (shared) {
      useEditorStore.getState().setFile({
        id: crypto.randomUUID(),
        name: `shared-spec.${shared.language === 'json' ? 'json' : 'yaml'}`,
        content: shared.content,
        isDirty: false,
        language: shared.language,
        source: 'local',
      })
      clearSharedHash()
    }

    const bootstrap = async () => {
      const store = useEditorStore.getState()
      try {
        const [files, prefs] = await Promise.all([
          api.listFiles(),
          api.getPreferences(),
        ])
        store.setFiles(files)
        store.setServerConnected(true)
        if (prefs) store.applyServerPreferences(prefs)

        if (!shared) {
          const lastId =
            typeof prefs?.lastFileId === 'string' ? prefs.lastFileId : null
          if (lastId) {
            try {
              const serverFile = await api.getFile(lastId)
              if (serverFile) {
                store.setFile({
                  id: serverFile.id,
                  name: serverFile.name,
                  content: serverFile.content,
                  isDirty: false,
                  language: serverFile.language,
                  source: 'server',
                })
              }
            } catch {
              // Last opened file no longer exists
            }
          }
        }
      } catch (error) {
        console.error('Failed to connect to server:', error)
        store.setServerConnected(false)
        store.showToast(
          'info',
          'Server unreachable - working in local-only mode',
          5000,
        )
      } finally {
        store.setHydrated(true)
      }
    }

    bootstrap()
  }, [isPreviewMode])

  if (isPreviewMode) {
    return <FullscreenPreview />
  }

  return <MainLayout />
}

export default App
