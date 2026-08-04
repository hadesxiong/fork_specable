import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditorStore } from '../../store'
import type {
  DiffWorkerApi,
  DiffComputeResult,
  ValidationResult,
  DiffChange,
} from '../../workers/types'
import { DiffToolbar } from './DiffToolbar'
import { DiffSummary } from './DiffSummary'
import { DiffList } from './DiffList'
import { createLazyWorker } from '../../services/worker-factory'
import { getValidatorWorker } from '../../services/shared-workers'
import { getFile } from '../../services/api'

const getDiffWorker = createLazyWorker<DiffWorkerApi>(
  () =>
    new Worker(new URL('../../workers/diff.worker.ts', import.meta.url), {
      type: 'module',
    }),
)

export function DiffView() {
  const parsedSpec = useEditorStore((state) => state.parsedSpec)
  const sourceMap = useEditorStore((state) => state.sourceMap)
  const comparisonSpec = useEditorStore((state) => state.comparisonSpec)
  const diffResult = useEditorStore((state) => state.diffResult)
  const diffFilter = useEditorStore((state) => state.diffFilter)
  const isDiffLoading = useEditorStore((state) => state.isDiffLoading)
  const setComparisonSpec = useEditorStore((state) => state.setComparisonSpec)
  const setDiffResult = useEditorStore((state) => state.setDiffResult)
  const setDiffLoading = useEditorStore((state) => state.setDiffLoading)
  const clearComparison = useEditorStore((state) => state.clearComparison)
  const goToLine = useEditorStore((state) => state.goToLine)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const files = useEditorStore((state) => state.files)
  const [selectedComparisonFileId, setSelectedComparisonFileId] = useState('')

  const handleFileSelect = useCallback(
    async (file: File) => {
      setDiffLoading(true)

      try {
        const content = await file.text()
        const validator = getValidatorWorker()
        const result: ValidationResult = await validator.validate(content)

        if (!result.syntaxValid || !result.parsedSpec) {
          throw new Error('Invalid OpenAPI specification')
        }

        setComparisonSpec({
          content,
          parsed: result.parsedSpec,
          sourceMap: result.sourceMap,
          name: file.name,
        })
      } catch (error) {
        console.error('Failed to load comparison file:', error)
        setComparisonSpec(null)
      } finally {
        setDiffLoading(false)
      }
    },
    [setComparisonSpec, setDiffLoading],
  )

  const handleServerFileSelect = useCallback(async () => {
    if (!selectedComparisonFileId) return
    setDiffLoading(true)

    try {
      const serverFile = await getFile(selectedComparisonFileId)
      const validator = getValidatorWorker()
      const result: ValidationResult = await validator.validate(
        serverFile.content,
      )

      if (!result.syntaxValid || !result.parsedSpec) {
        throw new Error('Invalid OpenAPI specification')
      }

      setComparisonSpec({
        content: serverFile.content,
        parsed: result.parsedSpec,
        sourceMap: result.sourceMap,
        name: serverFile.name,
      })
    } catch (error) {
      console.error('Failed to load comparison file:', error)
      setComparisonSpec(null)
    } finally {
      setDiffLoading(false)
    }
  }, [selectedComparisonFileId, setComparisonSpec, setDiffLoading])

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        handleFileSelect(file)
      }
      event.target.value = ''
    },
    [handleFileSelect],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const file = event.dataTransfer.files[0]
      if (file) {
        handleFileSelect(file)
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  useEffect(() => {
    if (!parsedSpec || !comparisonSpec?.parsed) {
      setDiffResult(null)
      return
    }

    const computeDiff = async () => {
      setDiffLoading(true)
      try {
        const worker = getDiffWorker()
        const result: DiffComputeResult = await worker.computeDiff(
          comparisonSpec.parsed,
          parsedSpec,
        )
        setDiffResult(result.result)
      } catch (error) {
        console.error('Diff computation error:', error)
        setDiffResult(null)
      } finally {
        setDiffLoading(false)
      }
    }

    computeDiff()
  }, [parsedSpec, comparisonSpec?.parsed, setDiffResult, setDiffLoading])

  const handleChangeClick = useCallback(
    (jsonPath: string) => {
      const position = sourceMap[jsonPath]
      if (position) {
        goToLine(position.line, position.column)
      }
    },
    [sourceMap, goToLine],
  )

  const filteredChanges = diffResult
    ? filterChanges(diffResult.changes, diffFilter)
    : []

  if (!parsedSpec) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        No valid specification to compare
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {comparisonSpec && (
        <DiffToolbar
          comparisonName={comparisonSpec.name}
          onClear={clearComparison}
          diffResult={diffResult}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json"
        onChange={handleFileInputChange}
        className="hidden"
      />

      <div
        className="flex-1 overflow-auto min-h-0"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {!comparisonSpec ? (
          <div
            className="h-full p-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors">
              <svg
                className="w-12 h-12 mb-4 text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm">Drop a file here, or click to select</p>
              <p className="text-xs text-zinc-600 mt-1">
                Compares against the current specification
              </p>
              {files.length > 0 && (
                <div
                  className="mt-5 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <select
                    value={selectedComparisonFileId}
                    onChange={(e) =>
                      setSelectedComparisonFileId(e.target.value)
                    }
                    className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 outline-none focus:border-purple-500"
                    aria-label="Choose a server file"
                  >
                    <option value="">Server file...</option>
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleServerFileSelect}
                    disabled={!selectedComparisonFileId}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    Compare
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : isDiffLoading ? (
          <div className="h-full flex items-center justify-center">
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
              <span>Computing differences...</span>
            </div>
          </div>
        ) : diffResult ? (
          <div className="p-4 space-y-4">
            <DiffSummary summary={diffResult.summary} />
            {filteredChanges.length > 0 ? (
              <DiffList
                changes={filteredChanges}
                onChangeClick={handleChangeClick}
              />
            ) : (
              <div className="text-center text-zinc-500 py-8">
                {diffFilter !== 'all'
                  ? 'No changes match the current filter'
                  : 'No differences found'}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function filterChanges(
  changes: DiffChange[],
  filter: 'all' | 'breaking' | 'non-breaking',
): DiffChange[] {
  if (filter === 'all') return changes
  if (filter === 'breaking') return changes.filter((c) => c.breaking)
  return changes.filter((c) => !c.breaking)
}
