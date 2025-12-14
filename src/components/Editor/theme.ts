import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const colours = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  selection: 'rgba(0, 122, 204, 0.3)',
  cursor: '#d4d4d4',
  activeLine: 'rgba(255, 255, 255, 0.04)',
  gutter: '#858585',
  gutterActive: '#c6c6c6',

  keyword: '#569cd6',
  string: '#ce9178',
  number: '#b5cea8',
  boolean: '#569cd6',
  null: '#569cd6',
  property: '#9cdcfe',
  operator: '#d4d4d4',
  comment: '#6a9955',
  bracket: '#ffd700',
  tag: '#569cd6',
  attribute: '#9cdcfe',
  variable: '#4ec9b0',
  type: '#4ec9b0',
  function: '#dcdcaa',
};

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: colours.background,
    color: colours.foreground,
  },
  '.cm-content': {
    caretColor: colours.cursor,
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: colours.cursor,
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
    borderRight: 'none',
  },
  '.cm-activeLineGutter': {
    backgroundColor: colours.activeLine,
    color: colours.gutterActive,
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: colours.gutter,
  },
  '.cm-tooltip': {
    backgroundColor: '#252526',
    border: '1px solid #454545',
    borderRadius: '3px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    '& > ul > li': {
      padding: '2px 8px',
    },
    '& > ul > li[aria-selected]': {
      backgroundColor: '#094771',
      color: colours.foreground,
    },
  },
  '.cm-panels': {
    backgroundColor: '#252526',
    color: colours.foreground,
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: '1px solid #454545',
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: '1px solid #454545',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(234, 92, 0, 0.33)',
    outline: '1px solid rgba(234, 92, 0, 0.5)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(81, 92, 106, 0.7)',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'rgba(0, 100, 0, 0.3)',
    outline: '1px solid rgba(255, 215, 0, 0.5)',
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
  { tag: tags.bracket, color: colours.foreground },
  { tag: tags.angleBracket, color: colours.foreground },
  { tag: tags.squareBracket, color: colours.foreground },
  { tag: tags.paren, color: colours.foreground },
  { tag: tags.brace, color: colours.foreground },
  { tag: tags.tagName, color: colours.tag },
  { tag: tags.attributeName, color: colours.attribute },
  { tag: tags.attributeValue, color: colours.string },
  { tag: tags.invalid, color: '#ff0000', textDecoration: 'underline' },
]);

export const darkTheme: Extension = [
  editorTheme,
  syntaxHighlighting(highlightStyle),
];
