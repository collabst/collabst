import type { Extension } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// Dark theme color palette
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

// Light theme color palette
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

// Dark theme Typst syntax highlighting
// Designed for dark backgrounds with pastel colors and good readability
// Based on actual codemirror-lang-typst tag definitions
export const typstDarkHighlightStyle = HighlightStyle.define([
    // Keywords (control, definition, operator) - Red
    // controlKeyword: If Else For While Break Continue Return, Hash, Dollar
    // definitionKeyword: Let Set Show Context
    // operatorKeyword: Not And Or As In
    {
        tag: [t.controlKeyword, t.definitionKeyword, t.operatorKeyword],
        color: darkColors.red,
        fontWeight: 'normal'
    },

    // Import/Include - Purple
    {
        tag: t.moduleKeyword,
        color: darkColors.purple,
        fontWeight: 'normal'
    },

    // Variable names and identifiers (including function names) - Blue
    {
        tag: [t.variableName, t.special(t.variableName)],
        color: darkColors.blue,
        fontWeight: 'normal'
    },

    // Numbers (Int, Float, Numeric) - Bordeaux
    {
        tag: [t.integer, t.float, t.number],
        color: darkColors.bordeaux,
        fontWeight: 'normal'
    },

    // Booleans - Bordeaux (like numbers)
    {
        tag: t.bool,
        color: darkColors.bordeaux,
        fontWeight: 'normal'
    },

    // Literals (None, Auto) - Red
    {
        tag: t.literal,
        color: darkColors.red,
        fontWeight: 'normal'
    },

    // Strings (Str) and Math text content - Green
    {
        tag: [t.string, t.special(t.string)],
        color: darkColors.green,
        fontWeight: 'normal'
    },

    // Comments (LineComment, BlockComment) - Grey
    {
        tag: t.comment,
        color: darkColors.grey
    },

    // Escape characters, ParBreak - Turquoise
    {
        tag: [t.escape, t.contentSeparator],
        color: darkColors.turquoise,
        fontWeight: 'normal'
    },

    // Labels and references - Turquoise
    {
        tag: t.labelName,
        color: darkColors.turquoise,
        fontWeight: 'normal'
    },

    // Operators - Normal text color
    {
        tag: [t.arithmeticOperator, t.compareOperator, t.updateOperator, t.typeOperator, t.controlOperator],
        color: darkColors.normal,
        fontWeight: 'normal'
    },

    // Parentheses, brackets, braces - Normal text color
    {
        tag: [t.paren, t.bracket, t.brace],
        color: darkColors.normal
    },

    // Punctuation (Semicolon, Colon, Dot, Dots, Comma) - Normal text
    {
        tag: [t.punctuation, t.separator],
        color: darkColors.normal
    },

    // Raw/Code blocks (Raw, Code) - Normal color
    {
        tag: t.monospace,
        color: darkColors.normal,
        fontWeight: 'normal'
    },

    // Math content separators - Normal text
    {
        tag: t.special(t.contentSeparator),
        color: darkColors.normal
    },

    // Headings - Bold and underlined, normal text color
    {
        tag: t.heading,
        fontWeight: 'bold',
        textDecoration: 'underline',
        color: darkColors.normal
    },

    // Strong/Bold text (*text*) - Keep bold for actual bold content
    {
        tag: t.strong,
        fontWeight: 'bold',
        color: darkColors.normal
    },

    // Emphasis/Italic text (_text_) - Keep italic for actual italic content
    {
        tag: t.emphasis,
        fontStyle: 'italic',
        color: darkColors.normal
    },

    // Links - Blue with underline
    {
        tag: t.link,
        color: darkColors.blue,
        textDecoration: 'underline'
    },

    // List and enum markers - Purple
    {
        tag: [t.list, t.definitionOperator],
        color: darkColors.purple
    },

    // Quotes - Normal text
    {
        tag: t.quote,
        color: darkColors.normal
    },

    // Annotations (RawLang) - Grey
    {
        tag: t.annotation,
        color: darkColors.grey
    },

    // Document meta (Shebang) - Grey
    {
        tag: t.documentMeta,
        color: darkColors.grey
    },

    // Text content - Normal text
    {
        tag: t.content,
        color: darkColors.normal
    },

    // Invalid/Error
    {
        tag: t.invalid,
        color: darkColors.error,
        backgroundColor: darkColors.errorBg
    },
])

