import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Same palette as the Typst highlighter.
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

// codemirror-lang-bib's parser emits 'definitionKeyword' for entry types,
// 'atom' for citation keys and 'name' for field names.

export const bibtexDarkHighlightStyle = HighlightStyle.define([
    {
        tag: t.definitionKeyword,
        color: darkColors.green,
        fontWeight: 'bold'
    },

    {
        tag: t.keyword,
        color: darkColors.purple,
        fontWeight: 'normal'
    },

    {
        tag: t.string,
        color: darkColors.normal,
        fontWeight: 'normal'
    },
])

export const bibtexLightHighlightStyle = HighlightStyle.define([
    {
        tag: t.definitionKeyword,
        color: lightColors.green,
        fontWeight: 'bold'
    },

    {
        tag: t.keyword,
        color: lightColors.purple,
        fontWeight: 'normal'
    },

    {
        tag: t.string,
        color: lightColors.normal,
        fontWeight: 'normal'
    },
])

export const bibtexDark: Extension = syntaxHighlighting(bibtexDarkHighlightStyle)

export const bibtexLight: Extension = syntaxHighlighting(bibtexLightHighlightStyle)
