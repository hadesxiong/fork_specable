import { useEditorStore } from '../store';
import { parseContent, stringifyAsJson, stringifyAsYaml } from './content';

export function formatContent(content: string, language: 'json' | 'yaml'): string {
  const parsed = parseContent(content);
  if (language === 'json') {
    return stringifyAsJson(parsed);
  }
  return stringifyAsYaml(parsed);
}

export function formatEditorContent(): boolean {
  const { editorView, file } = useEditorStore.getState();
  if (!editorView || !file) return false;

  const content = editorView.state.doc.toString();
  try {
    const formatted = formatContent(content, file.language);
    if (formatted !== content) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: formatted,
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}
