import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const colours = {
  background: '#09090b', // zinc-950
  foreground: '#e4e4e7', // zinc-200
  foregroundMuted: '#a1a1aa', // zinc-400
  selection: 'rgba(168, 85, 247, 0.2)', // purple-500
  cursor: '#e4e4e7', // zinc-200
  activeLine: 'rgba(255, 255, 255, 0.03)',
  gutter: '#52525b', // zinc-600
  gutterActive: '#a1a1aa', // zinc-400
  border: '#27272a', // zinc-800

  // Syntax highlighting - minimal palette
  keyword: '#c084fc', // purple-400
  string: '#86efac', // green-300
  number: '#fcd34d', // amber-300
  boolean: '#c084fc', // purple-400
  null: '#c084fc', // purple-400
  property: '#93c5fd', // blue-300
  operator: '#a1a1aa', // zinc-400
  comment: '#52525b', // zinc-600
  bracket: '#71717a', // zinc-500
  tag: '#c084fc', // purple-400
  attribute: '#93c5fd', // blue-300
  variable: '#67e8f9', // cyan-300
  type: '#67e8f9', // cyan-300
  function: '#fcd34d', // amber-300
};

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: colours.background,
    color: colours.foreground,
  },
  '.cm-content': {
    caretColor: colours.cursor,
    padding: '12px 0',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: colours.cursor,
    borderLeftWidth: '2px',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: colours.selection,
  },
  '.cm-activeLine': {
    backgroundColor: colours.activeLine,
  },
  '.cm-gutters': {
    backgroundColor: colours.background,
    color: colours.gutter,
    borderRight: `1px solid ${colours.border}`,
    paddingRight: '8px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    paddingLeft: '16px',
    minWidth: '40px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: colours.gutterActive,
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    border: '1px solid rgba(168, 85, 247, 0.3)',
    borderRadius: '3px',
    color: colours.foregroundMuted,
    padding: '0 4px',
    margin: '0 4px',
  },
  '.cm-tooltip': {
    backgroundColor: '#18181b', // zinc-900
    border: `1px solid ${colours.border}`,
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    '& > ul': {
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
    },
    '& > ul > li': {
      padding: '4px 12px',
      borderRadius: '4px',
      margin: '2px 4px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: 'rgba(168, 85, 247, 0.2)',
      color: colours.foreground,
    },
  },
  '.cm-panels': {
    backgroundColor: '#18181b', // zinc-900
    color: colours.foreground,
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: `1px solid ${colours.border}`,
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: `1px solid ${colours.border}`,
  },
  // Search panel styling
  '.cm-search': {
    padding: '8px 12px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    alignItems: 'center',
  },
  '.cm-search input[type="text"]': {
    backgroundColor: '#27272a', // zinc-800
    border: '1px solid #3f3f46', // zinc-700
    borderRadius: '6px',
    padding: '6px 10px',
    color: colours.foreground,
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    transition: 'border-color 150ms',
    '&:focus': {
      borderColor: '#a855f7', // purple-500
    },
    '&::placeholder': {
      color: '#71717a', // zinc-500
    },
  },
  '.cm-search input[name="search"]': {
    width: '200px',
  },
  '.cm-search input[name="replace"]': {
    width: '200px',
  },
  '.cm-search button': {
    backgroundColor: '#27272a', // zinc-800
    border: '1px solid #3f3f46', // zinc-700
    borderRadius: '6px',
    padding: '6px 12px',
    color: '#a1a1aa', // zinc-400
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 150ms',
    '&:hover': {
      backgroundColor: '#3f3f46', // zinc-700
      color: '#e4e4e7', // zinc-200
    },
    '&:active': {
      backgroundColor: '#52525b', // zinc-600
    },
  },
  '.cm-search button[name="close"]': {
    backgroundColor: 'transparent',
    border: 'none',
    padding: '4px 8px',
    color: '#71717a', // zinc-500
    '&:hover': {
      backgroundColor: '#27272a', // zinc-800
      color: '#e4e4e7', // zinc-200
    },
  },
  '.cm-search label': {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#a1a1aa', // zinc-400
    fontSize: '11px',
    cursor: 'pointer',
    userSelect: 'none',
    '&:hover': {
      color: '#d4d4d8', // zinc-300
    },
  },
  '.cm-search input[type="checkbox"]': {
    appearance: 'none',
    width: '14px',
    height: '14px',
    backgroundColor: '#27272a', // zinc-800
    border: '1px solid #3f3f46', // zinc-700
    borderRadius: '3px',
    cursor: 'pointer',
    position: 'relative',
    '&:checked': {
      backgroundColor: '#9333ea', // purple-600
      borderColor: '#9333ea',
    },
    '&:checked::after': {
      content: '""',
      position: 'absolute',
      left: '4px',
      top: '1px',
      width: '4px',
      height: '8px',
      border: 'solid white',
      borderWidth: '0 2px 2px 0',
      transform: 'rotate(45deg)',
    },
  },
  '.cm-search br': {
    display: 'none',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    outline: '1px solid rgba(168, 85, 247, 0.4)',
    borderRadius: '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(168, 85, 247, 0.4)',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    outline: '1px solid rgba(168, 85, 247, 0.4)',
    borderRadius: '2px',
  },
  // Lint gutter markers
  '.cm-lint-marker': {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginLeft: '4px',
  },
  '.cm-lint-marker-error': {
    content: '""',
    backgroundColor: '#f87171', // red-400
  },
  '.cm-lint-marker-warning': {
    content: '""',
    backgroundColor: '#fbbf24', // amber-400
  },
  '.cm-lint-marker-info': {
    content: '""',
    backgroundColor: '#c084fc', // purple-400
  },
  // Lint range underlines
  '.cm-lintRange': {
    backgroundPosition: 'left bottom',
    backgroundRepeat: 'repeat-x',
    paddingBottom: '0.7px',
  },
  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L2 1 L4 3 L6 1' fill='none' stroke='%23f87171' stroke-width='1'/%3E%3C/svg%3E")`,
  },
  '.cm-lintRange-warning': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L2 1 L4 3 L6 1' fill='none' stroke='%23fbbf24' stroke-width='1'/%3E%3C/svg%3E")`,
  },
  '.cm-lintRange-info': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='3'%3E%3Cpath d='M0 3 L2 1 L4 3 L6 1' fill='none' stroke='%23c084fc' stroke-width='1'/%3E%3C/svg%3E")`,
  },
  // Lint tooltip
  '.cm-tooltip-lint': {
    backgroundColor: '#18181b', // zinc-900
    border: '1px solid #27272a', // zinc-800
    borderRadius: '6px',
    padding: '0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
    maxWidth: '400px',
  },
  '.cm-diagnostic': {
    padding: '8px 12px',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px',
    lineHeight: '1.5',
    borderLeft: '3px solid',
  },
  '.cm-diagnostic-error': {
    borderLeftColor: '#f87171', // red-400
    color: '#fecaca', // red-200
  },
  '.cm-diagnostic-warning': {
    borderLeftColor: '#fbbf24', // amber-400
    color: '#fde68a', // amber-200
  },
  '.cm-diagnostic-info': {
    borderLeftColor: '#c084fc', // purple-400
    color: '#e9d5ff', // purple-200
  },
  '.cm-diagnosticAction': {
    padding: '2px 8px',
    marginLeft: '8px',
    backgroundColor: '#27272a', // zinc-800
    color: '#a1a1aa', // zinc-400
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#3f3f46', // zinc-700
      color: '#e4e4e7', // zinc-200
    },
  },
  '.cm-diagnosticSource': {
    marginLeft: '8px',
    color: '#71717a', // zinc-500
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
  },
}, { dark: true });

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: colours.keyword },
  { tag: tags.operator, color: colours.operator },
  { tag: tags.special(tags.variableName), color: colours.variable },
  { tag: tags.typeName, color: colours.type },
  { tag: tags.atom, color: colours.boolean },
  { tag: tags.number, color: colours.number },
  { tag: tags.bool, color: colours.boolean },
  { tag: tags.null, color: colours.null },
  { tag: tags.string, color: colours.string },
  { tag: tags.character, color: colours.string },
  { tag: tags.escape, color: colours.string },
  { tag: tags.regexp, color: colours.string },
  { tag: tags.name, color: colours.property },
  { tag: tags.labelName, color: colours.property },
  { tag: tags.propertyName, color: colours.property },
  { tag: tags.definition(tags.propertyName), color: colours.property },
  { tag: tags.function(tags.variableName), color: colours.function },
  { tag: tags.definition(tags.function(tags.variableName)), color: colours.function },
  { tag: tags.meta, color: colours.comment },
  { tag: tags.comment, color: colours.comment, fontStyle: 'italic' },
  { tag: tags.bracket, color: colours.bracket },
  { tag: tags.angleBracket, color: colours.bracket },
  { tag: tags.squareBracket, color: colours.bracket },
  { tag: tags.paren, color: colours.bracket },
  { tag: tags.brace, color: colours.bracket },
  { tag: tags.tagName, color: colours.tag },
  { tag: tags.attributeName, color: colours.attribute },
  { tag: tags.attributeValue, color: colours.string },
  { tag: tags.invalid, color: '#f87171', textDecoration: 'underline' }, // red-400
]);

export const darkTheme: Extension = [
  editorTheme,
  syntaxHighlighting(highlightStyle),
];
