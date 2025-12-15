<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import { EditorView, basicSetup } from 'codemirror'
  import { EditorState, Compartment } from '@codemirror/state'
  import { lintGutter, setDiagnostics } from '@codemirror/lint'
  import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
  import { greyDark, greyLight } from '$lib/codemirror/greyTheme'
  import { keymap } from '@codemirror/view'
  import * as Y from 'yjs'
  import type { WebsocketProvider } from 'y-websocket'
  import { commentsExtension, CommentRangeTracker } from '$lib/codemirror/comments'
  import { theme as themeStore } from '$lib/stores/theme'
  import { convertDiagnosticsToLint } from '$lib/preview/diagnostics'
  import type { Diagnostic } from '$lib/types'

  export let ytext: Y.Text
  export let provider: WebsocketProvider
  export let fileId: number
  export let ydoc: Y.Doc
  export let onTrackerReady: ((tracker: CommentRangeTracker) => void) | null = null
  export let diagnostics: Diagnostic[] = []
  export let fileName = ''


  let editorElement: HTMLDivElement
  let view: EditorView | null = null
  let undoManager: Y.UndoManager | null = null
  let currentFileId: number | null = null
  let commentTracker: CommentRangeTracker | null = null
  let currentTheme: 'light' | 'dark' = $themeStore
  const themeCompartment = new Compartment()

  // Subscribe to theme changes
  $: currentTheme = $themeStore
  $: if (view && currentTheme) {
    updateEditorTheme()
  }

  // Get theme extensions based on current theme
  function getThemeExtensions() {
    return currentTheme === 'light' ? [greyLight] : [greyDark]
  }

  // Update editor theme when theme changes
  function updateEditorTheme() {
    if (!view) return
    
    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtensions())
    })
  }
  // Store cursor positions as Yjs relative positions per file
  let cursorPositions: Map<number, any> = new Map()

  // Export methods for comment management
  export function getView() {
    return view
  }

  export function getCommentTracker() {
    return commentTracker
  }

  export function getSelection() {
    if (!view) return null
    const { from, to } = view.state.selection.main
    return {
      from,
      to,
      text: view.state.doc.sliceString(from, to)
    }
  }

  function initializeEditor() {
    if (!editorElement || !ytext || !provider) return

    console.log('[CodeEditor] Initializing editor for file', fileId)
    currentFileId = fileId

    undoManager = new Y.UndoManager(ytext)

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        EditorView.lineWrapping,
        basicSetup,
        themeCompartment.of(getThemeExtensions()),
        yCollab(ytext, provider.awareness, { undoManager }),
        keymap.of(yUndoManagerKeymap),
        commentsExtension(),
        lintGutter(),
      ],
    })

    view = new EditorView({
      state,
      parent: editorElement,
    })

    // Focus the editor
    view.focus()

    // Initialize comment tracker
    commentTracker = new CommentRangeTracker(ydoc, fileId, view)

    // Notify parent that tracker is ready
    if (onTrackerReady) {
      onTrackerReady(commentTracker)
    }
  }

  function switchFile() {
    if (!view || !ytext || !provider) return
    if (currentFileId === fileId) return

    console.log('[CodeEditor] Switching from file', currentFileId, 'to', fileId)

    // Save current cursor position as relative position before switching
    if (currentFileId !== null) {
      const currentYtext = ydoc.getText(`file-${currentFileId}`)
      const selection = view.state.selection.main
      const relativePos = Y.createRelativePositionFromTypeIndex(currentYtext, selection.head)
      cursorPositions.set(currentFileId, Y.relativePositionToJSON(relativePos))
    }

    currentFileId = fileId

    if (undoManager) {
      undoManager.destroy()
    }
    undoManager = new Y.UndoManager(ytext)

    // Destroy old comment tracker
    if (commentTracker) {
      commentTracker.destroy()
    }

    view.setState(EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        themeCompartment.of(getThemeExtensions()),
        yCollab(ytext, provider.awareness, { undoManager }),
        keymap.of(yUndoManagerKeymap),
        commentsExtension(),
        lintGutter(),
      ],
    }))

    // Restore cursor position if we have one saved
    const savedPosition = cursorPositions.get(fileId)
    if (savedPosition) {
      const relativePos = Y.createRelativePositionFromJSON(savedPosition)
      const absolutePos = Y.createAbsolutePositionFromRelativePosition(relativePos, ydoc)
      if (absolutePos) {
        view.dispatch({
          selection: { anchor: absolutePos.index, head: absolutePos.index }
        })
      }
    }

    // Focus the editor
    view.focus()

    // Initialize new comment tracker for this file
    commentTracker = new CommentRangeTracker(ydoc, fileId, view)

    // Notify parent that tracker is ready
    if (onTrackerReady) {
      onTrackerReady(commentTracker)
    }
  }

  $: if (view && ytext && provider && currentFileId !== fileId) {
    switchFile()
  }

  // Update lint markers when diagnostics change
  onMount(() => {
    initializeEditor()
  })

  onDestroy(() => {
    console.log('[CodeEditor] Destroying editor')
    if (commentTracker) {
      commentTracker.destroy()
      commentTracker = null
    }
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

<div bind:this={editorElement} class="editor"></div>

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
