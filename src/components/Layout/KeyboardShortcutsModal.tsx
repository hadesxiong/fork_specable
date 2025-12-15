import { X } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "File",
    shortcuts: [
      { keys: "Ctrl+N", description: "New file" },
      { keys: "Ctrl+O", description: "Open file" },
      { keys: "Ctrl+S", description: "Save file" },
      { keys: "Ctrl+Shift+S", description: "Save as" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Ctrl+G", description: "Go to line" },
      { keys: "F12", description: "Go to definition" },
      { keys: "Ctrl+Shift+P", description: "Command palette" },
      { keys: "Ctrl+/", description: "Keyboard shortcuts" },
    ],
  },
  {
    title: "View",
    shortcuts: [
      { keys: "Ctrl+Shift+E", description: "Toggle outline panel" },
      { keys: "Ctrl+\\", description: "Toggle preview panel" },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { keys: "Ctrl+Z", description: "Undo" },
      { keys: "Ctrl+Y", description: "Redo" },
      { keys: "Ctrl+A", description: "Select all" },
      { keys: "Ctrl+F", description: "Find" },
      { keys: "Ctrl+H", description: "Find and replace" },
    ],
  },
  {
    title: "Code Folding",
    shortcuts: [
      { keys: "Ctrl+K Ctrl+0", description: "Fold all" },
      { keys: "Ctrl+K Ctrl+J", description: "Unfold all" },
    ],
  },
];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-[600px] max-w-[90vw] max-h-[80vh] bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2
            id="shortcuts-title"
            className="text-base font-medium text-zinc-100"
          >
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 max-h-[calc(80vh-60px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-medium text-purple-400 uppercase tracking-wide mb-3">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-zinc-800/50"
                    >
                      <span className="text-sm text-zinc-300">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-1 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-xs text-zinc-500 text-center">
            On macOS, use Cmd instead of Ctrl
          </p>
        </div>
      </div>
    </div>
  );
}
