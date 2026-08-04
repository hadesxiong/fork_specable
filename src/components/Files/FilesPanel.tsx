import { useCallback, useRef, useState } from 'react'
import {
  X,
  FolderOpen,
  Upload,
  Plus,
  Trash2,
  Pencil,
  Check,
  Loader2,
} from 'lucide-react'
import { useEditorStore } from '../../store'
import { updateFile } from '../../services/api'
import { formatRelativeTime } from '../../utils/time'

interface FilesPanelProps {
  isOpen: boolean
  onClose: () => void
  onOpenServerFile: (id: string) => Promise<boolean>
  onOpenLocalFile: () => Promise<void> | void
  onImportUrl: () => Promise<boolean> | void
  onNewFile: () => Promise<void> | void
  onDeleteServerFile: (id: string) => Promise<boolean>
}

export function FilesPanel({
  isOpen,
  onClose,
  onOpenServerFile,
  onOpenLocalFile,
  onImportUrl,
  onNewFile,
  onDeleteServerFile,
}: FilesPanelProps) {
  const files = useEditorStore((state) => state.files)
  const isHydrated = useEditorStore((state) => state.isHydrated)
  const serverConnected = useEditorStore((state) => state.serverConnected)
  const currentFileId = useEditorStore((state) => state.file?.id)
  const upsertFileInList = useEditorStore((state) => state.upsertFileInList)
  const showToast = useEditorStore((state) => state.showToast)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  const handleOpen = useCallback(
    async (id: string) => {
      const opened = await onOpenServerFile(id)
      if (opened) onClose()
    },
    [onOpenServerFile, onClose],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Delete this file? This cannot be undone.')) return
      const deleted = await onDeleteServerFile(id)
      if (deleted && renamingId === id) {
        setRenamingId(null)
      }
    },
    [onDeleteServerFile, renamingId],
  )

  const startRename = useCallback((id: string, name: string) => {
    setRenamingId(id)
    setRenameValue(name)
    setTimeout(() => renameInputRef.current?.focus(), 0)
  }, [])

  const commitRename = useCallback(
    async (id: string) => {
      const name = renameValue.trim()
      setRenamingId(null)
      if (!name) return

      try {
        const updated = await updateFile(id, { name })
        upsertFileInList({
          id: updated.id,
          name: updated.name,
          language: updated.language,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        })
        showToast('success', 'File renamed')
      } catch (error) {
        console.error('Failed to rename file:', error)
        showToast('error', 'Failed to rename file')
      }
    },
    [renameValue, upsertFileInList, showToast],
  )

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Server files"
    >
      <div
        className="w-[480px] max-w-[92vw] h-[70vh] flex flex-col bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
          <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-purple-400" aria-hidden="true" />
            Server Files
          </span>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close file panel"
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto min-h-0">
          {!serverConnected ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <p className="text-sm">Server is unreachable</p>
              <p className="text-xs text-zinc-600 mt-2 max-w-[260px]">
                Files are not available offline. You can still work with local
                files.
              </p>
            </div>
          ) : !isHydrated ? (
            <div className="h-full flex items-center justify-center text-zinc-500">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            </div>
          ) : files.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <FolderOpen className="w-12 h-12 mb-4 text-zinc-600" />
              <p className="text-sm text-zinc-400">No files yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Create a new file to get started
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {files.map((file) => (
                <li
                  key={file.id}
                  className={`mx-1 px-3 py-2 flex items-center gap-2 rounded-lg transition-colors ${
                    currentFileId === file.id
                      ? 'bg-purple-500/10'
                      : 'hover:bg-zinc-800/50'
                  }`}
                >
                  {renamingId === file.id ? (
                    <form
                      className="flex-1 flex items-center gap-2 min-w-0"
                      onSubmit={(e) => {
                        e.preventDefault()
                        commitRename(file.id)
                      }}
                    >
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 min-w-0 px-2 py-1 text-sm bg-zinc-800 border border-purple-500/50 rounded-md text-zinc-100 outline-none"
                        aria-label="File name"
                      />
                      <button
                        type="submit"
                        className="p-1.5 rounded-md text-emerald-400 hover:bg-zinc-800 transition-colors"
                        title="Save name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpen(file.id)}
                        className="flex-1 min-w-0 text-left"
                        title={`Open ${file.name}`}
                      >
                        <span className="block text-sm text-zinc-200 truncate">
                          {file.name}
                          {currentFileId === file.id && (
                            <span className="ml-2 text-[10px] text-purple-400 uppercase">
                              open
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          Updated {formatRelativeTime(file.updatedAt)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(file.id, file.name)}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(file.id)}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/80 shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onNewFile()
            }}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            New Server File
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenLocalFile()
              onClose()
            }}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
          >
            Open Local File...
          </button>
          <button
            type="button"
            onClick={() => {
              onImportUrl()
              onClose()
            }}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Import URL
          </button>
        </footer>
      </div>
    </div>
  )
}
