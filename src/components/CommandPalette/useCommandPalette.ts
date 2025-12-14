import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEditorStore } from '../../store';
import type { Command } from './CommandPalette';

export function useCommandPalette(additionalCommands: Command[] = []) {
  const [isOpen, setIsOpen] = useState(false);
  const togglePreview = useEditorStore((state) => state.togglePreview);
  const toggleOutline = useEditorStore((state) => state.toggleOutline);
  const goToLine = useEditorStore((state) => state.goToLine);
  const editorView = useEditorStore((state) => state.editorView);

  const baseCommands: Command[] = useMemo(
    () => [
      // Navigation
      {
        id: 'goto.line',
        label: 'Go to Line...',
        shortcut: 'Ctrl+G',
        category: 'navigation',
        action: () => {
          const line = prompt('Go to line:');
          if (line) {
            const lineNum = parseInt(line, 10);
            if (!isNaN(lineNum)) {
              goToLine(lineNum);
            }
          }
        },
      },
      {
        id: 'goto.definition',
        label: 'Go to Definition',
        shortcut: 'F12',
        category: 'navigation',
        action: () => {
          if (editorView) {
            import('../Editor/ref-navigation').then(({ goToDefinition }) => {
              const getStore = () => useEditorStore.getState();
              goToDefinition(editorView, getStore);
            });
          }
        },
        when: () => editorView !== null,
      },

      // View
      {
        id: 'view.togglePreview',
        label: 'Toggle Preview Panel',
        shortcut: 'Ctrl+\\',
        category: 'view',
        action: togglePreview,
      },
      {
        id: 'view.toggleOutline',
        label: 'Toggle Outline Panel',
        shortcut: 'Ctrl+Shift+E',
        category: 'view',
        action: toggleOutline,
      },

      // Edit
      {
        id: 'edit.undo',
        label: 'Undo',
        shortcut: 'Ctrl+Z',
        category: 'edit',
        action: () => {
          if (editorView) {
            import('@codemirror/commands').then(({ undo }) => {
              undo(editorView);
            });
          }
        },
      },
      {
        id: 'edit.redo',
        label: 'Redo',
        shortcut: 'Ctrl+Y',
        category: 'edit',
        action: () => {
          if (editorView) {
            import('@codemirror/commands').then(({ redo }) => {
              redo(editorView);
            });
          }
        },
      },
      {
        id: 'edit.selectAll',
        label: 'Select All',
        shortcut: 'Ctrl+A',
        category: 'edit',
        action: () => {
          if (editorView) {
            import('@codemirror/commands').then(({ selectAll }) => {
              selectAll(editorView);
            });
          }
        },
      },

      // OpenAPI
      {
        id: 'openapi.foldAll',
        label: 'Fold All',
        shortcut: 'Ctrl+K Ctrl+0',
        category: 'openapi',
        action: () => {
          if (editorView) {
            import('@codemirror/language').then(({ foldAll }) => {
              foldAll(editorView);
            });
          }
        },
      },
      {
        id: 'openapi.unfoldAll',
        label: 'Unfold All',
        shortcut: 'Ctrl+K Ctrl+J',
        category: 'openapi',
        action: () => {
          if (editorView) {
            import('@codemirror/language').then(({ unfoldAll }) => {
              unfoldAll(editorView);
            });
          }
        },
      },
    ],
    [togglePreview, toggleOutline, goToLine, editorView]
  );

  const allCommands = useMemo(
    () => [...baseCommands, ...additionalCommands],
    [baseCommands, additionalCommands]
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isOpen, open, close, toggle, commands: allCommands };
}
