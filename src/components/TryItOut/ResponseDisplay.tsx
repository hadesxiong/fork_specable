import { useState, useMemo } from 'react'
import { ChevronDown, Copy, Check, AlertTriangle } from 'lucide-react'
import type { TryItResponse } from '../../store'

interface ResponseDisplayProps {
  response: TryItResponse
}

export function ResponseDisplay({ response }: ResponseDisplayProps) {
  const [showHeaders, setShowHeaders] = useState(false)
  const [copied, setCopied] = useState(false)

  const statusClass = useMemo(() => {
    if (response.status === 0) return 'text-red-400'
    if (response.status >= 200 && response.status < 300)
      return 'text-emerald-400'
    if (response.status >= 400 && response.status < 500) return 'text-amber-400'
    if (response.status >= 500) return 'text-red-400'
    return 'text-zinc-400'
  }, [response.status])

  const formattedBody = useMemo(() => {
    if (!response.body) return ''

    try {
      const parsed = JSON.parse(response.body)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return response.body
    }
  }, [response.body])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedBody || response.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  const headerEntries = Object.entries(response.headers)

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Status Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${statusClass}`}>
            {response.status === 0 ? 'Error' : response.status}{' '}
            {response.statusText}
          </span>
          <span className="text-xs text-zinc-500">
            {response.responseTimeMs}ms
          </span>
        </div>
        {formattedBody && (
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy
              </>
            )}
          </button>
        )}
      </div>

      {/* CORS Error Message */}
      {response.isCorsError && (
        <div className="px-3 py-3 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-200">
              <p className="font-medium mb-1">CORS Error</p>
              <p className="text-xs text-red-300/80">
                The server did not include the required CORS headers. To test
                this API:
              </p>
              <ul className="text-xs text-red-300/80 mt-1 ml-4 list-disc space-y-0.5">
                <li>Configure the API server to allow cross-origin requests</li>
                <li>
                  Use a browser extension to disable CORS (development only)
                </li>
                <li>Run a local proxy server</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Generic Error Message */}
      {response.error && !response.isCorsError && (
        <div className="px-3 py-3 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-200">
              <p className="font-medium">Request Failed</p>
              <p className="text-xs text-red-300/80 mt-1">{response.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Headers (collapsible) */}
      {headerEntries.length > 0 && (
        <div className="border-b border-zinc-800">
          <button
            type="button"
            onClick={() => setShowHeaders(!showHeaders)}
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-800/30 transition-colors"
          >
            <span className="text-xs font-medium text-zinc-400">
              Headers ({headerEntries.length})
            </span>
            <ChevronDown
              className={`w-4 h-4 text-zinc-500 transition-transform ${showHeaders ? 'rotate-180' : ''}`}
            />
          </button>
          {showHeaders && (
            <div className="px-3 pb-2 space-y-1">
              {headerEntries.map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs font-mono">
                  <span className="text-zinc-500">{key}:</span>
                  <span className="text-zinc-300 break-all">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      {formattedBody && (
        <div className="p-3">
          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-80">
            {formattedBody}
          </pre>
        </div>
      )}

      {/* Empty body */}
      {!formattedBody && !response.error && (
        <div className="px-3 py-4 text-xs text-zinc-500 text-center">
          No response body
        </div>
      )}
    </div>
  )
}
