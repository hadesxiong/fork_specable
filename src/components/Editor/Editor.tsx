import { useEffect, useRef, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { useEditorStore } from '../../store';
import { createExtensions } from './extensions';
import { createRefNavigationExtension, goToDefinition } from './ref-navigation';
import { setEditorDiagnostics } from './diagnostics';
import { useViewport } from '../../hooks/useViewport';

export function Editor() {
  const { isMobile } = useViewport();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isUpdatingRef = useRef(false);

  const file = useEditorStore((state) => state.file);
  const setEditorView = useEditorStore((state) => state.setEditorView);
  const updateContent = useEditorStore((state) => state.updateContent);
  const errors = useEditorStore((state) => state.errors);
  const warnings = useEditorStore((state) => state.warnings);
  const showMinimap = useEditorStore((state) => state.showMinimap);

  const effectiveShowMinimap = showMinimap && !isMobile;

  const handleDocChange = useCallback((content: string) => {
    if (!isUpdatingRef.current) {
      updateContent(content);
    }
  }, [updateContent]);

  useEffect(() => {
    if (!containerRef.current || !file) return;

    const getStore = () => useEditorStore.getState();

    const extensions = createExtensions({
      language: file.language,
      showMinimap: effectiveShowMinimap,
      onUpdate: handleDocChange,
    });

    const refNavExtension = createRefNavigationExtension(getStore);

    const goToDefKeymap = keymap.of([
      {
        key: 'F12',
        run: (view) => goToDefinition(view, getStore),
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        handleDocChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: file.content,
      extensions: [...extensions, refNavExtension, goToDefKeymap, updateListener],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setEditorView(view);

    return () => {
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
    };
  }, [file?.id, file?.language, effectiveShowMinimap]);

  // Sync content from store to editor when it changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !file) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== file.content) {
      isUpdatingRef.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: file.content,
        },
      });
      isUpdatingRef.current = false;
    }
  }, [file?.content]);

  // Sync validation errors to editor diagnostics
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    setEditorDiagnostics(view, errors, warnings);
  }, [errors, warnings]);

  if (!file) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900 text-zinc-500">
        No file open
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden bg-zinc-900"
    />
  );
}
