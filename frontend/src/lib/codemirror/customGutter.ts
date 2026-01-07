import { lineNumbers } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/**
 * Custom gutter configuration for CodeMirror
 * 
 * This extension provides minimal line numbers with minimal padding
 * to maximize horizontal screen real estate.
 */

// Minimal gutter theme with tight padding
const gutterTheme = EditorView.baseTheme({
    '.cm-gutters': {
        minWidth: '0px',
    },
    '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 0 0 0',
        minWidth: '0px',
    }
})

/**
 * Custom gutter extension with minimal padding
 * Note: Line numbers are now managed in CodeEditor.svelte with custom error formatting
 */
export const customGutter: Extension = [
    gutterTheme
]
