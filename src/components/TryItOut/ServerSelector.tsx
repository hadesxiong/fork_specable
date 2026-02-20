import { useMemo, useState, useRef, useEffect } from 'react'
import { ChevronDown, Globe, Edit3 } from 'lucide-react'
import type { OpenAPIV3 } from 'openapi-types'
import { useEditorStore } from '../../store'

interface ServerSelectorProps {
  spec: OpenAPIV3.Document
}

export function ServerSelector({ spec }: ServerSelectorProps) {
  const selectedServer = useEditorStore((state) => state.tryIt.selectedServer)
  const customServerUrl = useEditorStore((state) => state.tryIt.customServerUrl)
  const setTryItServer = useEditorStore((state) => state.setTryItServer)
  const setTryItCustomServer = useEditorStore(
    (state) => state.setTryItCustomServer,
  )

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const servers = useMemo(() => {
    return spec.servers ?? []
  }, [spec.servers])

  const isCustom = selectedServer === '__custom__'

  const displayValue = useMemo(() => {
    if (isCustom) {
      return customServerUrl || 'Enter custom URL...'
    }
    if (selectedServer) {
      return selectedServer
    }
    return servers[0]?.url ?? 'No server defined'
  }, [selectedServer, customServerUrl, servers, isCustom])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectServer = (url: string | null) => {
    setTryItServer(url)
    setIsOpen(false)
  }

  const handleSelectCustom = () => {
    setTryItServer('__custom__')
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
        Server
      </label>

      {isCustom ? (
        <div className="flex gap-2">
          <input
            type="url"
            value={customServerUrl}
            onChange={(e) => setTryItCustomServer(e.target.value)}
            placeholder="https://api.example.com"
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-200 font-mono placeholder-zinc-500 outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md hover:border-zinc-700 transition-colors"
            title="Select from spec servers"
          >
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-left hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <span className="text-sm text-zinc-200 truncate font-mono">
              {displayValue}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {/* Servers from spec */}
            {servers.length > 0 ? (
              servers.map((server) => (
                <button
                  key={server.url}
                  type="button"
                  onClick={() => handleSelectServer(server.url)}
                  className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                    selectedServer === server.url
                      ? 'bg-purple-500/20 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  <Globe className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">
                      {server.url}
                    </div>
                    {server.description && (
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        {server.description}
                      </div>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2.5 text-sm text-zinc-500">
                No servers defined in spec
              </div>
            )}

            {/* Custom URL option */}
            <div className="border-t border-zinc-800">
              <button
                type="button"
                onClick={handleSelectCustom}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                  isCustom
                    ? 'bg-purple-500/20 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`}
              >
                <Edit3 className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">Custom URL...</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
