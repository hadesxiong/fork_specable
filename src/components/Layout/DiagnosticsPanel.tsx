import { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, X, GripHorizontal, Download } from 'lucide-react';
import { useEditorStore, type ValidationError } from '../../store';

type FilterType = 'all' | 'errors' | 'warnings';

interface DiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  height: number;
  onResizeStart: (e: React.MouseEvent) => void;
}

const SEVERITY_ICONS = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOURS = {
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-purple-400',
};

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'errors', label: 'Errors' },
  { value: 'warnings', label: 'Warnings' },
];

export function DiagnosticsPanel({ isOpen, onClose, height, onResizeStart }: DiagnosticsPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const errors = useEditorStore((state) => state.errors);
  const warnings = useEditorStore((state) => state.warnings);
  const goToLine = useEditorStore((state) => state.goToLine);

  const allDiagnostics = [
    ...errors.map((e) => ({ ...e, severity: e.severity || 'error' as const })),
    ...warnings.map((w) => ({ ...w, severity: w.severity || 'warning' as const })),
  ].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const filteredDiagnostics = allDiagnostics.filter((diagnostic) => {
    if (filter === 'all') return true;
    if (filter === 'errors') return diagnostic.severity === 'error';
    if (filter === 'warnings') return diagnostic.severity === 'warning' || diagnostic.severity === 'info';
    return true;
  });

  const handleDiagnosticClick = (diagnostic: ValidationError) => {
    goToLine(diagnostic.line, diagnostic.column);
  };

  const handleExport = () => {
    const exportData = filteredDiagnostics.map((d) => ({
      severity: d.severity,
      message: d.message,
      line: d.line,
      column: d.column,
      path: d.path,
      rule: d.rule,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diagnostics.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <section
      className="absolute bottom-7 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-900 shadow-lg flex flex-col"
      style={{ height }}
      aria-label="Problems panel"
      role="region"
    >
      {/* Resize handle */}
      <div
        className="h-1.5 cursor-row-resize flex items-center justify-center hover:bg-purple-500/20 transition-colors group"
        onMouseDown={onResizeStart}
        role="separator"
        aria-label="Resize problems panel"
      >
        <GripHorizontal className="w-4 h-3 text-zinc-700 group-hover:text-purple-400" aria-hidden="true" />
      </div>

      {/* Header */}
      <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <h2 id="diagnostics-heading" className="text-xs font-medium text-zinc-300">
            Problems ({filteredDiagnostics.length}{filter !== 'all' ? ` of ${allDiagnostics.length}` : ''})
          </h2>
          <div className="flex items-center gap-1" role="group" aria-label="Filter problems">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  filter === option.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
                aria-pressed={filter === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            disabled={filteredDiagnostics.length === 0}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Export problems as JSON"
            title="Export as JSON"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            aria-label="Close problems panel"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Diagnostics list */}
      <ul
        className="flex-1 overflow-y-auto"
        aria-labelledby="diagnostics-heading"
        role="list"
      >
        {filteredDiagnostics.length === 0 ? (
          <li className="px-4 py-6 text-sm text-zinc-600 text-center" role="status">
            {allDiagnostics.length === 0 ? 'No problems detected' : 'No matching problems'}
          </li>
        ) : (
          filteredDiagnostics.map((diagnostic, index) => {
            const Icon = SEVERITY_ICONS[diagnostic.severity];
            const colourClass = SEVERITY_COLOURS[diagnostic.severity];

            return (
              <li
                key={`${diagnostic.line}-${diagnostic.column}-${index}`}
                className="border-b border-zinc-800/50 last:border-b-0"
              >
                <button
                  onClick={() => handleDiagnosticClick(diagnostic)}
                  className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-zinc-800/50 text-left transition-colors"
                  aria-label={`${diagnostic.severity}: ${diagnostic.message} at line ${diagnostic.line}, column ${diagnostic.column}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${colourClass}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-300 break-words leading-relaxed">
                      {diagnostic.message}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                      <span>Ln {diagnostic.line}, Col {diagnostic.column}</span>
                      {diagnostic.path && (
                        <span className="font-mono truncate text-zinc-600">{diagnostic.path}</span>
                      )}
                      {diagnostic.rule && (
                        <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">
                          {diagnostic.rule}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
