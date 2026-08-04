import { useEffect } from 'react'
import { DocumentationView } from './DocumentationView'
import { useValidation } from '../../hooks/useValidation'
import { useEditorStore } from '../../store'

export function FullscreenPreview() {
  const fileName = useEditorStore((state) => state.file?.name ?? 'Untitled')
  const specTitle = useEditorStore((state) => state.parsedSpec?.info?.title)

  useValidation()

  useEffect(() => {
    document.title = specTitle ? `${specTitle} - Preview` : 'Specable Preview'
  }, [specTitle])

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      <header className="h-10 flex items-center justify-between px-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-zinc-100 tracking-tight font-mono font-bold text-sm">
            SPECABLE
          </span>
          <span className="text-zinc-500 text-sm truncate">{fileName}</span>
        </div>
        <span className="text-xs text-zinc-600">Preview mode</span>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">
        <DocumentationView />
      </main>
    </div>
  )
}
