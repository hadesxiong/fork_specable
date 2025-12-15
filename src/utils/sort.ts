import * as yaml from 'yaml';
import { useEditorStore } from '../store';

type OpenAPISpec = Record<string, unknown>;

function sortObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  const sorted = {} as T;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    sorted[key as keyof T] = obj[key] as T[keyof T];
  }
  return sorted;
}

function sortPaths(spec: OpenAPISpec): OpenAPISpec {
  if (!spec.paths || typeof spec.paths !== 'object') {
    return spec;
  }

  return {
    ...spec,
    paths: sortObjectKeys(spec.paths as Record<string, unknown>),
  };
}

function sortSchemas(spec: OpenAPISpec): OpenAPISpec {
  const components = spec.components as Record<string, unknown> | undefined;
  if (!components?.schemas || typeof components.schemas !== 'object') {
    return spec;
  }

  return {
    ...spec,
    components: {
      ...components,
      schemas: sortObjectKeys(components.schemas as Record<string, unknown>),
    },
  };
}

export function sortSpec(spec: OpenAPISpec): OpenAPISpec {
  let result = spec;
  result = sortPaths(result);
  result = sortSchemas(result);
  return result;
}

export function sortEditorContent(): void {
  const { editorView, file } = useEditorStore.getState();
  if (!editorView || !file) return;

  const content = editorView.state.doc.toString();
  try {
    const trimmed = content.trim();
    let parsed: OpenAPISpec;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      parsed = JSON.parse(content);
    } else {
      parsed = yaml.parse(content);
    }

    const sorted = sortSpec(parsed);

    let output: string;
    if (file.language === 'json') {
      output = JSON.stringify(sorted, null, 2);
    } else {
      output = yaml.stringify(sorted);
    }

    if (output !== content) {
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: output,
        },
      });
      useEditorStore.getState().showToast('success', 'Sorted paths and schemas');
    }
  } catch {
    useEditorStore.getState().showToast('error', 'Failed to sort: invalid syntax');
  }
}
