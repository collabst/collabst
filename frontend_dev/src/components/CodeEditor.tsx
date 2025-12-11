import React, { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yCollab, yUndoManagerKeymap } from 'y-codemirror.next'
import { oneDark } from '@codemirror/theme-one-dark'
import { keymap } from '@codemirror/view'
import * as Y from 'yjs'
import type { WebsocketProvider } from 'y-websocket'

interface CodeEditorProps {
  ytext: Y.Text
  provider: WebsocketProvider
  fileId: number
}

/**
 * CodeMirror editor with YJS collaboration.
 * 
 * This component does NOT handle saving - YJS handles all sync automatically:
 * 1. Changes are synced to other clients via WebSocket in real-time
 * 2. Changes are persisted locally in IndexedDB for offline support
 * 3. The backend persists YJS state to Redis
 */
export const CodeEditor: React.FC<CodeEditorProps> = ({
  ytext,
  provider,
  fileId,
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const currentFileIdRef = useRef<number | null>(null)
  const undoManagerRef = useRef<Y.UndoManager | null>(null)

  // Handle file switching - reconfigure editor without destroying it
  useEffect(() => {
    if (!editorRef.current || !ytext || !provider) return

    // If switching files, reconfigure the editor instead of destroying it
    if (viewRef.current && currentFileIdRef.current !== fileId) {
      console.log('[CodeEditor] Switching from file', currentFileIdRef.current, 'to', fileId)
      currentFileIdRef.current = fileId

      // Create new undo manager for this file
      if (undoManagerRef.current) {
        undoManagerRef.current.destroy()
      }
      undoManagerRef.current = new Y.UndoManager(ytext)

      // Reconfigure editor with new ytext
      viewRef.current.setState(EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          oneDark,
          yCollab(ytext, provider.awareness, { undoManager: undoManagerRef.current }),
          keymap.of(yUndoManagerKeymap),
        ],
      }))

      return
    }

    // First time initialization
    if (!viewRef.current) {
      console.log('[CodeEditor] Initializing editor for file', fileId)
      currentFileIdRef.current = fileId

      // Create undo manager for this file
      undoManagerRef.current = new Y.UndoManager(ytext)

      // Create editor state
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          oneDark,
          yCollab(ytext, provider.awareness, { undoManager: undoManagerRef.current }),
          keymap.of(yUndoManagerKeymap),
        ],
      })

      // Create editor view
      const view = new EditorView({
        state,
        parent: editorRef.current,
      })

      viewRef.current = view
    }
  }, [ytext, provider, fileId])

  // Cleanup only on unmount (separate effect with empty deps)
  useEffect(() => {
    return () => {
      console.log('[CodeEditor] Unmounting - destroying editor')
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
      if (undoManagerRef.current) {
        undoManagerRef.current.destroy()
        undoManagerRef.current = null
      }
      currentFileIdRef.current = null
    }
  }, [])

  return (
    <div
      ref={editorRef}
      style={{
        height: '100%',
        fontSize: '14px',
        fontFamily: 'monospace',
      }}
    />
  )
}
