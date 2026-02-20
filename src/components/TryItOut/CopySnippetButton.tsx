import { useState, useCallback, useRef, useEffect } from 'react'
import { Code, Check, ChevronDown } from 'lucide-react'
import { useEditorStore } from '../../store'
import {
  generateSnippet,
  buildSnippetFromTryIt,
  type SnippetFormat,
} from '../../services/code-snippet-generator'

const FORMATS: { id: SnippetFormat; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'fetch', label: 'fetch' },
  { id: 'python', label: 'Python' },
]

interface CopySnippetButtonProps {
  method: string
  path: string
  serverUrl: string
}

export function CopySnippetButton({
  method,
  path,
  serverUrl,
}: CopySnippetButtonProps) {
  const tryIt = useEditorStore((state) => state.tryIt)
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState<SnippetFormat | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopy = useCallback(
    (format: SnippetFormat) => {
      const request = buildSnippetFromTryIt({
        method,
        baseUrl: serverUrl,
        path,
        parameterValues: tryIt.parameterValues,
        body: tryIt.requestBody || undefined,
        contentType: tryIt.requestContentType,
        auth: tryIt.authConfig,
      })

      const snippet = generateSnippet(request, format)
      navigator.clipboard.writeText(snippet)
      setCopied(format)
      setTimeout(() => {
        setCopied(null)
        setIsOpen(false)
      }, 1200)
    },
    [method, path, serverUrl, tryIt],
  )

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
        aria-label="Copy as code snippet"
        aria-expanded={isOpen}
      >
        <Code className="w-4 h-4" />
        <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full mb-1 left-0 w-36 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-20"
        >
          <div className="p-1">
            {FORMATS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleCopy(id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded transition-colors text-left"
              >
                {copied === id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-3.5" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
