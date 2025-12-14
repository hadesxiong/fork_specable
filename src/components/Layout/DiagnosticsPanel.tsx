import { AlertCircle, AlertTriangle, Info, X, GripHorizontal } from 'lucide-react';
import { useEditorStore, type ValidationError } from '../../store';

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
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-400',
};

export function DiagnosticsPanel({ isOpen, onClose, height, onResizeStart }: DiagnosticsPanelProps) {
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

  const handleDiagnosticClick = (diagnostic: ValidationError) => {
    goToLine(diagnostic.line, diagnostic.column);
  };

  if (!isOpen) return null;

  return (
    <section
      className="absolute bottom-6 left-0 right-0 z-40 border-t border-zinc-700 bg-zinc-900 shadow-lg flex flex-col"
      style={{ height }}
      aria-label="Problems panel"
      role="region"
    >
      {/* Resize handle */}
      <div
        className="h-1.5 cursor-row-resize flex items-center justify-center hover:bg-blue-500/30 transition-colors group"
        onMouseDown={onResizeStart}
        role="separator"
        aria-label="Resize problems panel"
      >
        <GripHorizontal className="w-4 h-3 text-zinc-600 group-hover:text-blue-400" aria-hidden="true" />
      </div>

      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-zinc-700 shrink-0">
        <h2 id="diagnostics-heading" className="text-xs font-medium text-zinc-200">
          Problems ({allDiagnostics.length})
        </h2>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-zinc-700 text-zinc-400"
          aria-label="Close problems panel"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Diagnostics list */}
      <ul
        className="flex-1 overflow-y-auto"
        aria-labelledby="diagnostics-heading"
        role="list"
      >
        {allDiagnostics.length === 0 ? (
          <li className="px-3 py-4 text-xs text-zinc-500 text-center" role="status">
            No problems detected
          </li>
        ) : (
          allDiagnostics.map((diagnostic, index) => {
            const Icon = SEVERITY_ICONS[diagnostic.severity];
            const colourClass = SEVERITY_COLOURS[diagnostic.severity];

            return (
              <li
                key={`${diagnostic.line}-${diagnostic.column}-${index}`}
                className="border-b border-zinc-800 last:border-b-0"
              >
                <button
                  onClick={() => handleDiagnosticClick(diagnostic)}
                  className="w-full px-3 py-2 flex items-start gap-2 hover:bg-zinc-800 text-left transition-colors"
                  aria-label={`${diagnostic.severity}: ${diagnostic.message} at line ${diagnostic.line}, column ${diagnostic.column}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${colourClass}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-zinc-200 break-words">
                      {diagnostic.message}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
                      <span>Ln {diagnostic.line}, Col {diagnostic.column}</span>
                      {diagnostic.path && (
                        <span className="font-mono truncate">{diagnostic.path}</span>
                      )}
                      {diagnostic.rule && (
                        <span className="px-1 py-0.5 bg-zinc-800 rounded">
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
