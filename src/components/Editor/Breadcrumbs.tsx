import { useMemo, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { useEditorStore } from '../../store'

export function Breadcrumbs() {
  const currentPath = useEditorStore((state) => state.currentPath)
  const sourceMap = useEditorStore((state) => state.sourceMap)
  const goToLine = useEditorStore((state) => state.goToLine)

  const segments = useMemo(() => {
    if (!currentPath) return []
    return currentPath.split('.')
  }, [currentPath])

  const handleSegmentClick = useCallback(
    (segmentIndex: number) => {
      const partialPath = segments.slice(0, segmentIndex + 1).join('.')
      const position = sourceMap[partialPath]
      if (position) {
        goToLine(position.line, position.column)
      }
    },
    [segments, sourceMap, goToLine],
  )

  if (segments.length === 0) {
    return (
      <div className="h-7 flex items-center px-3 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-600 font-mono">spec</span>
      </div>
    )
  }

  return (
    <div className="h-7 flex items-center px-3 bg-zinc-900 border-b border-zinc-800 overflow-x-auto">
      <nav
        className="flex items-center gap-0.5 min-w-0"
        aria-label="Breadcrumb"
      >
        {segments.map((segment, index) => (
          <span key={index} className="flex items-center gap-0.5 shrink-0">
            {index > 0 && (
              <ChevronRight
                className="w-3 h-3 text-zinc-600"
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={() => handleSegmentClick(index)}
              className={`text-xs font-mono px-1 py-0.5 rounded hover:bg-zinc-800 transition-colors ${
                index === segments.length - 1
                  ? 'text-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {segment}
            </button>
          </span>
        ))}
      </nav>
    </div>
  )
}
