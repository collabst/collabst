<script lang="ts">
  import CodeEditor from '$lib/components/CodeEditor.svelte'
  import CommentsPanel from './CommentsPanel.svelte'
  import { IconButton, Tooltip, ToolButton } from '$lib/components/ui'
  import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus'
  import Download from '@lucide/svelte/icons/download'
  import Bold from '@lucide/svelte/icons/bold'
  import Italic from '@lucide/svelte/icons/italic'
  import Underline from '@lucide/svelte/icons/underline'
  import List from '@lucide/svelte/icons/list'
  import ListOrdered from '@lucide/svelte/icons/list-ordered'
  import Sigma from '@lucide/svelte/icons/sigma'
  import Code from '@lucide/svelte/icons/code'
  import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line'
  import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line'
  import PencilLine from '@lucide/svelte/icons/pencil-line'
  import Trash2 from '@lucide/svelte/icons/trash-2'
   import type { File as ProjectFile, Asset, Comment, Diagnostic } from '$lib/types'
  import type * as Y from 'yjs'
  import type { WebsocketProvider } from 'y-websocket'

  interface EditorPaneProps {
    selectedFile: ProjectFile | null
    selectedAsset: Asset | null
    ytext: Y.Text | null
    provider: WebsocketProvider | null
    isConnected: boolean
    onGetAssetUrl: ((assetId: number) => Promise<string>) | null
    ydoc: Y.Doc | null
    currentUserId: number
    currentUserName: string
    currentUserColor: string
    diagnostics?: Diagnostic[]
  }

  let {
    selectedFile,
    selectedAsset,
    ytext,
    provider,
    isConnected,
    onGetAssetUrl = null,
    ydoc,
    currentUserId,
    currentUserName,
    currentUserColor,
    diagnostics = []
  }: EditorPaneProps = $props()

  let fileName = $derived(
    selectedFile
      ? (selectedFile.path?.startsWith('/') ? selectedFile.path.slice(1) : selectedFile.path)
      : ''
  )

  let codeEditor: any = $state(null)
  let comments: Comment[] = []
  let newCommentDraft: { text: string; range: { from: number; to: number }; selectedText: string } | null = null
  let commentsVersion = 0 // Simple counter to trigger reactivity
  let showCommentButton =  $state(false)
  let commentButtonPosition = $state({ top: 0, left: 0 })
  let editorContainer: HTMLElement | null = $state(null)
  let listenersSetup = false

  // Update comments whenever the version changes or file changes
  $effect(() => {
    if (codeEditor && selectedFile && (commentsVersion >= 0)) {
      updateCommentsFromTracker()
    }
  })

  // Reset listeners flag and hide comment button when file changes
  $effect(() => {
    if (selectedFile) {
      listenersSetup = false
      showCommentButton = false
    }
  })

  // Setup selection listeners when editor is ready
  $effect(() => {
    if (codeEditor && !listenersSetup) {
      const view = codeEditor.getView()
      if (view) {
        setupSelectionListener(view)
        listenersSetup = true
      }
    }
  })

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

  // Action button handlers for typst files
  function handleBold() {
    console.log('Bold action')
    // TODO: Insert *bold* syntax or wrap selection
  }

  function handleItalic() {
    console.log('Italic action')
    // TODO: Insert _italic_ syntax or wrap selection
  }

  function handleUnderline() {
    console.log('Underline action')
    // TODO: Insert #underline[] syntax or wrap selection
  }

  function handleList() {
    console.log('List action')
    // TODO: Insert list item syntax
  }

  function handleNumberedList() {
    console.log('Numbered list action')
    // TODO: Insert numbered list item syntax
  }

  function handleEquation() {
    console.log('Equation action')
    // TODO: Insert equation syntax
  }

  function handleCodeBlock() {
    console.log('Code block action')
    // TODO: Insert code block syntax
  }

  // Action button handlers for non-typst files
  async function handleDownloadFile() {
    if (selectedAsset && onGetAssetUrl) {
      try {
        const url = await onGetAssetUrl(selectedAsset.id)
        window.open(url, '_blank')
      } catch (error) {
        console.error('Failed to download asset:', error)
      }
    } else if (selectedFile) {
      console.log('Download file:', selectedFile.name)
      // TODO: Implement file download
    }
  }

  function handleUploadFile() {
    console.log('Upload file')
    // TODO: Implement file upload/replace
  }

  function handleRenameFile() {
    console.log('Rename file')
    // TODO: Implement file rename
  }

  function handleDeleteFile() {
    console.log('Delete file')
    // TODO: Implement file delete
  }

  // Check if file type is text-editable
  let isTextEditable = $derived(selectedFile?.type === 'text' || selectedFile?.type === 'yaml' || selectedFile?.type === 'json')
  let isTypstFile = $derived(selectedFile?.type === 'typst')

  // Debug logging
  $effect(() => {
    console.log('File type changed:', {
      fileName: selectedFile?.name,
      fileType: selectedFile?.type,
      isTypstFile,
      isTextEditable
    })
  })

</script>

