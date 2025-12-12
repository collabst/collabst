<script lang="ts">
  import CodeEditor from '$lib/components/CodeEditor.svelte'
  import CommentsPanel from './CommentsPanel.svelte'
  import type { File as ProjectFile, Asset, Comment } from '$lib/types'
  import type * as Y from 'yjs'
  import type { WebsocketProvider } from 'y-websocket'

  export let selectedFile: ProjectFile | null
  export let selectedAsset: Asset | null
  export let ytext: Y.Text | null
  export let provider: WebsocketProvider | null
  export let isConnected: boolean
  export let onGetAssetUrl: ((assetId: number) => Promise<string>) | null = null
  export let ydoc: Y.Doc | null
  export let currentUserId: number
  export let currentUserName: string
  export let currentUserColor: string

  let assetPreviewUrl: string | null = null
  let codeEditor: any = null
  let comments: Comment[] = []
  let newCommentDraft: { text: string; range: { from: number; to: number }; selectedText: string } | null = null
  let commentsVersion = 0 // Simple counter to trigger reactivity
  let showCommentButton = false
  let commentButtonPosition = { top: 0, left: 0 }
  let editorContainer: HTMLElement | null = null
  let listenersSetup = false

  $: if (selectedAsset && onGetAssetUrl) {
    loadAssetPreview()
  } else {
    assetPreviewUrl = null
  }

  // Update comments whenever the version changes or file changes
  $: if (codeEditor && selectedFile && (commentsVersion >= 0)) {
    updateCommentsFromTracker()
  }

  // Reset listeners flag when file changes
  $: if (selectedFile) {
    listenersSetup = false
  }

  // Setup selection listeners when editor is ready
  $: if (codeEditor && !listenersSetup) {
    const view = codeEditor.getView()
    if (view) {
      setupSelectionListener(view)
      listenersSetup = true
    }
  }

  function handleTrackerReady(tracker: any) {
    // Set up callback for when comments change
    tracker.onCommentsChange(() => {
      commentsVersion++
    })
    // Trigger initial update
    commentsVersion++
  }

  function setupSelectionListener(view: any) {
    const editorDom = view.dom

    const handleSelectionChange = () => {
      setTimeout(() => {
        const selection = codeEditor?.getSelection()
        if (selection && selection.from !== selection.to && selection.text.trim()) {
          // Get the coordinates of the selection
          const coords = view.coordsAtPos(selection.to)
          if (coords && editorContainer) {
            const containerRect = editorContainer.getBoundingClientRect()
            showCommentButton = true
            commentButtonPosition = {
              top: coords.top - containerRect.top + 20,
              left: coords.left - containerRect.left
            }
          }
        } else {
          showCommentButton = false
        }
      }, 10)
    }

    editorDom.addEventListener('mouseup', handleSelectionChange)
    editorDom.addEventListener('keyup', handleSelectionChange)
  }

  function updateCommentsFromTracker() {
    const tracker = codeEditor?.getCommentTracker()
    if (tracker) {
      comments = tracker.getAllComments()
    } else {
      comments = []
    }
  }

  async function loadAssetPreview() {
    if (!selectedAsset || !onGetAssetUrl) return
    try {
      assetPreviewUrl = await onGetAssetUrl(selectedAsset.id)
    } catch (error) {
      console.error('Failed to load asset preview:', error)
      assetPreviewUrl = null
    }
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith('image/')
  }

  function isPdf(mimeType: string) {
    return mimeType === 'application/pdf'
  }

  function handleAddComment() {
    if (!codeEditor) return

    const selection = codeEditor.getSelection()
    if (!selection || selection.from === selection.to) {
      return
    }

    // Create a draft comment and open it in the panel
    newCommentDraft = {
      text: '',
      range: { from: selection.from, to: selection.to },
      selectedText: selection.text
    }

    // Hide the button
    showCommentButton = false
  }

  function handleSubmitNewComment(content: string) {
    if (!codeEditor || !newCommentDraft || !selectedFile || !ydoc) return

    const tracker = codeEditor.getCommentTracker()
    if (!tracker) return

    const view = codeEditor.getView()
    if (!view) return

    const line = view.state.doc.lineAt(newCommentDraft.range.from).number

    const commentId = `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const comment: Comment = {
      id: commentId,
      fileId: selectedFile.id,
      content: content,
      author: {
        id: currentUserId,
        username: currentUserName,
        color: currentUserColor
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      resolved: false,
      replies: [],
      line: line
    }

    tracker.addComment(commentId, newCommentDraft.range.from, newCommentDraft.range.to, comment)

    // Clear the draft
    newCommentDraft = null
  }

  function handleCancelNewComment() {
    newCommentDraft = null
  }

  function handleCommentResolve(event: CustomEvent) {
    if (!codeEditor) return

    const tracker = codeEditor.getCommentTracker()
    if (!tracker) return

    tracker.resolveComment(event.detail.commentId)
    // No need to call updateCommentsList() - the observer will handle it
  }

  function handleCommentDelete(event: CustomEvent) {
    if (!codeEditor) return

    const tracker = codeEditor.getCommentTracker()
    if (!tracker) return

    tracker.removeComment(event.detail.commentId)
    // No need to call updateCommentsList() - the observer will handle it
  }

  function handleCommentReply(event: CustomEvent) {
    if (!codeEditor) return

    const tracker = codeEditor.getCommentTracker()
    if (!tracker) return

    const replyId = `reply-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const reply = {
      id: replyId,
      content: event.detail.content,
      author: {
        id: currentUserId,
        username: currentUserName,
        color: currentUserColor
      },
      createdAt: new Date().toISOString()
    }

    tracker.addReply(event.detail.commentId, reply)
    // No need to call updateCommentsList() - the observer will handle it
  }
