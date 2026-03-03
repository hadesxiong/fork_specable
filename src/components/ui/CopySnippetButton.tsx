import { useState, useCallback, useRef } from 'react'
import { Code, Check, ChevronDown } from 'lucide-react'
import {
  generateSnippet,
  type SnippetRequest,
  type SnippetFormat,
} from '../../services/code-snippet-generator'
import { useClickOutside } from '../../hooks/useClickOutside'

const FORMATS: { id: SnippetFormat; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'fetch', label: 'fetch' },
  { id: 'python', label: 'Python' },
]

interface CopySnippetButtonProps {
  buildRequest: () => SnippetRequest
  /** 'icon' renders a compact icon button (used in docs preview).
   *  'button' renders a larger button with chevron (used in TryItOut). */
  variant?: 'icon' | 'button'
}

export function CopySnippetButton({
  buildRequest,
  variant = 'icon',
}: CopySnippetButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState<SnippetFormat | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useClickOutside(
    [menuRef, buttonRef],
    useCallback(() => setIsOpen(false), []),
  )

  const handleCopy = useCallback(
    (format: SnippetFormat) => {
      const request = buildRequest()
      const snippet = generateSnippet(request, format)
      navigator.clipboard.writeText(snippet)
      setCopied(format)
      setTimeout(() => {
        setCopied(null)
        setIsOpen(false)
      }, 1200)
    },
    [buildRequest],
  )

  const isIcon = variant === 'icon'

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          if (isIcon) e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={
          isIcon
            ? 'p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 rounded transition-colors'
            : 'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors'
        }
        aria-label="Copy as code snippet"
        title={isIcon ? 'Copy as code snippet' : undefined}
        aria-expanded={isOpen}
      >
        {isIcon ? (
          copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Code className="w-3.5 h-3.5" />
          )
        ) : (
          <>
            <Code className="w-4 h-4" />
            <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className={
            isIcon
              ? 'absolute top-full mt-1 right-0 w-36 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-20'
              : 'absolute bottom-full mb-1 left-0 w-36 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-20'
          }
          onClick={isIcon ? (e) => e.stopPropagation() : undefined}
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
