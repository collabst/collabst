<script lang="ts">
  import CodeEditor from '$lib/components/CodeEditor.svelte'
  import CommentsPanel from './CommentsPanel.svelte'
  import { IconButton, Tooltip } from '$lib/components/ui'
  import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus'
  import Download from '@lucide/svelte/icons/download'
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

  // Reset listeners flag and hide comment button when file changes
  $: if (selectedFile) {
    listenersSetup = false
    showCommentButton = false
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
            <Tooltip text="Add comment to selection">
              <IconButton
                icon={MessageSquarePlus}
                variant="primary"
                class="floating-comment-btn"
                style="position: absolute; top: {commentButtonPosition.top}px; left: {commentButtonPosition.left}px;"
                onclick={handleAddComment}
              />
            </Tooltip>
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
        <Tooltip text="Download file">
          <IconButton
            icon={Download}
            variant="primary"
            onclick={() => window.open(assetPreviewUrl || '', '_blank')}
          />
        </Tooltip>
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
    background: var(--surface-primary);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .file-info {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .file-name {
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
  }

  .file-type {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    text-transform: uppercase;
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

  :global(.floating-comment-btn) {
    z-index: 100;
    box-shadow: var(--shadow-lg);
    animation: fadeIn var(--transition-fast);
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .preview-content {
    flex: 1;
    overflow: auto;
    background: var(--bg-primary);
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
    color: var(--text-tertiary);
    padding: var(--space-8);
  }

  .download-link {
    color: var(--color-primary-500);
    text-decoration: none;
    display: block;
    margin-top: var(--space-4);
    transition: color var(--transition-fast);
  }

  .download-link:hover {
    color: var(--color-primary-400);
    text-decoration: underline;
  }

  .no-selection {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-tertiary);
    font-size: var(--text-lg);
  }
</style>
