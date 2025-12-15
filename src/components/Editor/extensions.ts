import type { Extension } from '@codemirror/state';
import { keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { foldGutter, foldKeymap, indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { lintGutter, lintKeymap } from '@codemirror/lint';
import { yaml } from '@codemirror/lang-yaml';
import { json } from '@codemirror/lang-json';

import { darkTheme } from './theme';
import { createMinimapExtension } from './minimap';

export interface EditorConfig {
  language: 'yaml' | 'json';
  showMinimap?: boolean;
  onUpdate?: (content: string) => void;
}

export function createExtensions(config: EditorConfig): Extension[] {
  const languageExtension = config.language === 'json' ? json() : yaml();

  return [
    // Core editing
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    highlightSelectionMatches(),

    // Language support
    languageExtension,

    // Autocompletion
    autocompletion({
      activateOnTyping: true,
      maxRenderedOptions: 20,
    }),

    // UI enhancements
    lineNumbers(),
    foldGutter({
      markerDOM: (open) => {
        const marker = document.createElement('span');
        marker.textContent = open ? '▼' : '▶';
        marker.className = 'fold-marker';
        return marker;
      },
    }),
    lintGutter(),

    // Theme
    darkTheme,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    // Keymaps (order matters - later takes precedence)
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...searchKeymap,
      ...completionKeymap,
      ...lintKeymap,
      indentWithTab,
    ]),

    // Optional extensions
    ...(config.showMinimap !== false ? [createMinimapExtension()] : []),
  ];
}