// Light theme Typst syntax highlighting
// Designed for light backgrounds with pastel colors and optimal contrast
// Based on actual codemirror-lang-typst tag definitions
export const typstLightHighlightStyle = HighlightStyle.define([
    // Keywords (control, definition, operator) - Red
    // controlKeyword: If Else For While Break Continue Return, Hash, Dollar
    // definitionKeyword: Let Set Show Context
    // operatorKeyword: Not And Or As In
    {
        tag: [t.controlKeyword, t.definitionKeyword, t.operatorKeyword],
        color: lightColors.red,
        fontWeight: 'normal'
    },

    // Import/Include - Purple
    {
        tag: t.moduleKeyword,
        color: lightColors.purple,
        fontWeight: 'normal'
    },

    // Variable names and identifiers (including function names) - Blue
    {
        tag: [t.variableName, t.special(t.variableName)],
        color: lightColors.blue,
        fontWeight: 'normal'
    },

    // Numbers (Int, Float, Numeric) - Bordeaux
    {
        tag: [t.integer, t.float, t.number],
        color: lightColors.bordeaux,
        fontWeight: 'normal'
    },

    // Booleans - Bordeaux (like numbers)
    {
        tag: t.bool,
        color: lightColors.bordeaux,
        fontWeight: 'normal'
    },

    // Literals (None, Auto) - Red
    {
        tag: t.literal,
        color: lightColors.red,
        fontWeight: 'normal'
    },

    // Strings (Str) and Math text content - Green
    {
        tag: [t.string, t.special(t.string)],
        color: lightColors.green,
        fontWeight: 'normal'
    },

    // Comments (LineComment, BlockComment) - Grey
    {
        tag: t.comment,
        color: lightColors.grey
    },

    // Escape characters, ParBreak - Turquoise
    {
        tag: [t.escape, t.contentSeparator],
        color: lightColors.turquoise,
        fontWeight: 'normal'
    },

    // Labels and references - Turquoise
    {
        tag: t.labelName,
        color: lightColors.turquoise,
        fontWeight: 'normal'
    },

    // Operators - Normal text color
    {
        tag: [t.arithmeticOperator, t.compareOperator, t.updateOperator, t.typeOperator, t.controlOperator],
        color: lightColors.normal,
        fontWeight: 'normal'
    },

    // Parentheses, brackets, braces - Normal text color
    {
        tag: [t.paren, t.bracket, t.brace],
        color: lightColors.normal
    },

    // Punctuation (Semicolon, Colon, Dot, Dots, Comma) - Normal text
    {
        tag: [t.punctuation, t.separator],
        color: lightColors.normal
    },

    // Raw/Code blocks (Raw, Code) - Normal color
    {
        tag: t.monospace,
        color: lightColors.normal,
        fontWeight: 'normal'
    },

    // Math content separators - Normal text
    {
        tag: t.special(t.contentSeparator),
        color: lightColors.normal
    },

    // Headings - Bold and underlined, normal text color
    {
        tag: t.heading,
        fontWeight: 'bold',
        textDecoration: 'underline',
        color: lightColors.normal
    },

    // Strong/Bold text (*text*) - Keep bold for actual bold content
    {
        tag: t.strong,
        fontWeight: 'bold',
        color: lightColors.normal
    },

    // Emphasis/Italic text (_text_) - Keep italic for actual italic content
    {
        tag: t.emphasis,
        fontStyle: 'italic',
        color: lightColors.normal
    },

    // Links - Blue with underline
    {
        tag: t.link,
        color: lightColors.blue,
        textDecoration: 'underline'
    },

    // List and enum markers - Purple
    {
        tag: [t.list, t.definitionOperator],
        color: lightColors.purple
    },

    // Quotes - Normal text
    {
        tag: t.quote,
        color: lightColors.normal
    },

    // Annotations (RawLang) - Grey
    {
        tag: t.annotation,
        color: lightColors.grey
    },

    // Document meta (Shebang) - Grey
    {
        tag: t.documentMeta,
        color: lightColors.grey
    },

    // Text content - Normal text
    {
        tag: t.content,
        color: lightColors.normal
    },

    // Invalid/Error
    {
        tag: t.invalid,
        color: lightColors.error,
        backgroundColor: lightColors.errorBg
    },
])

// Export both dark and light extensions
/// Extension to enable Typst syntax highlighting for dark themes
export const typstDark: Extension = syntaxHighlighting(typstDarkHighlightStyle)

/// Extension to enable Typst syntax highlighting for light themes
export const typstLight: Extension = syntaxHighlighting(typstLightHighlightStyle)
