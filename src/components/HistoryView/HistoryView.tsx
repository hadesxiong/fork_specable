import { useCallback } from 'react'
import { Clock, RotateCcw, Trash2, Plus } from 'lucide-react'
import { useEditorStore } from '../../store'
import { useVersionHistory } from '../../hooks/useVersionHistory'
import { HistoryDiff } from './HistoryDiff'
import { formatRelativeTime, formatTime } from '../../utils/time'

export function HistoryView() {
  const file = useEditorStore((state) => state.file)
  const versionHistory = useEditorStore((state) => state.versionHistory)
  const selectedSnapshotId = useEditorStore((state) => state.selectedSnapshotId)
  const isHistoryLoading = useEditorStore((state) => state.isHistoryLoading)
  const setSelectedSnapshot = useEditorStore(
    (state) => state.setSelectedSnapshot,
  )

  const { createSnapshot, deleteSnapshot, restoreSnapshot } =
    useVersionHistory()

  const handleCreateSnapshot = useCallback(async () => {
    await createSnapshot('Manual snapshot')
  }, [createSnapshot])

  const handleRestoreSnapshot = useCallback(
    async (id: string) => {
      await restoreSnapshot(id)
      setSelectedSnapshot(null)
    },
    [restoreSnapshot, setSelectedSnapshot],
  )

  const handleDeleteSnapshot = useCallback(
    async (id: string, event: React.MouseEvent) => {
      event.stopPropagation()
      await deleteSnapshot(id)
    },
    [deleteSnapshot],
  )

  const selectedSnapshot = versionHistory.find(
    (s) => s.id === selectedSnapshotId,
  )

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        No file open
      </div>
    )
  }

  if (file.source !== 'server') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 p-6 text-center">
        <Clock className="w-12 h-12 mb-4 text-zinc-600" />
        <p className="text-sm">
          Version history is only available for server files
        </p>
        <p className="text-xs text-zinc-600 mt-1">
          Save the file to the server to enable version history
        </p>
      </div>
    )
  }

  if (isHistoryLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <div className="flex items-center gap-2 text-zinc-400">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading history...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <header className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Version History
        </span>
        <button
          onClick={handleCreateSnapshot}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          title="Create snapshot"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Snapshot list */}
        <div
          className={`overflow-auto ${selectedSnapshot ? 'h-48 flex-shrink-0 border-b border-zinc-800' : 'flex-1'}`}
        >
          {versionHistory.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-4">
              <Clock className="w-12 h-12 mb-4 text-zinc-600" />
              <p className="text-sm text-center">No snapshots yet</p>
              <p className="text-xs text-zinc-600 mt-1 text-center">
                Click the + button or use the command palette to create a
                snapshot
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {versionHistory.map((snapshot) => (
                <li
                  key={snapshot.id}
                  onClick={() =>
                    setSelectedSnapshot(
                      selectedSnapshotId === snapshot.id ? null : snapshot.id,
                    )
                  }
                  className={`mx-1 px-3 py-2 flex items-center justify-between cursor-pointer rounded-lg transition-colors ${
                    selectedSnapshotId === snapshot.id
                      ? 'bg-purple-500/20 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 flex-shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <div className="text-sm truncate">
                        {snapshot.label ||
                          formatRelativeTime(snapshot.timestamp)}
                      </div>
                      <time
                        dateTime={new Date(snapshot.timestamp).toISOString()}
                        className="block text-xs text-zinc-500"
                      >
                        {formatTime(snapshot.timestamp)}
                        {snapshot.label && (
                          <span className="ml-2">
                            {formatRelativeTime(snapshot.timestamp)}
                          </span>
                        )}
                      </time>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRestoreSnapshot(snapshot.id)
                      }}
                      className="p-1.5 rounded-md text-zinc-500 hover:text-purple-400 hover:bg-zinc-800 transition-colors"
                      title="Restore this version"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSnapshot(snapshot.id, e)}
                      className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                      title="Delete this snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Diff view when snapshot selected */}
        {selectedSnapshot && (
          <div className="flex-1 overflow-auto min-h-0 border-t border-zinc-800">
            <header className="px-3 py-2 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Changes from{' '}
                <span className="text-zinc-300">
                  {selectedSnapshot.label ||
                    formatRelativeTime(selectedSnapshot.timestamp)}
                </span>
              </span>
              <button
                onClick={() => handleRestoreSnapshot(selectedSnapshot.id)}
                className="px-2 py-1 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Restore
              </button>
            </header>
            <HistoryDiff
              oldContent={selectedSnapshot.content}
              newContent={file.content}
            />
          </div>
        )}
      </div>
    </div>
  )
}
