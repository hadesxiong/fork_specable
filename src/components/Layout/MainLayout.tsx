import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { PanelLeft, PanelRight, Keyboard } from 'lucide-react';
import { useEditorStore } from '../../store';
import { Editor } from '../Editor';
import { OutlineView } from '../Outline';
import { DocumentationView } from '../Preview';
import { StatusBar } from './StatusBar';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { CommandPalette, useCommandPalette, type Command } from '../CommandPalette';
import { useValidation } from '../../hooks/useValidation';
import { useFileSystem } from '../../hooks/useFileSystem';

const MIN_PANEL_WIDTH = 150;
const DEFAULT_OUTLINE_WIDTH = 220;
const DEFAULT_PREVIEW_WIDTH = 350;
const MIN_DIAGNOSTICS_HEIGHT = 100;
const MAX_DIAGNOSTICS_HEIGHT = 500;
const DEFAULT_DIAGNOSTICS_HEIGHT = 200;

export function MainLayout() {
  const showOutline = useEditorStore((state) => state.showOutline);
  const showPreview = useEditorStore((state) => state.showPreview);
  const toggleOutline = useEditorStore((state) => state.toggleOutline);
  const togglePreview = useEditorStore((state) => state.togglePreview);

  const [outlineWidth, setOutlineWidth] = useState(DEFAULT_OUTLINE_WIDTH);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);
  const [diagnosticsHeight, setDiagnosticsHeight] = useState(DEFAULT_DIAGNOSTICS_HEIGHT);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingOutline = useRef(false);
  const isDraggingPreview = useRef(false);
  const isDraggingDiagnostics = useRef(false);
  const diagnosticsStartY = useRef(0);
  const diagnosticsStartHeight = useRef(0);

  const { openFile, importFromFile, importFromUrl, saveFile, saveFileAs, newFile } = useFileSystem();

  const fileCommands: Command[] = useMemo(
    () => [
      {
        id: 'file.new',
        label: 'New File',
        shortcut: 'Ctrl+N',
        category: 'file',
        action: newFile,
      },
      {
        id: 'file.open',
        label: 'Open File...',
        shortcut: 'Ctrl+O',
        category: 'file',
        action: openFile,
      },
      {
        id: 'file.importFile',
        label: 'Import from File...',
        category: 'file',
        action: () => { importFromFile(); },
      },
      {
        id: 'file.importUrl',
        label: 'Import from URL...',
        category: 'file',
        action: () => { importFromUrl(); },
      },
      {
        id: 'file.save',
        label: 'Save',
        shortcut: 'Ctrl+S',
        category: 'file',
        action: saveFile,
      },
      {
        id: 'file.saveAs',
        label: 'Save As...',
        shortcut: 'Ctrl+Shift+S',
        category: 'file',
        action: saveFileAs,
      },
    ],
    [newFile, openFile, importFromFile, importFromUrl, saveFile, saveFileAs]
  );

  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette, commands } = useCommandPalette(fileCommands);

  // Initialise validation pipeline
  useValidation();

  // Register global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle outline: Ctrl+Shift+E
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        toggleOutline();
      }
      // Toggle preview: Ctrl+\
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        togglePreview();
      }
      // New file: Ctrl+N
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newFile();
      }
      // Open file: Ctrl+O
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openFile();
      }
      // Save file: Ctrl+S
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
      // Save as: Ctrl+Shift+S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        saveFileAs();
      }
      // Keyboard shortcuts: Ctrl+/
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOutline, togglePreview, newFile, openFile, saveFile, saveFileAs]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    if (isDraggingOutline.current) {
      const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(e.clientX - rect.left, rect.width / 3));
      setOutlineWidth(newWidth);
    }

    if (isDraggingPreview.current) {
      const newWidth = Math.max(MIN_PANEL_WIDTH, Math.min(rect.right - e.clientX, rect.width / 2));
      setPreviewWidth(newWidth);
    }

    if (isDraggingDiagnostics.current) {
      const deltaY = diagnosticsStartY.current - e.clientY;
      const newHeight = Math.max(
        MIN_DIAGNOSTICS_HEIGHT,
        Math.min(diagnosticsStartHeight.current + deltaY, MAX_DIAGNOSTICS_HEIGHT)
      );
      setDiagnosticsHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingOutline.current = false;
    isDraggingPreview.current = false;
    isDraggingDiagnostics.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const startDraggingOutline = useCallback(() => {
    isDraggingOutline.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const startDraggingPreview = useCallback(() => {
    isDraggingPreview.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const startDraggingDiagnostics = useCallback((e: React.MouseEvent) => {
    isDraggingDiagnostics.current = true;
    diagnosticsStartY.current = e.clientY;
    diagnosticsStartHeight.current = diagnosticsHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [diagnosticsHeight]);

  return (
    <div className="h-screen flex flex-col bg-zinc-900 relative">
      {/* Header */}
      <header className="h-10 flex items-center justify-between px-3 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200">Specable</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowKeyboardShortcuts(true)}
            className="p-1.5 rounded transition-colors text-zinc-400 hover:bg-zinc-800"
            title="Keyboard Shortcuts (Ctrl+/)"
            aria-label="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-1" aria-hidden="true" />
          <button
            onClick={toggleOutline}
            className={`p-1.5 rounded transition-colors ${
              showOutline
                ? 'bg-blue-900 text-zinc-200'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
            title="Toggle Outline (Ctrl+Shift+E)"
            aria-label="Toggle Outline"
            aria-pressed={showOutline}
          >
            <PanelLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={togglePreview}
            className={`p-1.5 rounded transition-colors ${
              showPreview
                ? 'bg-blue-900 text-zinc-200'
                : 'text-zinc-400 hover:bg-zinc-800'
            }`}
            title="Toggle Preview (Ctrl+\)"
            aria-label="Toggle Preview"
            aria-pressed={showPreview}
          >
            <PanelRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Outline panel */}
        {showOutline && (
          <>
            <aside
              style={{ width: outlineWidth }}
              className="shrink-0"
              aria-label="Outline"
            >
              <OutlineView />
            </aside>
            <div
              className="w-1 bg-zinc-700 hover:bg-blue-500 cursor-col-resize transition-colors"
              onMouseDown={startDraggingOutline}
            />
          </>
        )}

        {/* Editor */}
        <main className="flex-1 min-w-0" aria-label="Editor">
          <Editor />
        </main>

        {/* Preview panel */}
        {showPreview && (
          <>
            <div
              className="w-1 bg-zinc-700 hover:bg-blue-500 cursor-col-resize transition-colors"
              onMouseDown={startDraggingPreview}
            />
            <aside
              style={{ width: previewWidth }}
              className="shrink-0"
              aria-label="Documentation Preview"
            >
              <DocumentationView />
            </aside>
          </>
        )}
      </div>

      {/* Diagnostics panel */}
      <DiagnosticsPanel
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        height={diagnosticsHeight}
        onResizeStart={startDraggingDiagnostics}
      />

      {/* Status bar */}
      <StatusBar onDiagnosticsClick={() => setShowDiagnostics((prev) => !prev)} />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        commands={commands}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}
