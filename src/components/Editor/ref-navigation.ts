import { EditorView, ViewPlugin, ViewUpdate, Decoration, type DecorationSet } from '@codemirror/view';
import { useEditorStore } from '../../store';

type EditorStore = ReturnType<typeof useEditorStore.getState>;

const REF_PATTERN = /\$ref:\s*['"]?(#\/[^'"}\s]+)['"]?/g;

function createRefLinkDecoration() {
  return Decoration.mark({
    class: 'cm-ref-link',
  });
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: { from: number; to: number }[] = [];
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    const startLine = doc.lineAt(from).number;
    const endLine = doc.lineAt(to).number;

    for (let i = startLine; i <= endLine; i++) {
      const line = doc.line(i);
      const text = line.text;

      let match;
      REF_PATTERN.lastIndex = 0;
      while ((match = REF_PATTERN.exec(text)) !== null) {
        const refValue = match[1];
        const refStart = line.from + match.index + match[0].indexOf(refValue);
        const refEnd = refStart + refValue.length;

        decorations.push({ from: refStart, to: refEnd });
      }
    }
  }

  return Decoration.set(
    decorations.map(({ from, to }) => createRefLinkDecoration().range(from, to)),
    true
  );
}

const refDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

function refPathToSourceMapKey(refPath: string): string {
  // Convert #/components/schemas/Pet to components.schemas.Pet
  return refPath.slice(2).replace(/\//g, '.');
}

export function createRefNavigationExtension(getStore: () => EditorStore) {
  return [
    refDecorationPlugin,
    EditorView.domEventHandlers({
      click(event: MouseEvent, view: EditorView) {
        // Check for Ctrl/Cmd click
        if (!event.ctrlKey && !event.metaKey) return false;

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;

        const line = view.state.doc.lineAt(pos);
        const text = line.text;

        // Find if we clicked on a $ref value
        let match;
        REF_PATTERN.lastIndex = 0;
        while ((match = REF_PATTERN.exec(text)) !== null) {
          const refValue = match[1];
          const refStart = line.from + match.index + match[0].indexOf(refValue);
          const refEnd = refStart + refValue.length;

          if (pos >= refStart && pos <= refEnd) {
            const sourceMapKey = refPathToSourceMapKey(refValue);
            const store = getStore();
            const position = store.sourceMap[sourceMapKey];

            if (position) {
              store.goToLine(position.line, position.column);
              return true;
            }
          }
        }

        return false;
      },
    }),
    EditorView.theme({
      '.cm-ref-link': {
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textUnderlineOffset: '2px',
        cursor: 'pointer',
      },
      '.cm-ref-link:hover': {
        color: 'var(--color-accent)',
      },
    }),
  ];
}

export function goToDefinition(view: EditorView, getStore: () => EditorStore): boolean {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const colInLine = pos - line.from;

  // Check if cursor is on a $ref value
  let match;
  REF_PATTERN.lastIndex = 0;
  while ((match = REF_PATTERN.exec(text)) !== null) {
    const refValue = match[1];
    const refStartCol = match.index + match[0].indexOf(refValue);
    const refEndCol = refStartCol + refValue.length;

    if (colInLine >= refStartCol && colInLine <= refEndCol) {
      const sourceMapKey = refPathToSourceMapKey(refValue);
      const store = getStore();
      const position = store.sourceMap[sourceMapKey];

      if (position) {
        store.goToLine(position.line, position.column);
        return true;
      }
    }
  }

  // Also check for inline path references like paths./users.get
  const pathRefPattern = /paths\.([^\s.]+)\.([a-z]+)/g;
  pathRefPattern.lastIndex = 0;
  while ((match = pathRefPattern.exec(text)) !== null) {
    const refStartCol = match.index;
    const refEndCol = refStartCol + match[0].length;

    if (colInLine >= refStartCol && colInLine <= refEndCol) {
      const store = getStore();
      const position = store.sourceMap[match[0]];

      if (position) {
        store.goToLine(position.line, position.column);
        return true;
      }
    }
  }

  return false;
}
