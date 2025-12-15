import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEditorStore } from '../../store';
import type { Command } from './CommandPalette';

export function useCommandPalette(additionalCommands: Command[] = []) {
  const [isOpen, setIsOpen] = useState(false);
  const togglePreview = useEditorStore((state) => state.togglePreview);
  const toggleOutline = useEditorStore((state) => state.toggleOutline);
  const showPreview = useEditorStore((state) => state.showPreview);
  const setRightPanelView = useEditorStore((state) => state.setRightPanelView);
  const setGraphFilter = useEditorStore((state) => state.setGraphFilter);
  const setDiffFilter = useEditorStore((state) => state.setDiffFilter);
  const clearComparison = useEditorStore((state) => state.clearComparison);
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
      {
        id: 'view.showDocs',
        label: 'Show Documentation View',
        shortcut: 'Cmd+1',
        category: 'view',
        action: () => {
          setRightPanelView('preview');
          if (!showPreview) togglePreview();
        },
      },
      {
        id: 'view.showGraph',
        label: 'Show Graph View',
        shortcut: 'Cmd+2',
        category: 'view',
        action: () => {
          setRightPanelView('graph');
          if (!showPreview) togglePreview();
        },
      },
      {
        id: 'view.showDiff',
        label: 'Show Diff View',
        shortcut: 'Cmd+3',
        category: 'view',
        action: () => {
          setRightPanelView('diff');
          if (!showPreview) togglePreview();
        },
      },

      // Graph commands
      {
        id: 'graph.showAll',
        label: 'Graph: Show All Schemas',
        category: 'view',
        action: () => setGraphFilter('all'),
      },
      {
        id: 'graph.showReferenced',
        label: 'Graph: Show Referenced Only',
        category: 'view',
        action: () => setGraphFilter('referenced'),
      },
      {
        id: 'graph.showOrphaned',
        label: 'Graph: Show Orphaned Only',
        category: 'view',
        action: () => setGraphFilter('orphaned'),
      },

      // Diff commands
      {
        id: 'diff.showAll',
        label: 'Diff: Show All Changes',
        category: 'view',
        action: () => setDiffFilter('all'),
      },
      {
        id: 'diff.showBreaking',
        label: 'Diff: Show Breaking Only',
        category: 'view',
        action: () => setDiffFilter('breaking'),
      },
      {
        id: 'diff.showNonBreaking',
        label: 'Diff: Show Non-Breaking Only',
        category: 'view',
        action: () => setDiffFilter('non-breaking'),
      },
      {
        id: 'diff.clear',
        label: 'Diff: Clear Comparison',
        category: 'view',
        action: clearComparison,
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
    [togglePreview, toggleOutline, showPreview, setRightPanelView, setGraphFilter, setDiffFilter, clearComparison, goToLine, editorView]
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