<div class="editor-pane">
  <!-- Action Toolbar - shown for typst files, non-typst files, and assets -->
  {#if selectedAsset}
    <div class="action-toolbar">
      <div class="tool-group">
        <Tooltip text="Download">
          <ToolButton icon={ArrowDownToLine} onclick={handleDownloadFile} position="first" />
        </Tooltip>
        <Tooltip text="Upload">
          <ToolButton icon={ArrowUpFromLine} onclick={handleUploadFile} position="middle" />
        </Tooltip>
        <Tooltip text="Rename">
          <ToolButton icon={PencilLine} onclick={handleRenameFile} position="middle" />
        </Tooltip>
        <Tooltip text="Delete">
          <ToolButton icon={Trash2} onclick={handleDeleteFile} position="last" />
        </Tooltip>
      </div>
    </div>
  {:else if isTypstFile && selectedFile}
    <div class="action-toolbar">
      <div class="tool-group">
        <Tooltip text="Bold">
          <ToolButton icon={Bold} onclick={handleBold} position="first" strokeWidth={3} />
        </Tooltip>
        <Tooltip text="Italic">
          <ToolButton icon={Italic} onclick={handleItalic} position="middle" />
        </Tooltip>
        <Tooltip text="Underline">
          <ToolButton icon={Underline} onclick={handleUnderline} position="last" />
        </Tooltip>
      </div>
      <div class="tool-group">
        <Tooltip text="List">
          <ToolButton icon={List} onclick={handleList} position="first" />
        </Tooltip>
        <Tooltip text="Numbered list">
          <ToolButton icon={ListOrdered} onclick={handleNumberedList} position="middle" />
        </Tooltip>
        <Tooltip text="Equation">
          <ToolButton icon={Sigma} onclick={handleEquation} position="middle" />
        </Tooltip>
        <Tooltip text="Code block">
          <ToolButton icon={Code} onclick={handleCodeBlock} position="last" />
        </Tooltip>
      </div>
      <div class="tool-group">
        <Tooltip text="Add comment">
          <ToolButton icon={MessageSquarePlus} onclick={handleAddComment} position="standalone" />
        </Tooltip>
      </div>
    </div>
  {:else if selectedFile && !isTypstFile}
    <div class="action-toolbar">
      <div class="tool-group">
        <Tooltip text="Download">
          <ToolButton icon={ArrowDownToLine} onclick={handleDownloadFile} position="first" />
        </Tooltip>
        <Tooltip text="Upload">
          <ToolButton icon={ArrowUpFromLine} onclick={handleUploadFile} position="middle" />
        </Tooltip>
        <Tooltip text="Rename">
          <ToolButton icon={PencilLine} onclick={handleRenameFile} position="middle" />
        </Tooltip>
        <Tooltip text="Delete">
          <ToolButton icon={Trash2} onclick={handleDeleteFile} position="last" />
        </Tooltip>
      </div>
      {#if isTextEditable}
        <div class="tool-group">
          <Tooltip text="Add comment">
            <ToolButton icon={MessageSquarePlus} onclick={handleAddComment} position="standalone" />
          </Tooltip>
        </div>
      {/if}
    </div>
  {/if}

  <!-- CodeEditor is the foundation - always mounted when we have connection -->
  {#if ytext && provider && ydoc && selectedFile}
    <div class="editor-wrapper" class:hidden={selectedAsset}>
      <div class="editor-container" bind:this={editorContainer}>
        <div class="editor-content">
          <CodeEditor
            bind:this={codeEditor}
            {ytext}
            {provider}
            {ydoc}
            fileId={selectedFile.id}
            onTrackerReady={handleTrackerReady}
             {diagnostics}
             fileName={fileName}
          />

          {#if showCommentButton}
            <div
              class="floating-comment-wrapper"
              style="position: absolute; top: {commentButtonPosition.top}px; left: {commentButtonPosition.left}px;"
            >
            <Tooltip text="Add comment to selection">
              <IconButton
                icon={MessageSquarePlus}
                variant="primary"
                class="floating-comment-btn"
                onclick={handleAddComment}
              />
            </Tooltip>
            </div>
          {/if}
        </div>
        <!-- <CommentsPanel
          {comments}
          {currentUserId}
          {newCommentDraft}
          on:resolve={handleCommentResolve}
          on:delete={handleCommentDelete}
          on:reply={handleCommentReply}
          on:submitNew={e => handleSubmitNewComment(e.detail.content)}
          on:cancelNew={handleCancelNewComment}
        /> -->
      </div>
    </div>
  {/if}

  {#if selectedAsset}
    <div class="asset-preview">
      <div class="preview-content">
        {#if onGetAssetUrl}
          {#await onGetAssetUrl(selectedAsset.id)}
            <div class="loading-preview">
              <p>Loading preview...</p>
            </div>
          {:then assetUrl}
            {#if isImage(selectedAsset.mime_type)}
              <img src={assetUrl} alt={selectedAsset.filename} />
            {:else if isPdf(selectedAsset.mime_type)}
              <iframe src={assetUrl} title={selectedAsset.filename}></iframe>
            {:else}
              <div class="no-preview">
                <p>No preview available for this file type</p>
                <a href={assetUrl} download={selectedAsset.filename} class="download-link">
                  Download {selectedAsset.filename}
                </a>
              </div>
            {/if}
          {:catch error}
            <div class="no-preview">
              <p>Failed to load preview</p>
            </div>
          {/await}
        {:else}
          <div class="no-preview">
            <p>No preview handler available</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if !selectedFile && !selectedAsset}
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

  .editor-wrapper {
    border-top-left-radius: 8px;
  }

  .asset-preview {
    border-top-left-radius: 8px;
  }

  .editor-wrapper.hidden {
    display: none;
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

  .action-toolbar {
    background: var(--bg-top-bar);
    padding: 0 var(--space-4) var(--space-2) 0;
    display: flex;
    gap: 8px;
    align-items: center;
    border-top-left-radius: 8px;
  }

  .tool-group {
    display: flex;
    align-items: center;
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

  .loading-preview {
    text-align: center;
    color: var(--text-tertiary);
    padding: var(--space-8);
    font-size: var(--text-base);
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
