import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { customGutter } from './customGutter'

// Dark theme colors
const darkText = "#cccccc",
  darkTextSecondary = "#bebebeff",
  darkTextTertiary = "#949494ff",
  darkBackground = "#252526",
  darkBackgroundHighlight = "#b0bac71a",
  darkSelection = "#264f78",
  darkSelectionAlt = "#4a4a4e",
  darkBorder = "#3e3e42",
  darkSearchMatch = "#5a5a5a",
  darkSearchBorder = "#6e6e6e",
  darkCursor = "var(--color-primary-500)",
  darkInvalid = "#ff0000"

/// The colors used in the dark theme, as CSS color strings.
export const darkColors = {
  darkText,
  darkTextSecondary,
  darkTextTertiary,
  darkBackground,
  darkBackgroundHighlight,
  darkSelection,
  darkSelectionAlt,
  darkBorder,
  darkSearchMatch,
  darkSearchBorder,
  darkCursor,
  darkInvalid
}

/// The editor theme styles for Grey Dark.
export const greyDarkTheme = EditorView.theme({
  '&': {
    color: darkText,
    backgroundColor: darkBackground
  },

  '.cm-content': {
    caretColor: darkCursor
  },

  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: darkCursor,
    borderLeftWidth: '2px'
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: darkSelection },

  // Rounded corners for first selection background in a group
  '.cm-selectionBackground:first-child': {
    borderTopLeftRadius: '5px',
    borderTopRightRadius: '5px',
  },
  // Remove round corner radius for intermediary (middle) selection backgrounds
  '.cm-selectionBackground + .cm-selectionBackground': {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  // Restore bottom border radius for the last selection background in a group
  '.cm-selectionBackground:last-child': {
    borderBottomLeftRadius: '5px',
    borderBottomRightRadius: '5px',
  },

  '.cm-selectionBackground:nth-last-child(2)': {
    borderBottomRightRadius: '5px'
  },

  '.cm-panels': { backgroundColor: 'transparent', color: darkText },
  '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${darkBorder}` },
  '.cm-panels.cm-panels-bottom': { 
    borderTop: 'none',
    padding: '0',
    background: 'transparent',
    overflow: 'visible',
    position: 'relative'
  },
  '.cm-panels .cm-panel': {
    padding: '0',
    background: 'transparent',
    border: 'none',
    overflow: 'visible'
  },

  '.cm-searchMatch': {
    backgroundColor: darkSearchMatch,
    outline: `1px solid ${darkSearchBorder}`
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: darkSelectionAlt
  },

  '.cm-activeLine': { backgroundColor: darkBackgroundHighlight },
  '.cm-selectionMatch': { backgroundColor: 'transparent' },

  '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: darkSelectionAlt
  },

  '.cm-gutters': {
    backgroundColor: darkBackground,
    color: darkTextTertiary,
    border: 'none'
  },

  '.cm-activeLineGutter': {
    backgroundColor: darkBackgroundHighlight,
    color: darkTextSecondary
  },

  '.cm-lineNumbers .cm-gutterElement.cm-error-icon': {
    color: '#db5d5dff !important',
    fontWeight: 'bold',
    fontSize: '20px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#9d9d9d'
  },

  '.cm-tooltip': {
    border: 'none',
    backgroundColor: darkBackground
  },
  '.cm-tooltip .cm-tooltip-arrow:before': {
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent'
  },
  '.cm-tooltip .cm-tooltip-arrow:after': {
    borderTopColor: darkBackground,
    borderBottomColor: darkBackground
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: darkSelection,
      color: darkText
    }
  }
}, { dark: true })

/// The highlighting style for code in the Grey Dark theme.
export const greyDarkHighlightStyle = oneDarkHighlightStyle

/// The syntax highlighting extension for the Grey Dark theme.
export const greyDarkSyntax: Extension = syntaxHighlighting(greyDarkHighlightStyle)

/// Extension to enable the Grey Dark theme (both the editor theme and
/// the highlight style).
export const greyDark: Extension = [greyDarkTheme, greyDarkSyntax, customGutter]

// Light theme colors
const lightText = "#1e1e1e",
  lightTextSecondary = "#474747ff",
  lightTextTertiary = "#838383ff",
  lightBackground = "#f5f5f5",
  lightBackgroundHighlight = "#06162f0b",
  lightSelection = "#bbd6f2ff",
  lightSelectionAlt = "#e0e0e0",
  lightBorder = "#d1d1d1",
  lightSearchMatch = "#e0e0e0",
  lightSearchBorder = "#c8c8c8",
  lightCursor = "var(--color-primary-500)",
  lightInvalid = "#ff0000"

