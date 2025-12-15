import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Fuse from "fuse.js";

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  category: "navigation" | "edit" | "view" | "file" | "openapi";
  action: () => void | Promise<void>;
  when?: () => boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({
  isOpen,
  onClose,
  commands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const availableCommands = useMemo(() => {
    return commands.filter((cmd) => !cmd.when || cmd.when());
  }, [commands]);

  const fuse = useMemo(
    () =>
      new Fuse(availableCommands, {
        keys: ["label", "category"],
        threshold: 0.4,
        includeScore: true,
      }),
    [availableCommands],
  );

  const filteredCommands = useMemo(() => {
    if (!query) return availableCommands;
    return fuse.search(query).map((result) => result.item);
  }, [query, fuse, availableCommands]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    // Scroll selected item into view
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(
        '[data-selected="true"]',
      );
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (command: Command) => {
      onClose();
      command.action();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, executeCommand, onClose],
  );

  if (!isOpen) return null;

  const selectedCommand = filteredCommands[selectedIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-125 max-w-[90vw] bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          className="w-full px-4 py-3.5 bg-transparent text-zinc-200 text-sm outline-none border-b border-zinc-800 placeholder-zinc-600"
          aria-label="Search commands"
          aria-autocomplete="list"
          aria-controls="command-list"
          aria-activedescendant={
            selectedCommand ? `command-${selectedCommand.id}` : undefined
          }
        />
        <div
          ref={listRef}
          id="command-list"
          className="max-h-80 overflow-y-auto py-1"
          role="listbox"
          aria-label="Available commands"
        >
          {filteredCommands.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-zinc-600 text-sm"
              role="status"
            >
              No matching commands
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                id={`command-${cmd.id}`}
                data-selected={index === selectedIndex}
                role="option"
                aria-selected={index === selectedIndex}
                className={`mx-1 px-3 py-2.5 flex items-center justify-between cursor-pointer rounded-lg transition-colors ${
                  index === selectedIndex
                    ? "bg-purple-500/20 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="text-sm">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd
                    className={`px-2 py-1 text-xs rounded-md font-mono ${
                      index === selectedIndex
                        ? "bg-purple-500/30 text-purple-300"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                    aria-label={`Keyboard shortcut: ${cmd.shortcut}`}
                  >
                    {cmd.shortcut}
                  </kbd>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
