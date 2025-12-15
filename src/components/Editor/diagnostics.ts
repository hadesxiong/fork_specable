import { type Diagnostic, setDiagnostics } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import type { ValidationError } from '../../store';

/**
 * Converts validation errors from the store format to CodeMirror diagnostics.
 * Requires the EditorView to map line/column positions to character offsets.
 */
export function validationErrorsToDiagnostics(
  view: EditorView,
  errors: ValidationError[]
): Diagnostic[] {
  const doc = view.state.doc;
  const diagnostics: Diagnostic[] = [];

  for (const error of errors) {
    // Ensure line is within document bounds
    if (error.line < 1 || error.line > doc.lines) continue;

    const line = doc.line(error.line);
    const from = line.from + Math.max(0, (error.column || 1) - 1);

    // Calculate end position
    let to: number;
    if (error.endLine && error.endColumn) {
      if (error.endLine <= doc.lines) {
        const endLine = doc.line(error.endLine);
        to = endLine.from + Math.max(0, error.endColumn - 1);
      } else {
        to = line.to;
      }
    } else {
      // Default to end of line or a reasonable span
      to = Math.min(from + 20, line.to);
    }

    // Ensure from <= to
    if (from > to) continue;

    diagnostics.push({
      from,
      to,
      severity: error.severity,
      message: error.message,
      source: error.rule,
    });
  }

  return diagnostics;
}

/**
 * Dispatches validation errors to the editor as lint diagnostics.
 * Call this whenever validation errors change in the store.
 */
export function setEditorDiagnostics(
  view: EditorView,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  const allErrors = [...errors, ...warnings];
  const diagnostics = validationErrorsToDiagnostics(view, allErrors);
  view.dispatch(setDiagnostics(view.state, diagnostics));
}
