import { useCallback } from 'react'
import { useEditorStore } from '../store'
import { getFileSystem } from '../services/file-system'
import * as api from '../services/api'
import { formatEditorContent } from '../utils/format'
import { detectLanguage } from '../utils/content'

const DEFAULT_CONTENT = `openapi: 3.0.3
info:
  title: New API
  version: 1.0.0
paths: {}
`

function confirmDiscardChanges(): boolean {
  const file = useEditorStore.getState().file
  if (file?.isDirty) {
    return window.confirm(
      'You have unsaved changes that will be lost. Continue?',
    )
  }
  return true
}

export function useFileSystem() {
  const setFile = useEditorStore((state) => state.setFile)
  const updateFileIdentity = useEditorStore((state) => state.updateFileIdentity)
  const file = useEditorStore((state) => state.file)
  const showToast = useEditorStore((state) => state.showToast)
  const upsertFileInList = useEditorStore((state) => state.upsertFileInList)
  const removeFileFromList = useEditorStore((state) => state.removeFileFromList)
  const setFilesPanelOpen = useEditorStore((state) => state.setFilesPanelOpen)
  const setLastFileId = useEditorStore((state) => state.setLastFileId)

  // Opens the server file browser (Ctrl+O)
  const openFile = useCallback(() => {
    if (confirmDiscardChanges()) {
      setFilesPanelOpen(true)
    }
  }, [setFilesPanelOpen])

  // Opens a file from the local disk via the File System Access API
  const openLocalFile = useCallback(async () => {
    if (!confirmDiscardChanges()) return
    const fs = getFileSystem()
    const opened = await fs.openFile()
    if (opened) {
      setFile({ ...opened, source: 'local' })
    }
  }, [setFile])

  const openServerFile = useCallback(
    async (id: string): Promise<boolean> => {
      if (!confirmDiscardChanges()) return false
      try {
        const serverFile = await api.getFile(id)
        setFile({
          id: serverFile.id,
          name: serverFile.name,
          content: serverFile.content,
          isDirty: false,
          language: serverFile.language,
          source: 'server',
        })
        setLastFileId(id)
        return true
      } catch (error) {
        console.error('Failed to open server file:', error)
        showToast('error', 'Failed to open file from server')
        return false
      }
    },
    [setFile, setLastFileId, showToast],
  )

  const importFromFile = useCallback(async () => {
    if (!confirmDiscardChanges()) return false
    return new Promise<boolean>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.yaml,.yml,.json'

      input.onchange = async () => {
        const selectedFile = input.files?.[0]
        if (!selectedFile) {
          resolve(false)
          return
        }

        try {
          const content = await selectedFile.text()
          const language = detectLanguage(selectedFile.name, content)

          setFile({
            id: crypto.randomUUID(),
            name: `imported-${selectedFile.name}`,
            content,
            isDirty: false,
            language,
            source: 'local',
          })
          resolve(true)
        } catch (error) {
          console.error('Failed to import file:', error)
          resolve(false)
        }
      }

      input.oncancel = () => resolve(false)
      input.click()
    })
  }, [setFile])

  const importFromUrl = useCallback(
    async (url?: string) => {
      if (!confirmDiscardChanges()) return false
      const targetUrl =
        url ?? prompt('Enter URL to import OpenAPI specification:')
      if (!targetUrl) return false

      try {
        const response = await fetch(targetUrl)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const content = await response.text()
        const urlPath = new URL(targetUrl).pathname
        const filename = urlPath.split('/').pop() || 'imported-spec'
        const language = detectLanguage(filename, content)

        setFile({
          id: crypto.randomUUID(),
          name: `imported-${filename}${language === 'json' ? '.json' : '.yaml'}`,
          content,
          isDirty: false,
          language,
          source: 'local',
        })
        return true
      } catch (error) {
        console.error('Failed to import from URL:', error)
        alert(
          `Failed to import from URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        return false
      }
    },
    [setFile],
  )

  const saveFile = useCallback(async () => {
    if (!file) return false

    formatEditorContent()

    const current = useEditorStore.getState().file
    if (!current) return false

    if (current.source === 'server') {
      try {
        const saved = await api.updateFile(current.id, {
          content: current.content,
          name: current.name,
          language: current.language,
        })
        upsertFileInList({
          id: saved.id,
          name: saved.name,
          language: saved.language,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        })
        updateFileIdentity({ ...current, isDirty: false })
        return true
      } catch (error) {
        console.error('Failed to save to server:', error)
        showToast('error', 'Failed to save to server')
        return false
      }
    }

    const fs = getFileSystem()
    const savedFile = await fs.saveFile(current)
    if (savedFile) {
      updateFileIdentity({ ...savedFile, source: 'local' })
    }
    return savedFile !== null
  }, [file, updateFileIdentity, upsertFileInList, showToast])

  const saveFileAs = useCallback(async () => {
    if (!file) return false

    const fs = getFileSystem()
    const savedFile = await fs.saveFileAs(file)
    if (savedFile) {
      updateFileIdentity({ ...savedFile, source: 'local' })
    }
    return savedFile !== null
  }, [file, updateFileIdentity])

  // Uploads the current (local) file to the server as a new server file
  const saveToServer = useCallback(async () => {
    if (!file) return false

    formatEditorContent()

    const current = useEditorStore.getState().file
    if (!current) return false

    if (current.source === 'server') {
      return saveFile()
    }

    try {
      const created = await api.createFile({
        name: current.name.replace(/^imported-/, ''),
        content: current.content,
        language: current.language,
      })
      setFile({
        ...current,
        id: created.id,
        name: created.name,
        isDirty: false,
        source: 'server',
      })
      upsertFileInList({
        id: created.id,
        name: created.name,
        language: created.language,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      })
      setLastFileId(created.id)
      showToast('success', 'Saved to server')
      return true
    } catch (error) {
      console.error('Failed to save to server:', error)
      showToast('error', 'Failed to save to server')
      return false
    }
  }, [
    file,
    saveFile,
    setFile,
    upsertFileInList,
    setLastFileId,
    showToast,
  ])

  const newFile = useCallback(async () => {
    if (!confirmDiscardChanges()) return

    try {
      const created = await api.createFile({
        name: 'untitled.yaml',
        content: DEFAULT_CONTENT,
        language: 'yaml',
      })
      setFile({
        id: created.id,
        name: created.name,
        content: created.content,
        isDirty: false,
        language: 'yaml',
        source: 'server',
      })
      upsertFileInList({
        id: created.id,
        name: created.name,
        language: created.language,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      })
      setLastFileId(created.id)
    } catch (error) {
      console.error('Failed to create server file:', error)
      setFile({
        id: crypto.randomUUID(),
        name: 'untitled.yaml',
        content: DEFAULT_CONTENT,
        isDirty: false,
        language: 'yaml',
        source: 'local',
      })
      showToast('info', 'Server unavailable - created a local file', 5000)
    }
  }, [setFile, upsertFileInList, setLastFileId, showToast])

  const deleteServerFile = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await api.deleteFile(id)
        removeFileFromList(id)
        const current = useEditorStore.getState().file
        if (current?.id === id) {
          await newFile()
        }
        return true
      } catch (error) {
        console.error('Failed to delete file:', error)
        showToast('error', 'Failed to delete file')
        return false
      }
    },
    [removeFileFromList, newFile, showToast],
  )

  const exportAsJson = useCallback(async () => {
    if (!file) return false

    const fs = getFileSystem()
    return fs.exportAsJson(file.content, file.name)
  }, [file])

  const exportAsYaml = useCallback(async () => {
    if (!file) return false

    const fs = getFileSystem()
    return fs.exportAsYaml(file.content, file.name)
  }, [file])

  return {
    openFile,
    openLocalFile,
    openServerFile,
    importFromFile,
    importFromUrl,
    saveFile,
    saveFileAs,
    saveToServer,
    newFile,
    deleteServerFile,
    exportAsJson,
    exportAsYaml,
  }
}
