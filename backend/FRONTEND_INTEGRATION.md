# Frontend Integration Guide

## YJS Real-Time Collaboration Setup

This guide shows how to integrate YJS with your frontend to enable Google Docs-style real-time collaboration for Typst documents.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (React/Vue/Svelte)         │
│                                                      │
│  ┌────────────────┐         ┌──────────────────┐   │
│  │   Text Editor  │◄───────►│   YJS Y.Doc      │   │
│  │   (Monaco/CM)  │         │   (CRDT State)   │   │
│  └────────────────┘         └─────────┬────────┘   │
│                                       │             │
│                           ┌───────────▼─────────┐  │
│                           │  WebSocket Provider │  │
│                           │  (Y-WebSocket)      │  │
│                           └──────────┬──────────┘  │
└──────────────────────────────────────┼─────────────┘
                                       │
                                       │ WS
                                       ▼
                        ws://backend:8000/ws/{documentId}
                                       │
                        ┌──────────────▼──────────────┐
                        │   Backend YJS Server        │
                        │   (Python y-py)             │
                        └─────────────────────────────┘
```

## Installation (Frontend)

### For React/Next.js

```bash
npm install yjs y-websocket
# Or if using a code editor
npm install yjs y-websocket y-monaco  # For Monaco Editor
npm install yjs y-websocket y-codemirror.next  # For CodeMirror 6
```

### For Vue.js

```bash
npm install yjs y-websocket
npm install @codemirror/state @codemirror/view y-codemirror.next
```

### For Svelte

```bash
npm install yjs y-websocket
npm install codemirror y-codemirror.next
```

## Basic YJS Setup (Vanilla JavaScript)

```javascript
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

// 1. Create a YJS document
const ydoc = new Y.Doc()

// 2. Get the shared text type
const ytext = ydoc.getText('typst-content')

// 3. Connect to WebSocket server
const wsProvider = new WebsocketProvider(
  'ws://localhost:8000/ws',  // WebSocket URL
  'document-123',             // Document ID (use file.id from your DB)
  ydoc,
  {
    // Optional: Add authentication
    params: {
      token: 'YOUR_JWT_TOKEN'  // You'll need to add auth to backend
    }
  }
)

// 4. Listen for connection status
wsProvider.on('status', event => {
  console.log('Connection status:', event.status) // 'connected' or 'disconnected'
})

// 5. Listen for sync status
wsProvider.on('sync', isSynced => {
  console.log('Document synced:', isSynced)
})

// 6. Update the text (this will sync to all clients)
ytext.insert(0, 'Hello from YJS!')

// 7. Listen for changes
ytext.observe(event => {
  console.log('Text changed:', ytext.toString())
})

// 8. Clean up when done
window.addEventListener('beforeunload', () => {
  wsProvider.destroy()
  ydoc.destroy()
})
```

## React Integration with Monaco Editor

```jsx
import React, { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { MonacoBinding } from 'y-monaco'
import Editor from '@monaco-editor/react'

function CollaborativeEditor({ fileId, authToken }) {
  const [ydoc] = useState(() => new Y.Doc())
  const [provider, setProvider] = useState(null)
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Create WebSocket provider
    const wsProvider = new WebsocketProvider(
      `ws://localhost:8000/ws`,
      `file-${fileId}`,  // Unique document ID per file
      ydoc
    )

    // Listen for connection status
    wsProvider.on('status', event => {
      setIsConnected(event.status === 'connected')
    })

    setProvider(wsProvider)

    // Cleanup
    return () => {
      wsProvider.destroy()
      ydoc.destroy()
    }
  }, [fileId, ydoc])

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Get the YJS text type
    const ytext = ydoc.getText('content')

    // Bind Monaco editor to YJS
    const binding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider?.awareness
    )

    // Optional: Add cursors/selections awareness
    provider.awareness.setLocalStateField('user', {
      name: 'User Name',  // Get from your auth context
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    })
  }

  return (
    <div>
      <div style={{
        padding: '10px',
        background: isConnected ? '#4caf50' : '#f44336',
        color: 'white'
      }}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <Editor
        height="90vh"
        language="typst"
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
        }}
      />
    </div>
  )
}

export default CollaborativeEditor
```

## React Integration with CodeMirror 6

```jsx
import React, { useEffect, useRef } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'

function CollaborativeEditor({ fileId }) {
  const editorRef = useRef(null)
  const viewRef = useRef(null)

  useEffect(() => {
    if (!editorRef.current) return

    // Create YJS document
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('codemirror')

    // Connect to WebSocket
    const provider = new WebsocketProvider(
      'ws://localhost:8000/ws',
      `file-${fileId}`,
      ydoc
    )

    // Create CodeMirror state with YJS collaboration
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        basicSetup,
        yCollab(ytext, provider.awareness)
      ]
    })

    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    // Cleanup
    return () => {
      view.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [fileId])

  return <div ref={editorRef} />
}

export default CollaborativeEditor
```

## Vue.js Integration

```vue
<template>
  <div>
    <div :class="connectionStatus">
      {{ isConnected ? '🟢 Connected' : '🔴 Disconnected' }}
    </div>
    <div ref="editorElement"></div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { yCollab } from 'y-codemirror.next'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'

