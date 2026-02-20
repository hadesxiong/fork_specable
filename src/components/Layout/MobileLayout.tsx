import { useState } from 'react'
import { Code, FileText } from 'lucide-react'
import { Editor } from '../Editor'
import { DocumentationView } from '../Preview'
import { MobileStatusBar } from './MobileStatusBar'

type ActivePanel = 'editor' | 'preview'

interface MobileLayoutProps {
  onShowAbout: () => void
}

export function MobileLayout({ onShowAbout }: MobileLayoutProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>('editor')

  return (
    <div className="h-screen flex flex-col bg-zinc-950 relative">
      <header className="h-14 flex items-center justify-between px-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <button
          onClick={() => setActivePanel('editor')}
          className={`p-3 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center ${
            activePanel === 'editor'
              ? 'bg-purple-500/20 text-purple-400'
              : 'text-zinc-500'
          }`}
          aria-label="Show editor"
          aria-pressed={activePanel === 'editor'}
        >
          <Code className="w-5 h-5" />
        </button>

        <button
          onClick={onShowAbout}
          type="button"
          aria-label="About Specable"
          className="text-zinc-100 font-mono font-bold text-lg hover:text-purple-400 transition-colors py-2"
        >
          SPECABLE
        </button>

        <button
          onClick={() => setActivePanel('preview')}
          className={`p-3 rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center ${
            activePanel === 'preview'
              ? 'bg-purple-500/20 text-purple-400'
              : 'text-zinc-500'
          }`}
          aria-label="Show documentation"
          aria-pressed={activePanel === 'preview'}
        >
          <FileText className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {activePanel === 'editor' ? <Editor /> : <DocumentationView />}
      </main>

      <MobileStatusBar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
      />
    </div>
  )
}
