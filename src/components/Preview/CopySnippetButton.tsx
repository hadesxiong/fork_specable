import { useState, useCallback, useRef, useEffect } from 'react'
import { Code, Check } from 'lucide-react'
import type { OpenAPIV3 } from 'openapi-types'
import {
  generateSnippet,
  buildSnippetFromOperation,
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
  operation: OpenAPIV3.OperationObject
  spec: OpenAPIV3.Document
}

export function CopySnippetButton({
  method,
  path,
  operation,
  spec,
}: CopySnippetButtonProps) {
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
      const request = buildSnippetFromOperation(method, path, operation, spec)
      const snippet = generateSnippet(request, format)
      navigator.clipboard.writeText(snippet)
      setCopied(format)
      setTimeout(() => {
        setCopied(null)
        setIsOpen(false)
      }, 1200)
    },
    [method, path, operation, spec],
  )

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
        aria-label="Copy as code snippet"
        title="Copy as code snippet"
        aria-expanded={isOpen}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Code className="w-3.5 h-3.5" />
        )}
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-full mt-1 right-0 w-36 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-20"
          onClick={(e) => e.stopPropagation()}
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
