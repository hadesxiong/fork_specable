import * as yaml from 'yaml';
import { useEditorStore } from '../store';

export function formatContent(content: string, language: 'json' | 'yaml'): string {
  const trimmed = content.trim();

  let parsed: unknown;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    parsed = JSON.parse(content);
  } else {
    parsed = yaml.parse(content);
  }

  if (language === 'json') {
    return JSON.stringify(parsed, null, 2);
  }
  return yaml.stringify(parsed);
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
