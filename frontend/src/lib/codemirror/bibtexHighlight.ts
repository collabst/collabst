import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Dark theme color palette (same as Typst)
const darkColors = {
    red: '#ea736fff',
    blue: '#8ab7ffff',
    purple: '#ce91f7ff',
    bordeaux: '#ff86aaff',
    green: '#91e79dff',
    turquoise: '#79d3c8ff',
    grey: '#949494ff',
    normal: '#cccccc',
    error: '#f48771',
    errorBg: '#3f0d0d'
}

// Light theme color palette (same as Typst)
const lightColors = {
    red: '#d1443aff',
    blue: '#4e7ccbff',
    purple: '#9c4dcc',
    bordeaux: '#af2c7bff',
    green: '#28a03eff',
    turquoise: '#17a496ff',
    grey: '#838383ff',
    normal: '#1e1e1e',
    error: '#cd3131',
    errorBg: '#f4dada'
}

// The codemirror-lang-bib StreamLanguage parser returns these token types:
// - 'definitionKeyword' for entry types (@article, @book) -> maps to t.definitionKeyword
// - 'atom' for citation keys -> maps to t.atom
// - 'name' for field names (author, title, etc.) -> maps to t.name

// Dark theme BibTeX syntax highlighting
// Designed for dark backgrounds with pastel colors and good readability
export const bibtexDarkHighlightStyle = HighlightStyle.define([
    // Entry types (@article, @book, etc.) - Green
    {
        tag: t.definitionKeyword,
        color: darkColors.green,
        fontWeight: 'bold'
    },

    // Field names (author, title, journal, etc.) - Purple
    {
        tag: t.keyword,
        color: darkColors.purple,
        fontWeight: 'normal'
    },

    // Field values (strings) - Normal
    {
        tag: t.string,
        color: darkColors.normal,
        fontWeight: 'normal'
    },
])

// Light theme BibTeX syntax highlighting
// Designed for light backgrounds with darker colors and optimal contrast
export const bibtexLightHighlightStyle = HighlightStyle.define([
    // Entry types (@article, @book, etc.) - Green
    {
        tag: t.definitionKeyword,
        color: lightColors.green,
        fontWeight: 'bold'
    },

    // Field names (author, title, journal, etc.) - Purple
    {
        tag: t.keyword,
        color: lightColors.purple,
        fontWeight: 'normal'
    },

    // Field values (strings) - Normal
    {
        tag: t.string,
        color: lightColors.normal,
        fontWeight: 'normal'
    },
])

// Export both dark and light extensions
/// Extension to enable BibTeX syntax highlighting for dark themes
export const bibtexDark: Extension = syntaxHighlighting(bibtexDarkHighlightStyle)

/// Extension to enable BibTeX syntax highlighting for light themes
export const bibtexLight: Extension = syntaxHighlighting(bibtexLightHighlightStyle)