export default {
  props: {
    fileId: {
      type: Number,
      required: true
    }
  },
  setup(props) {
    const editorElement = ref(null)
    const isConnected = ref(false)
    let ydoc, provider, view

    onMounted(() => {
      // Initialize YJS
      ydoc = new Y.Doc()
      const ytext = ydoc.getText('content')

      // Connect WebSocket
      provider = new WebsocketProvider(
        'ws://localhost:8000/ws',
        `file-${props.fileId}`,
        ydoc
      )

      provider.on('status', event => {
        isConnected.value = event.status === 'connected'
      })

      // Create editor
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          basicSetup,
          yCollab(ytext, provider.awareness)
        ]
      })

      view = new EditorView({
        state,
        parent: editorElement.value
      })
    })

    onUnmounted(() => {
      view?.destroy()
      provider?.destroy()
      ydoc?.destroy()
    })

    return {
      editorElement,
      isConnected
    }
  }
}
</script>

<style scoped>
.connected {
  background: #4caf50;
  color: white;
  padding: 10px;
}
.disconnected {
  background: #f44336;
  color: white;
  padding: 10px;
}
</style>
```

## Complete Workflow

### 1. Load File from Backend

```javascript
// Fetch file metadata and content from API
async function loadFile(fileId, authToken) {
  const response = await fetch(`http://localhost:8000/api/v1/projects/1/files/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  })

  const file = await response.json()
  return file
}
```

### 2. Initialize YJS with Existing Content

```javascript
const file = await loadFile(fileId, authToken)

const ydoc = new Y.Doc()
const ytext = ydoc.getText('content')

// Initialize with existing content from database
if (file.content) {
  ytext.insert(0, file.content)
}

// Then connect to WebSocket
const provider = new WebsocketProvider(
  'ws://localhost:8000/ws',
  `file-${fileId}`,
  ydoc
)
```

### 3. Periodic Saves to Backend

```javascript
// Auto-save every 30 seconds
let saveTimer
ytext.observe(() => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const content = ytext.toString()

    // Save to backend
    await fetch(`http://localhost:8000/api/v1/projects/1/files/${fileId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    })

    console.log('✅ Saved to database')
  }, 30000)  // 30 seconds
})
```

### 4. User Presence (Show Cursors)

```javascript
// Set local user info
provider.awareness.setLocalStateField('user', {
  name: 'John Doe',
  color: '#3b82f6',
  email: 'john@example.com'
})

// Listen for other users
provider.awareness.on('change', () => {
  const states = provider.awareness.getStates()

  states.forEach((state, clientId) => {
    if (clientId !== provider.awareness.clientID) {
      console.log('User connected:', state.user)
      // Show their cursor in the editor
    }
  })
})
```

## Backend Updates Needed

### Add Authentication to WebSocket

Update `app/websocket/yjs_server.py`:

```python
from fastapi import WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from app.core.config import settings

async def websocket_endpoint(
    websocket: WebSocket,
    document_id: str,
    token: str = Query(None)  # Optional token query param
):
    # Optional: Verify JWT token
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user_id = payload.get("sub")
            # TODO: Check if user has access to this document
        except JWTError:
            await websocket.close(code=1008)  # Policy violation
            return

    await manager.connect(websocket, document_id)
    # ... rest of implementation
```

## Production Considerations

### 1. Persistence Strategy

```javascript
// Save YJS state to backend periodically
setInterval(async () => {
  const state = Y.encodeStateAsUpdate(ydoc)
  const base64State = btoa(String.fromCharCode(...state))

  // Save to backend
  await fetch('/api/save-state', {
    method: 'POST',
    body: JSON.stringify({ documentId, state: base64State })
  })
}, 60000)  // Every minute
```

### 2. Offline Support

```javascript
import { IndexeddbPersistence } from 'y-indexeddb'

// Store document locally
const indexeddbProvider = new IndexeddbPersistence(`file-${fileId}`, ydoc)

indexeddbProvider.on('synced', () => {
  console.log('Loaded from IndexedDB')
})

// Now works offline!
```

### 3. Conflict Resolution

YJS handles this automatically with CRDT! No manual conflict resolution needed.

## Testing the Integration

### 1. Open Two Browser Windows

```bash
# Window 1
http://localhost:3000/editor/file/123

# Window 2 (incognito or different browser)
http://localhost:3000/editor/file/123
```

### 2. Type in One Window

You should see the changes appear in real-time in the other window!

### 3. Check Network Tab

You should see:
- WebSocket connection to `ws://localhost:8000/ws/file-123`
- Binary messages being sent/received (YJS updates)

## Summary

Your frontend needs to:

1. **Install**: `yjs`, `y-websocket`, and editor binding (`y-monaco` or `y-codemirror.next`)
2. **Create**: A YJS document (`new Y.Doc()`)
3. **Connect**: To your WebSocket server (`ws://backend:8000/ws/{documentId}`)
4. **Bind**: YJS text to your editor
5. **Optional**: Add awareness for cursors/selections
6. **Optional**: Periodic saves to PostgreSQL backend

The backend you already have will handle:
- ✅ WebSocket connections
- ✅ Broadcasting updates between clients
- ✅ CRDT conflict resolution

Just connect your editor and it will work! 🚀
