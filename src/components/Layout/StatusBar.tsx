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
  const editorView = useEditorStore((state) => state.editorView);
  const parsedSpec = useEditorStore((state) => state.parsedSpec);

  const cursorPosition = editorView?.state.selection.main.head ?? 0;
  const line = editorView?.state.doc.lineAt(cursorPosition);
  const lineNumber = line?.number ?? 1;
  const columnNumber = line ? cursorPosition - line.from + 1 : 1;

  const errorCount = errors.length;
  const warningCount = warnings.length;
  const isValid = syntaxValid && schemaValid && errorCount === 0;

  const openApiVersion = parsedSpec?.openapi ?? '';

  return (
    <footer
      className="h-6 flex items-center justify-between px-3 bg-zinc-900 border-t border-zinc-700 text-xs text-zinc-400 select-none"
      role="status"
      aria-label="Editor status"
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* File info */}
        <span className="flex items-center gap-1" aria-label={`File: ${file?.name}${file?.isDirty ? ', unsaved changes' : ''}`}>
          {file?.name}
          {file?.isDirty && <span className="text-yellow-500" aria-hidden="true">*</span>}
        </span>

        {/* Cursor position */}
        <span aria-label={`Line ${lineNumber}, Column ${columnNumber}`}>
          Ln {lineNumber}, Col {columnNumber}
        </span>
      </div>

      {/* Centre section - validation status */}
      <div className="flex items-center gap-2" aria-live="polite">
        {isValidating ? (
          <span className="flex items-center gap-1 text-blue-400" role="status">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Validating...
          </span>
        ) : isValid ? (
          <span className="flex items-center gap-1 text-teal-400" role="status">
            <CheckCircle className="w-3 h-3" aria-hidden="true" />
            Valid
          </span>
        ) : (
          <button
            onClick={onDiagnosticsClick}
            className="flex items-center gap-3 hover:bg-zinc-600 px-2 py-0.5 rounded transition-colors"
            aria-label={`Show problems: ${errorCount} ${errorCount === 1 ? 'error' : 'errors'}, ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`}
          >
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                {errorCount} {errorCount === 1 ? 'error' : 'errors'}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-yellow-500">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Language */}
        <span className="uppercase" aria-label={`Language: ${file?.language ?? 'yaml'}`}>
          {file?.language ?? 'yaml'}
        </span>

        {/* OpenAPI version */}
        {openApiVersion && (
          <span aria-label={`OpenAPI version ${openApiVersion}`}>OpenAPI {openApiVersion}</span>
        )}
      </div>
    </footer>
  );
}