/// The colors used in the light theme, as CSS color strings.
export const lightColors = {
  lightText,
  lightTextSecondary,
  lightTextTertiary,
  lightBackground,
  lightBackgroundHighlight,
  lightSelection,
  lightSelectionAlt,
  lightBorder,
  lightSearchMatch,
  lightSearchBorder,
  lightCursor,
  lightInvalid
}

/// The editor theme styles for Grey Light.
export const greyLightTheme = EditorView.theme({
  '&': {
    color: lightText,
    backgroundColor: lightBackground
  },

  '.cm-content': {
    caretColor: lightCursor
  },

  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: lightCursor,
    borderLeftWidth: '2px'
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: lightSelection },

  // Rounded corners for first selection background in a group
  '.cm-selectionBackground:first-child': {
    borderTopLeftRadius: '5px',
    borderTopRightRadius: '5px',
  },
  // Remove round corner radius for intermediary (middle) selection backgrounds
  '.cm-selectionBackground + .cm-selectionBackground': {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  // Restore bottom border radius for the last selection background in a group
  '.cm-selectionBackground:last-child': {
    borderBottomLeftRadius: '5px',
    borderBottomRightRadius: '5px',
  },

  '.cm-selectionBackground:nth-last-child(2)': {
    borderBottomRightRadius: '5px'
  },

  '.cm-panels': { backgroundColor: 'transparent', color: lightText },
  '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${lightBorder}` },
  '.cm-panels.cm-panels-bottom': { 
    borderTop: 'none',
    padding: '0',
    background: 'transparent',
    overflow: 'visible',
    position: 'relative'
  },
  '.cm-panels .cm-panel': {
    padding: '0',
    background: 'transparent',
    border: 'none',
    overflow: 'visible'
  },

  '.cm-searchMatch': {
    backgroundColor: lightSearchMatch,
    outline: `1px solid ${lightSearchBorder}`
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: lightSelection
  },

  '.cm-activeLine': { backgroundColor: lightBackgroundHighlight },
  '.cm-selectionMatch': { backgroundColor: 'transparent' },

  '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: lightSelection
  },

  '.cm-gutters': {
    backgroundColor: lightBackground,
    color: lightTextTertiary,
    border: 'none'
  },

  '.cm-activeLineGutter': {
    backgroundColor: lightBackgroundHighlight,
    color: lightTextSecondary
  },

  '.cm-lineNumbers .cm-gutterElement.cm-error-icon': {
    color: '#e56666ff !important',
    fontWeight: 'bold',
    fontSize: '20px',
    lineHeight: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: lightTextTertiary
  },

  '.cm-tooltip': {
    border: 'none',
    backgroundColor: lightBackgroundHighlight
  },
  '.cm-tooltip .cm-tooltip-arrow:before': {
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent'
  },
  '.cm-tooltip .cm-tooltip-arrow:after': {
    borderTopColor: lightBackgroundHighlight,
    borderBottomColor: lightBackgroundHighlight
  },
  '.cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: lightSelection,
      color: lightText
    }
  }
}, { dark: false })

/// The highlighting style for code in the Grey Light theme.
export const greyLightHighlightStyle = HighlightStyle.define([
  {
    tag: t.keyword,
    color: '#0066cc'
  },
  {
    tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
    color: lightTextSecondary
  },
  {
    tag: [t.function(t.variableName), t.labelName],
    color: '#6f42c1'
  },
  {
    tag: [t.color, t.constant(t.name), t.standard(t.name)],
    color: '#005cc5'
  },
  {
    tag: [t.definition(t.name), t.separator],
    color: lightText
  },
  {
    tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
    color: '#d73a49'
  },
  {
    tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
    color: '#d73a49'
  },
  {
    tag: [t.meta, t.comment],
    color: '#6a737d'
  },
  {
    tag: t.strong,
    fontWeight: 'bold'
  },
  {
    tag: t.emphasis,
    fontStyle: 'italic'
  },
  {
    tag: t.strikethrough,
    textDecoration: 'line-through'
  },
  {
    tag: t.link,
    color: '#0366d6',
    textDecoration: 'underline'
  },
  {
    tag: t.heading,
    fontWeight: 'bold',
    color: lightText
  },
  {
    tag: [t.atom, t.bool, t.special(t.variableName)],
    color: '#e36209'
  },
  {
    tag: [t.processingInstruction, t.string, t.inserted],
    color: '#22863a'
  },
  {
    tag: t.invalid,
    color: lightInvalid
  },
])

/// The syntax highlighting extension for the Grey Light theme.
export const greyLightSyntax: Extension = syntaxHighlighting(greyLightHighlightStyle)

/// Extension to enable the Grey Light theme (both the editor theme and
/// the highlight style).
export const greyLight: Extension = [greyLightTheme, greyLightSyntax, customGutter]
