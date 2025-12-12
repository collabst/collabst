<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { EditorView, basicSetup } from 'codemirror'
  import { EditorState } from '@codemirror/state'
  import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
  import { oneDark } from '@codemirror/theme-one-dark'
  import { keymap } from '@codemirror/view'
  import * as Y from 'yjs'
  import type { WebsocketProvider } from 'y-websocket'

  export let ytext: Y.Text
  export let provider: WebsocketProvider
  export let fileId: number

  let editorElement: HTMLDivElement
  let view: EditorView | null = null
  let undoManager: Y.UndoManager | null = null
  let currentFileId: number | null = null

  function initializeEditor() {
    if (!editorElement || !ytext || !provider) return

    console.log('[CodeEditor] Initializing editor for file', fileId)
    currentFileId = fileId

    undoManager = new Y.UndoManager(ytext)

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        oneDark,
        yCollab(ytext, provider.awareness, { undoManager }),
        keymap.of(yUndoManagerKeymap),
      ],
    })

    view = new EditorView({
      state,
      parent: editorElement,
    })
  }

  function switchFile() {
    if (!view || !ytext || !provider) return
    if (currentFileId === fileId) return

    console.log('[CodeEditor] Switching from file', currentFileId, 'to', fileId)
    currentFileId = fileId

    if (undoManager) {
      undoManager.destroy()
    }
    undoManager = new Y.UndoManager(ytext)

    view.setState(EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        oneDark,
        yCollab(ytext, provider.awareness, { undoManager }),
        keymap.of(yUndoManagerKeymap),
      ],
    }))
  }

  $: if (view && ytext && provider && currentFileId !== fileId) {
    switchFile()
  }

  onMount(() => {
    initializeEditor()
  })

  onDestroy(() => {
    console.log('[CodeEditor] Destroying editor')
    if (view) {
      view.destroy()
      view = null
    }
    if (undoManager) {
      undoManager.destroy()
      undoManager = null
    }
    currentFileId = null
  })
</script>

<div bind:this={editorElement} class="editor" />

<style>
  .editor {
    height: 100%;
    font-size: 14px;
    font-family: monospace;
  }

  :global(.cm-editor) {
    height: 100%;
  }
</style>
