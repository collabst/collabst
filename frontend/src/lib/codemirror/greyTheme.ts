import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'

// Dark theme colors
const darkText = "#cccccc",
  darkTextSecondary = "#b8b8b8",
  darkTextTertiary = "#6e6e6e",
  darkBackground = "#252526",
  darkBackgroundHighlight = "#2d2d30",
  darkSelection = "#3e3e42",
  darkSelectionAlt = "#4a4a4e",
  darkBorder = "#3e3e42",
  darkSearchMatch = "#5a5a5a",
  darkSearchBorder = "#6e6e6e",
  darkCursor = "#cccccc",
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

  '.cm-cursor, .cm-dropCursor': {borderLeftColor: darkCursor},
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {backgroundColor: darkSelection},

  '.cm-panels': {backgroundColor: darkBackground, color: darkText},
  '.cm-panels.cm-panels-top': {borderBottom: `1px solid ${darkBorder}`},
  '.cm-panels.cm-panels-bottom': {borderTop: `1px solid ${darkBorder}`},

  '.cm-searchMatch': {
    backgroundColor: darkSearchMatch,
    outline: `1px solid ${darkSearchBorder}`
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: darkSelectionAlt
  },

  '.cm-activeLine': {backgroundColor: "#6699ff0b"},
  '.cm-selectionMatch': {backgroundColor: "#aafe661a"},

  '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: darkSelectionAlt
  },

  '.cm-gutters': {
    backgroundColor: darkBackground,
    color: darkTextTertiary,
    border: 'none'
  },

  '.cm-activeLineGutter': {
    backgroundColor: darkBackgroundHighlight
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
}, {dark: true})

/// The highlighting style for code in the Grey Dark theme.
export const greyDarkHighlightStyle = oneDarkHighlightStyle

/// Extension to enable the Grey Dark theme (both the editor theme and
/// the highlight style).
export const greyDark: Extension = [greyDarkTheme, syntaxHighlighting(greyDarkHighlightStyle)]

// Light theme colors
const lightText = "#1e1e1e",
  lightTextSecondary = "#2e2e2e",
  lightTextTertiary = "#6e6e6e",
  lightBackground = "#f5f5f5",
  lightBackgroundHighlight = "#ebebeb",
  lightSelection = "#d4d4d4",
  lightSelectionAlt = "#e0e0e0",
  lightBorder = "#d1d1d1",
  lightSearchMatch = "#e0e0e0",
  lightSearchBorder = "#c8c8c8",
  lightCursor = "#1e1e1e",
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

  '.cm-cursor, .cm-dropCursor': {borderLeftColor: lightCursor},
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {backgroundColor: lightSelection},

  '.cm-panels': {backgroundColor: lightBackgroundHighlight, color: lightText},
  '.cm-panels.cm-panels-top': {borderBottom: `1px solid ${lightBorder}`},
  '.cm-panels.cm-panels-bottom': {borderTop: `1px solid ${lightBorder}`},

  '.cm-searchMatch': {
    backgroundColor: lightSearchMatch,
    outline: `1px solid ${lightSearchBorder}`
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: lightSelection
  },

  '.cm-activeLine': {backgroundColor: "#6699ff0b"},
  '.cm-selectionMatch': {backgroundColor: "#aafe661a"},

  '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: lightSelection
  },

  '.cm-gutters': {
    backgroundColor: lightBackground,
    color: lightTextTertiary,
    border: 'none'
  },

  '.cm-activeLineGutter': {
    backgroundColor: lightBackgroundHighlight
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
}, {dark: false})

/// The highlighting style for code in the Grey Light theme.
export const greyLightHighlightStyle = HighlightStyle.define([
  {tag: t.keyword,
   color: '#0066cc'},
  {tag: [t.name, t.deleted, t.character, t.propertyName, t.macroName],
   color: lightTextSecondary},
  {tag: [t.function(t.variableName), t.labelName],
   color: '#6f42c1'},
  {tag: [t.color, t.constant(t.name), t.standard(t.name)],
   color: '#005cc5'},
  {tag: [t.definition(t.name), t.separator],
   color: lightText},
  {tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace],
   color: '#d73a49'},
  {tag: [t.operator, t.operatorKeyword, t.url, t.escape, t.regexp, t.link, t.special(t.string)],
   color: '#d73a49'},
  {tag: [t.meta, t.comment],
   color: '#6a737d'},
  {tag: t.strong,
   fontWeight: 'bold'},
  {tag: t.emphasis,
   fontStyle: 'italic'},
  {tag: t.strikethrough,
   textDecoration: 'line-through'},
  {tag: t.link,
   color: '#0366d6',
   textDecoration: 'underline'},
  {tag: t.heading,
   fontWeight: 'bold',
   color: lightText},
  {tag: [t.atom, t.bool, t.special(t.variableName)],
   color: '#e36209'},
  {tag: [t.processingInstruction, t.string, t.inserted],
   color: '#22863a'},
  {tag: t.invalid,
   color: lightInvalid},
])

/// Extension to enable the Grey Light theme (both the editor theme and
/// the highlight style).
export const greyLight: Extension = [greyLightTheme, syntaxHighlighting(greyLightHighlightStyle)]
