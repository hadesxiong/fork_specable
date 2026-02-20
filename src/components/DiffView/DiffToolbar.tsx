import { useEditorStore, type DiffFilter, type DiffResult } from '../../store'
import { generateChangelog } from '../../services/diff-engine'

interface DiffToolbarProps {
  comparisonName: string
  onClear: () => void
  diffResult: DiffResult | null
}

const FILTER_OPTIONS: { value: DiffFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'breaking', label: 'Breaking' },
  { value: 'non-breaking', label: 'Non-breaking' },
]

export function DiffToolbar({
  comparisonName,
  onClear,
  diffResult,
}: DiffToolbarProps) {
  const diffFilter = useEditorStore((state) => state.diffFilter)
  const setDiffFilter = useEditorStore((state) => state.setDiffFilter)

  const handleExport = () => {
    if (!diffResult) return

    const changelog = generateChangelog(diffResult)
    const blob = new Blob([changelog], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `changelog-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Comparing:</span>
          <span className="text-xs text-zinc-300 font-mono bg-zinc-800 px-2 py-0.5 rounded">
            {comparisonName}
          </span>
          <button
            onClick={onClear}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Clear comparison"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Filter:</span>
          <div className="flex rounded-md overflow-hidden border border-zinc-700">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setDiffFilter(option.value)}
                className={`px-2 py-1 text-xs transition-colors ${
                  diffFilter === option.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {diffResult && (
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Export changelog as Markdown"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export
        </button>
      )}
    </div>
  )
}
