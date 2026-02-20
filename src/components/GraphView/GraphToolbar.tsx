import { useEditorStore, type GraphFilter } from '../../store'

interface GraphToolbarProps {
  includeEndpoints: boolean
  onToggleEndpoints: (include: boolean) => void
  nodeCount: number
  edgeCount: number
  isLoading: boolean
}

const FILTER_OPTIONS: { value: GraphFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'referenced', label: 'Referenced' },
  { value: 'orphaned', label: 'Orphaned' },
]

export function GraphToolbar({
  includeEndpoints,
  onToggleEndpoints,
  nodeCount,
  edgeCount,
  isLoading,
}: GraphToolbarProps) {
  const graphFilter = useEditorStore((state) => state.graphFilter)
  const setGraphFilter = useEditorStore((state) => state.setGraphFilter)

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="graph-filter" className="text-xs text-zinc-500">
            Filter:
          </label>
          <select
            id="graph-filter"
            value={graphFilter}
            onChange={(e) => setGraphFilter(e.target.value as GraphFilter)}
            className="px-2 py-1 text-xs bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-md outline-none focus:border-purple-500 transition-colors cursor-pointer"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeEndpoints}
            onChange={(e) => onToggleEndpoints(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-purple-600 focus:ring-purple-600 focus:ring-offset-zinc-900"
          />
          <span>Show endpoints</span>
        </label>
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        {!isLoading && (
          <>
            <span>{nodeCount} nodes</span>
            <span>{edgeCount} edges</span>
          </>
        )}
      </div>
    </div>
  )
}
