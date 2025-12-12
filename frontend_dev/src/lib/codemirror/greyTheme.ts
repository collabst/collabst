import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Custom grey dark theme for CodeMirror - matching our monochromatic style
export const greyDark = [
  EditorView.theme({
    '&': {
      color: '#cccccc',
      backgroundColor: '#252526', /* Matches --bg-editor for dark theme */
    },
    '.cm-content': {
      caretColor: '#cccccc',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#cccccc',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: '#3e3e42',
      },
    '.cm-panels': {
      backgroundColor: '#252526',
      color: '#cccccc',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid #3e3e42',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid #3e3e42',
    },
    '.cm-searchMatch': {
      backgroundColor: '#5a5a5a',
      outline: '1px solid #6e6e6e',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#4a4a4e',
    },
    '.cm-activeLine': {
      backgroundColor: '#252526',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#3e3e42',
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#4a4a4e',
    },
    '.cm-gutters': {
      backgroundColor: '#252526', /* Same as editor background */
      color: '#6e6e6e',
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#2d2d30',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#9d9d9d',
    },
    '.cm-tooltip': {
      border: 'none',
      backgroundColor: '#252526',
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: '#252526',
      borderBottomColor: '#252526',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: '#3e3e42',
        color: '#cccccc',
      },
    },
  }, { dark: true }),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.keyword, color: '#d4d4d4' },
      { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#b8b8b8' },
      { tag: [t.function(t.variableName), t.labelName], color: '#dcdcdc' },
      { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#c0c0c0' },
      { tag: [t.definition(t.name), t.separator], color: '#cccccc' },
      {
        tag: [
          t.typeName,
          t.className,
          t.number,
          t.changed,
          t.annotation,
          t.modifier,
          t.self,
          t.namespace,
        ],
        color: '#b0b0b0',
      },
      {
        tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
        color: '#c8c8c8',
      },
      { tag: [t.meta, t.comment], color: '#6e6e6e' },
      { tag: t.strong, fontWeight: 'bold' },
      { tag: t.emphasis, fontStyle: 'italic' },
      { tag: t.strikethrough, textDecoration: 'line-through' },
      { tag: t.link, color: '#9d9d9d', textDecoration: 'underline' },
      { tag: t.heading, fontWeight: 'bold', color: '#cccccc' },
      { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#b8b8b8' },
      { tag: [t.processingInstruction, t.string, t.inserted], color: '#a8a8a8' },
      { tag: t.invalid, color: '#ff0000' },
    ])
  ),
]

// Custom light theme for CodeMirror - matching our light theme hierarchy
export const greyLight = [
  EditorView.theme({
    '&': {
      color: '#1e1e1e',
      backgroundColor: '#f5f5f5', /* Matches --bg-editor for light theme - lightest */
    },
    '.cm-content': {
      caretColor: '#1e1e1e',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#1e1e1e',
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: '#d4d4d4',
      },
    '.cm-panels': {
      backgroundColor: '#ebebeb',
      color: '#1e1e1e',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid #d1d1d1',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid #d1d1d1',
    },
    '.cm-searchMatch': {
      backgroundColor: '#e0e0e0',
      outline: '1px solid #c8c8c8',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: '#d4d4d4',
    },
    '.cm-activeLine': {
      backgroundColor: '#ebebeb',
    },
    '.cm-selectionMatch': {
      backgroundColor: '#e0e0e0',
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: '#d4d4d4',
    },
    '.cm-gutters': {
      backgroundColor: '#f5f5f5', /* Same as editor background */
      color: '#6e6e6e',
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#ebebeb',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: 'transparent',
      border: 'none',
      color: '#6e6e6e',
    },
    '.cm-tooltip': {
      border: 'none',
      backgroundColor: '#ebebeb',
    },
    '.cm-tooltip .cm-tooltip-arrow:before': {
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
    },
    '.cm-tooltip .cm-tooltip-arrow:after': {
      borderTopColor: '#ebebeb',
      borderBottomColor: '#ebebeb',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: '#d4d4d4',
        color: '#1e1e1e',
      },
    },
  }, { dark: false }),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: t.keyword, color: '#0066cc' },
      { tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName], color: '#2e2e2e' },
      { tag: [t.function(t.variableName), t.labelName], color: '#6f42c1' },
      { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: '#005cc5' },
      { tag: [t.definition(t.name), t.separator], color: '#1e1e1e' },
      {
        tag: [
          t.typeName,
          t.className,
          t.number,
          t.changed,
          t.annotation,
          t.modifier,
          t.self,
          t.namespace,
        ],
        color: '#d73a49',
      },
      {
        tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
        color: '#d73a49',
      },
      { tag: [t.meta, t.comment], color: '#6a737d' },
      { tag: t.strong, fontWeight: 'bold' },
      { tag: t.emphasis, fontStyle: 'italic' },
      { tag: t.strikethrough, textDecoration: 'line-through' },
      { tag: t.link, color: '#0366d6', textDecoration: 'underline' },
      { tag: t.heading, fontWeight: 'bold', color: '#1e1e1e' },
      { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#e36209' },
      { tag: [t.processingInstruction, t.string, t.inserted], color: '#22863a' },
      { tag: t.invalid, color: '#ff0000' },
    ])
  ),
]
