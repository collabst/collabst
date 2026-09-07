import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Palettes are shared with the grey editor theme.
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

// Tags come from codemirror-lang-typst.
export const typstDarkHighlightStyle = HighlightStyle.define([
    {
        tag: [t.controlKeyword, t.definitionKeyword, t.operatorKeyword],
        color: darkColors.red,
        fontWeight: 'normal'
    },

    {
        tag: t.moduleKeyword,
        color: darkColors.purple,
        fontWeight: 'normal'
    },

    {
        tag: [t.variableName, t.special(t.variableName)],
        color: darkColors.blue,
        fontWeight: 'normal'
    },

    {
        tag: [t.integer, t.float, t.number],
        color: darkColors.bordeaux,
        fontWeight: 'normal'
    },

    {
        tag: t.bool,
        color: darkColors.bordeaux,
        fontWeight: 'normal'
    },

    {
        tag: t.literal,
        color: darkColors.red,
        fontWeight: 'normal'
    },

    {
        tag: [t.string, t.special(t.string)],
        color: darkColors.green,
        fontWeight: 'normal'
    },

    {
        tag: t.comment,
        color: darkColors.grey
    },

    {
        tag: [t.escape, t.contentSeparator],
        color: darkColors.turquoise,
        fontWeight: 'normal'
    },

    {
        tag: t.labelName,
        color: darkColors.turquoise,
        fontWeight: 'normal'
    },

    {
        tag: [t.arithmeticOperator, t.compareOperator, t.updateOperator, t.typeOperator, t.controlOperator],
        color: darkColors.normal,
        fontWeight: 'normal'
    },

    {
        tag: [t.paren, t.bracket, t.brace],
        color: darkColors.normal
    },

    {
        tag: [t.punctuation, t.separator],
        color: darkColors.normal
    },

    {
        tag: t.monospace,
        color: darkColors.normal,
        fontWeight: 'normal'
    },

    {
        tag: t.special(t.contentSeparator),
        color: darkColors.normal
    },

    {
        tag: t.heading,
        fontWeight: 'bold',
        textDecoration: 'underline',
        color: darkColors.normal
    },

    {
        tag: t.strong,
        fontWeight: 'bold',
        color: darkColors.normal
    },

    {
        tag: t.emphasis,
        fontStyle: 'italic',
        color: darkColors.normal
    },

    {
        tag: t.link,
        color: darkColors.blue,
        textDecoration: 'underline'
    },

    {
        tag: [t.list, t.definitionOperator],
        color: darkColors.purple
    },

    {
        tag: t.quote,
        color: darkColors.normal
    },

    {
        tag: t.annotation,
        color: darkColors.grey
    },

    {
        tag: t.documentMeta,
        color: darkColors.grey
    },

    {
        tag: t.content,
        color: darkColors.normal
    },

    {
        tag: t.invalid,
        color: darkColors.error,
        backgroundColor: darkColors.errorBg
    },
])

export const typstLightHighlightStyle = HighlightStyle.define([
    {
        tag: [t.controlKeyword, t.definitionKeyword, t.operatorKeyword],
        color: lightColors.red,
        fontWeight: 'normal'
    },

    {
        tag: t.moduleKeyword,
        color: lightColors.purple,
        fontWeight: 'normal'
    },

    {
        tag: [t.variableName, t.special(t.variableName)],
        color: lightColors.blue,
        fontWeight: 'normal'
    },

    {
        tag: [t.integer, t.float, t.number],
        color: lightColors.bordeaux,
        fontWeight: 'normal'
    },

    {
        tag: t.bool,
        color: lightColors.bordeaux,
        fontWeight: 'normal'
    },

    {
        tag: t.literal,
        color: lightColors.red,
        fontWeight: 'normal'
    },

    {
        tag: [t.string, t.special(t.string)],
        color: lightColors.green,
        fontWeight: 'normal'
    },

    {
        tag: t.comment,
        color: lightColors.grey
    },

    {
        tag: [t.escape, t.contentSeparator],
        color: lightColors.turquoise,
        fontWeight: 'normal'
    },

    {
        tag: t.labelName,
        color: lightColors.turquoise,
        fontWeight: 'normal'
    },

    {
        tag: [t.arithmeticOperator, t.compareOperator, t.updateOperator, t.typeOperator, t.controlOperator],
        color: lightColors.normal,
        fontWeight: 'normal'
    },

    {
        tag: [t.paren, t.bracket, t.brace],
        color: lightColors.normal
    },

    {
        tag: [t.punctuation, t.separator],
        color: lightColors.normal
    },

    {
        tag: t.monospace,
        color: lightColors.normal,
        fontWeight: 'normal'
    },

    {
        tag: t.special(t.contentSeparator),
        color: lightColors.normal
    },

    {
        tag: t.heading,
        fontWeight: 'bold',
        textDecoration: 'underline',
        color: lightColors.normal
    },

    {
        tag: t.strong,
        fontWeight: 'bold',
        color: lightColors.normal
    },

    {
        tag: t.emphasis,
        fontStyle: 'italic',
        color: lightColors.normal
    },

    {
        tag: t.link,
        color: lightColors.blue,
        textDecoration: 'underline'
    },

    {
        tag: [t.list, t.definitionOperator],
        color: lightColors.purple
    },

    {
        tag: t.quote,
        color: lightColors.normal
    },

    {
        tag: t.annotation,
        color: lightColors.grey
    },

    {
        tag: t.documentMeta,
        color: lightColors.grey
    },

    {
        tag: t.content,
        color: lightColors.normal
    },

    {
        tag: t.invalid,
        color: lightColors.error,
        backgroundColor: lightColors.errorBg
    },
])

export const typstDark: Extension = syntaxHighlighting(typstDarkHighlightStyle)

export const typstLight: Extension = syntaxHighlighting(typstLightHighlightStyle)