</script>

<div class="editor-pane">
  {#if selectedFile && ytext && provider && ydoc}
    <div class="editor-wrapper">
      <div class="editor-header">
        <div class="file-info">
          <span class="file-name">{selectedFile.name}</span>
          <span class="file-type">{selectedFile.type}</span>
        </div>
      </div>
      <div class="editor-container" bind:this={editorContainer}>
        <div class="editor-content">
          <CodeEditor
            bind:this={codeEditor}
            {ytext}
            {provider}
            {ydoc}
            fileId={selectedFile.id}
            onTrackerReady={handleTrackerReady}
          />

          {#if showCommentButton}
            <button
              class="floating-comment-btn"
              style="top: {commentButtonPosition.top}px; left: {commentButtonPosition.left}px;"
              on:click={handleAddComment}
            >
              💬 Add comment
            </button>
          {/if}
        </div>
        <CommentsPanel
          {comments}
          {currentUserId}
          {newCommentDraft}
          on:resolve={handleCommentResolve}
          on:delete={handleCommentDelete}
          on:reply={handleCommentReply}
          on:submitNew={e => handleSubmitNewComment(e.detail.content)}
          on:cancelNew={handleCancelNewComment}
        />
      </div>
    </div>
  {:else if selectedAsset && assetPreviewUrl}
    <div class="asset-preview">
      <div class="editor-header">
        <div class="file-info">
          <span class="file-name">{selectedAsset.filename}</span>
          <span class="file-type">{selectedAsset.mime_type}</span>
        </div>
        <a href={assetPreviewUrl} download={selectedAsset.filename} class="download-btn">
          Download
        </a>
      </div>
      <div class="preview-content">
        {#if isImage(selectedAsset.mime_type)}
          <img src={assetPreviewUrl} alt={selectedAsset.filename} />
        {:else if isPdf(selectedAsset.mime_type)}
          <iframe src={assetPreviewUrl} title={selectedAsset.filename}></iframe>
        {:else}
          <div class="no-preview">
            <p>No preview available for this file type</p>
            <a href={assetPreviewUrl} download={selectedAsset.filename} class="download-link">
              Download {selectedAsset.filename}
            </a>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="no-selection">
      <p>{!isConnected ? 'Connecting...' : 'Select a file to start editing'}</p>
    </div>
  {/if}
</div>

<style>
  .editor-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-wrapper,
  .asset-preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-header {
    background: #252526;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #3e3e42;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .file-name {
    color: white;
    font-size: 14px;
    font-weight: 600;
  }

  .file-type {
    color: #888;
    font-size: 12px;
    text-transform: uppercase;
  }

  .download-btn {
    background: #0e639c;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    text-decoration: none;
  }

  .download-btn:hover {
    background: #0a4d7a;
  }

  .editor-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .editor-content {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .floating-comment-btn {
    position: absolute;
    background: #4a9eff;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 0.2s;
    font-weight: 500;
    z-index: 100;
    white-space: nowrap;
  }

  .floating-comment-btn:hover {
    background: #3a8eef;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    background: #1e1e1e;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-content img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .preview-content iframe {
    width: 100%;
    height: 100%;
    border: none;
  }

  .no-preview {
    text-align: center;
    color: #888;
    padding: 2rem;
  }

  .download-link {
    color: #0e639c;
    text-decoration: none;
    display: block;
    margin-top: 1rem;
  }

  .download-link:hover {
    text-decoration: underline;
  }

  .no-selection {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-size: 16px;
  }
</style>
