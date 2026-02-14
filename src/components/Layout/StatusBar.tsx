import { useEditorStore } from '../../store';
import { AlertCircle, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface StatusBarProps {
  onDiagnosticsClick?: () => void;
}

export function StatusBar({ onDiagnosticsClick }: StatusBarProps) {
  const file = useEditorStore((state) => state.file);
  const isValidating = useEditorStore((state) => state.isValidating);
  const syntaxValid = useEditorStore((state) => state.syntaxValid);
  const schemaValid = useEditorStore((state) => state.schemaValid);
  const errors = useEditorStore((state) => state.errors);
  const warnings = useEditorStore((state) => state.warnings);
  const cursorLine = useEditorStore((state) => state.cursorLine);
  const cursorColumn = useEditorStore((state) => state.cursorColumn);
  const parsedSpec = useEditorStore((state) => state.parsedSpec);

  const errorCount = errors.length;
  const warningCount = warnings.length;
  const hasProblems = errorCount > 0 || warningCount > 0;
  const isValid = syntaxValid && schemaValid && errorCount === 0;

  const openApiVersion = parsedSpec?.openapi ?? '';

  return (
    <footer
      className="h-7 flex items-center justify-between px-4 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-500 select-none"
      role="status"
      aria-label="Editor status"
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* File info */}
        <span className="flex items-center gap-1.5 text-zinc-400" aria-label={`File: ${file?.name}${file?.isDirty ? ', unsaved changes' : ''}`}>
          {file?.name}
          {file?.isDirty && <span className="text-amber-500" aria-hidden="true">*</span>}
        </span>

        {/* Cursor position */}
        <span aria-label={`Line ${cursorLine}, Column ${cursorColumn}`}>
          Ln {cursorLine}, Col {cursorColumn}
        </span>
      </div>

      {/* Centre section - validation status */}
      <div className="flex items-center gap-2" aria-live="polite">
        {isValidating ? (
          <span className="flex items-center gap-1.5 text-purple-400" role="status">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Validating...
          </span>
        ) : hasProblems ? (
          <button
            onClick={onDiagnosticsClick}
            className="flex items-center gap-3 hover:bg-zinc-800 px-2 py-0.5 rounded transition-colors"
            aria-label={`Show problems: ${errorCount} ${errorCount === 1 ? 'error' : 'errors'}, ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`}
          >
            {errorCount > 0 && (
              <span className="flex items-center gap-1.5 text-red-400">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                {warningCount}
              </span>
            )}
          </button>
        ) : isValid ? (
          <span className="flex items-center gap-1.5 text-emerald-400" role="status">
            <CheckCircle className="w-3 h-3" aria-hidden="true" />
            Valid
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-red-400" role="status">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            Invalid
          </span>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Language */}
        <span className="uppercase tracking-wide" aria-label={`Language: ${file?.language ?? 'yaml'}`}>
          {file?.language ?? 'yaml'}
        </span>

        {/* OpenAPI version */}
        {openApiVersion && (
          <span className="text-zinc-400" aria-label={`OpenAPI version ${openApiVersion}`}>OpenAPI {openApiVersion}</span>
        )}
      </div>
    </footer>
  );
}
