import { useMemo, useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import Fuse from 'fuse.js';
import type { OpenAPIV3 } from 'openapi-types';
import { useEditorStore } from '../../store';

const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
  get: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  post: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  put: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  patch: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  delete: { bg: 'bg-red-500/15', text: 'text-red-400' },
  options: { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
  head: { bg: 'bg-zinc-500/15', text: 'text-zinc-400' },
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

interface OperationItem {
  id: string;
  method: string;
  path: string;
  summary?: string;
  operationId?: string;
  tags?: string[];
}

interface OperationSelectorProps {
  spec: OpenAPIV3.Document;
}

export function OperationSelector({ spec }: OperationSelectorProps) {
  const selectedOperationId = useEditorStore((state) => state.tryIt.selectedOperationId);
  const setTryItOperation = useEditorStore((state) => state.setTryItOperation);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const operations = useMemo(() => {
    const ops: OperationItem[] = [];

    if (!spec.paths) return ops;

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem) continue;

      for (const method of HTTP_METHODS) {
        const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
        if (!operation) continue;

        ops.push({
          id: `paths.${path}.${method}`,
          method: method.toUpperCase(),
          path,
          summary: operation.summary,
          operationId: operation.operationId,
          tags: operation.tags,
        });
      }
    }

    return ops;
  }, [spec.paths]);

  const fuse = useMemo(() => {
    return new Fuse(operations, {
      keys: ['path', 'method', 'summary', 'operationId'],
      threshold: 0.4,
    });
  }, [operations]);

  const filteredOperations = useMemo(() => {
    if (!searchQuery.trim()) return operations;
    return fuse.search(searchQuery).map((result) => result.item);
  }, [operations, fuse, searchQuery]);

  const selectedOperation = useMemo(() => {
    return operations.find((op) => op.id === selectedOperationId);
  }, [operations, selectedOperationId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (op: OperationItem) => {
    setTryItOperation(op.id);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
        Operation
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-left hover:border-zinc-700 transition-colors"
      >
        {selectedOperation ? (
          <div className="flex items-center gap-2 min-w-0">
            <MethodBadge method={selectedOperation.method} />
            <span className="text-sm text-zinc-200 truncate font-mono">
              {selectedOperation.path}
            </span>
          </div>
        ) : (
          <span className="text-sm text-zinc-500">Select an operation...</span>
        )}
        <ChevronDown className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search operations..."
                className="w-full pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Operations List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOperations.length === 0 ? (
              <div className="px-3 py-4 text-sm text-zinc-500 text-center">
                No operations found
              </div>
            ) : (
              filteredOperations.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => handleSelect(op)}
                  className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors ${
                    op.id === selectedOperationId
                      ? 'bg-purple-500/20 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  <MethodBadge method={op.method} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">{op.path}</div>
                    {op.summary && (
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        {op.summary}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const style = METHOD_STYLES[method.toLowerCase()] ?? METHOD_STYLES.get;
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${style.bg} ${style.text}`}>
      {method}
    </span>
  );
}
