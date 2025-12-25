<script lang="ts">
  import CodeEditor from '$lib/components/CodeEditor.svelte'
  import { IconButton, Tooltip, ToolButton, DropdownToolButton } from '$lib/components/ui'
  import type { DropdownMenuItem } from '$lib/components/ui/DropdownMenuButton.svelte'
  import MessageSquarePlus from '@lucide/svelte/icons/message-square-plus'
  import Bold from '@lucide/svelte/icons/bold'
  import Italic from '@lucide/svelte/icons/italic'
  import Underline from '@lucide/svelte/icons/underline'
  import List from '@lucide/svelte/icons/list'
  import ListOrdered from '@lucide/svelte/icons/list-ordered'
  import Sigma from '@lucide/svelte/icons/sigma'
  import Code from '@lucide/svelte/icons/code'
  import Redo from '@lucide/svelte/icons/redo'
  import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line'
  import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line'
  import PencilLine from '@lucide/svelte/icons/pencil-line'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import MoreHorizontal from '@lucide/svelte/icons/ellipsis'
  import { onDestroy } from 'svelte'
  import type { File as ProjectFile, Asset, Comment, Diagnostic } from '$lib/types'
  import { revokeBlobUrl } from '$lib/utils/assetCache'
  import type * as Y from 'yjs'
  import type { WebsocketProvider } from 'y-websocket'
  import type { Component } from 'svelte'

  interface EditorPaneProps {
    selectedFile: ProjectFile | null
    selectedAsset: Asset | null
    assets: Asset[]
    ytext: Y.Text | null
    provider: WebsocketProvider | null
    isConnected: boolean
    onGetAssetUrl: ((assetId: number) => Promise<string>) | null
    onGetAssetBlob: ((asset: Asset) => Promise<string>) | null
    ydoc: Y.Doc | null
    currentUserId: number
    currentUserName: string
    currentUserColor: string
    diagnostics?: Diagnostic[]
    wrapLines?: boolean
    showToolbar?: boolean
  }

  let {
    selectedFile,
    selectedAsset,
    assets = [],
    ytext,
    provider,
    isConnected,
    onGetAssetUrl = null,
    onGetAssetBlob = null,
    ydoc,
    currentUserId,
    currentUserName,
    currentUserColor,
    diagnostics = [],
    wrapLines = true,
    showToolbar = true
  }: EditorPaneProps = $props()

  // Simple blob URL cache - keyed by asset ID
  const blobUrlCache: Record<number, string> = {};
  let currentBlobUrl = $state<string | null>(null);
  let currentBlobAssetId = $state<number | null>(null);

  // Load blob URL for an asset (with caching)
  async function loadAssetBlobUrl(asset: Asset) {
    const assetId = asset.id;

    // Already cached?
    if (blobUrlCache[assetId]) {
      currentBlobUrl = blobUrlCache[assetId];
      currentBlobAssetId = assetId;
      return;
    }

    // Load and cache
    if (onGetAssetBlob) {
      try {
        const url = await onGetAssetBlob(asset);

        // Revoke old blob URL if replacing (e.g., asset was updated)
        if (blobUrlCache[assetId]) {
          revokeBlobUrl(blobUrlCache[assetId]);
        }

        blobUrlCache[assetId] = url;
        // Only set if still viewing the same asset
        if (selectedAsset?.id === assetId) {
          currentBlobUrl = url;
          currentBlobAssetId = assetId;
        }
      } catch (err) {
        console.error('Failed to load asset blob:', assetId, err);
      }
    }
  }

  // Watch selectedAsset and load its blob URL
  $effect(() => {
    if (selectedAsset) {
      // Check cache first (sync)
      if (blobUrlCache[selectedAsset.id]) {
        currentBlobUrl = blobUrlCache[selectedAsset.id];
        currentBlobAssetId = selectedAsset.id;
      } else {
        // Clear current to show loading (prevents showing wrong asset type)
        currentBlobUrl = null;
        currentBlobAssetId = null;
        loadAssetBlobUrl(selectedAsset);
      }
    } else {
      currentBlobUrl = null;
      currentBlobAssetId = null;
    }
  });

  // Only show blob URL if it matches the selected asset
  let safeBlobUrl = $derived(
    selectedAsset && currentBlobAssetId === selectedAsset.id ? currentBlobUrl : null
  );

  // Cleanup on unmount
  onDestroy(() => {
    for (const url of Object.values(blobUrlCache)) {
      revokeBlobUrl(url);
    }
  });

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
  
  // Dynamic toolbar overflow handling
  let toolbarElement = $state<HTMLElement | null>(null)
  // Overflow buttons always have onclick defined (filtered in checkToolbarOverflow)
  let overflowButtons = $state<Array<{ label: string; icon?: Component; onclick: () => void }>>([])
  let visibleButtonsCount = $state(0)
  let showRightButton = $state(false)

  // Export editor action methods
  export function undo() {
    if (codeEditor) {
      codeEditor.undo()
    }
  }

  export function redo() {
    if (codeEditor) {
      codeEditor.redo()
    }
  }

  export function selectAll() {
    if (codeEditor) {
      codeEditor.selectAll()
    }
  }

  export function canUndo(): boolean {
    return codeEditor ? codeEditor.canUndo() : false
  }

  export function canRedo(): boolean {
    return codeEditor ? codeEditor.canRedo() : false
  }

  // Expose the underlying CodeMirror EditorView to parent components
  export function getEditorView() {
    try {
      return codeEditor?.getView?.() ?? null
    } catch (e) {
      return null
    }
  }

  // Navigate to a specific line and column in the editor
  export function navigateToDiagnostic(line: number, character: number, endLine?: number, endCharacter?: number) {
    try {
      const view = codeEditor?.getView?.()
      if (!view) return

      const doc = view.state.doc
      // Convert 1-based to 0-based line numbering
      const startLineNum = Math.max(1, line)
      const endLineNum = endLine ? Math.max(1, endLine) : startLineNum

      if (startLineNum <= doc.lines && endLineNum <= doc.lines) {
        const startLineObj = doc.line(startLineNum)
        const endLineObj = doc.line(endLineNum)

        const from = startLineObj.from + Math.max(0, character)
        const to = endLineObj.from + Math.max(0, endCharacter ?? character)

        // Dispatch transaction to set selection and scroll into view
        view.dispatch({
          selection: { anchor: from, head: to },
          scrollIntoView: true
        })
        view.focus()
      }
    } catch (e) {
      console.error('Failed to navigate to diagnostic:', e)
    }
  }

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
    if (codeEditor) {
      codeEditor.toggleWrap('*', '*')
    }
  }

  function handleItalic() {
    if (codeEditor) {
      codeEditor.toggleWrap('_', '_')
    }
  }

  function handleUnderline() {
    if (codeEditor) {
      codeEditor.toggleWrap('#underline[', ']')
    }
  }

  function handleList() {
    if (codeEditor) {
      codeEditor.toggleLinePrefix('- ', '+ ')
    }
  }

  function handleNumberedList() {
    if (codeEditor) {
      codeEditor.toggleLinePrefix('+ ', '- ')
    }
  }

  function handleEquation() {
    if (codeEditor) {
      codeEditor.toggleWrap('$', '$')
    }
  }

  function handleCodeBlock() {
    if (codeEditor) {
      codeEditor.toggleWrap('`', '`')
    }
  }

  function handleScrollPreview() {
    console.log('Scroll preview')
    // TODO: Implement scroll preview
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
  
  // Define all toolbar buttons with their metadata
  type ToolbarButton = {
    id: string
    label: string
    icon: Component
    onclick: () => void
    position?: 'first' | 'middle' | 'last' | 'standalone'
    strokeWidth?: number
    shortcut?: string
  }
  
  const typstToolbarButtons: ToolbarButton[][] = [
    [
      { id: 'bold', label: 'Bold', icon: Bold, onclick: handleBold, position: 'first', strokeWidth: 3, shortcut: 'Ctrl+B' },
      { id: 'italic', label: 'Italic', icon: Italic, onclick: handleItalic, position: 'middle', shortcut: 'Ctrl+I' },
      { id: 'underline', label: 'Underline', icon: Underline, onclick: handleUnderline, position: 'last', shortcut: 'Ctrl+U' }
    ],
    [
      { id: 'list', label: 'List', icon: List, onclick: handleList, position: 'first' },
      { id: 'numberedList', label: 'Numbered list', icon: ListOrdered, onclick: handleNumberedList, position: 'middle' },
      { id: 'equation', label: 'Equation', icon: Sigma, onclick: handleEquation, position: 'middle' },
      { id: 'codeBlock', label: 'Code block', icon: Code, onclick: handleCodeBlock, position: 'last' }
    ],
    [
      { id: 'addComment', label: 'Add comment', icon: MessageSquarePlus, onclick: handleAddComment, position: 'standalone' }
    ]
  ]
  
  // Right-side button (scroll preview) - separate from left buttons
  const typstRightButton: ToolbarButton | null = {
    id: 'scrollPreview',
    label: 'Scroll preview to cursor',
    icon: Redo,
    onclick: handleScrollPreview,
    position: 'standalone'
  }
  
  const assetToolbarButtons: ToolbarButton[][] = [
    [
      { id: 'download', label: 'Download', icon: ArrowDownToLine, onclick: handleDownloadFile, position: 'first' },
      { id: 'upload', label: 'Upload', icon: ArrowUpFromLine, onclick: handleUploadFile, position: 'middle' },
      { id: 'rename', label: 'Rename', icon: PencilLine, onclick: handleRenameFile, position: 'middle' },
      { id: 'delete', label: 'Delete', icon: Trash2, onclick: handleDeleteFile, position: 'last' }
    ]
  ]
  
  const nonTypstToolbarButtons: ToolbarButton[][] = [
    [
      { id: 'download', label: 'Download', icon: ArrowDownToLine, onclick: handleDownloadFile, position: 'first' },
      { id: 'upload', label: 'Upload', icon: ArrowUpFromLine, onclick: handleUploadFile, position: 'middle' },
      { id: 'rename', label: 'Rename', icon: PencilLine, onclick: handleRenameFile, position: 'middle' },
      { id: 'delete', label: 'Delete', icon: Trash2, onclick: handleDeleteFile, position: 'last' }
    ]
  ]
  
  const nonTypstWithCommentButtons: ToolbarButton[][] = [
    [
      { id: 'download', label: 'Download', icon: ArrowDownToLine, onclick: handleDownloadFile, position: 'first' },
      { id: 'upload', label: 'Upload', icon: ArrowUpFromLine, onclick: handleUploadFile, position: 'middle' },
      { id: 'rename', label: 'Rename', icon: PencilLine, onclick: handleRenameFile, position: 'middle' },
      { id: 'delete', label: 'Delete', icon: Trash2, onclick: handleDeleteFile, position: 'last' }
    ],
    [
      { id: 'addComment', label: 'Add comment', icon: MessageSquarePlus, onclick: handleAddComment, position: 'standalone' }
    ]
  ]
  
  // Get current toolbar buttons based on file type
  let currentToolbarButtons = $derived<ToolbarButton[][]>(
    selectedAsset ? assetToolbarButtons :
    isTypstFile ? typstToolbarButtons :
    isTextEditable ? nonTypstWithCommentButtons : nonTypstToolbarButtons
  )
  
  // Get right button based on file type
  let currentRightButton = $derived<ToolbarButton | null>(
    isTypstFile ? typstRightButton : null
  )
  
  // Flattened list of all buttons with group info
  interface FlatButton extends ToolbarButton {
    groupIndex: number
    buttonIndex: number
    originalPosition: 'first' | 'middle' | 'last' | 'standalone'
  }
  
  let flatButtons = $derived<FlatButton[]>(
    currentToolbarButtons.flatMap((group, groupIndex) =>
      group.map((button, buttonIndex) => ({
        ...button,
        groupIndex,
        buttonIndex,
        originalPosition: button.position || 'standalone'
      }))
    )
  )
  
  // Track which buttons are visible (by index in flatButtons)
  let visibleButtonIndices = $state<number[]>([])
  
  // Computed visible buttons for the toolbar with adjusted positions
  let visibleLeftButtons = $derived.by(() => {
    const leftButtons = flatButtons.filter((btn, index) => 
      visibleButtonIndices.includes(index)
    )
    
    // Adjust positions based on visibility
    return leftButtons.map((btn, index, arr) => {
      const prevBtn = index > 0 ? arr[index - 1] : null
      const nextBtn = index < arr.length - 1 ? arr[index + 1] : null
      
      const isStartOfGroup = !prevBtn || prevBtn.groupIndex !== btn.groupIndex
      const isEndOfGroup = !nextBtn || nextBtn.groupIndex !== btn.groupIndex
      
      let position: 'first' | 'middle' | 'last' | 'standalone'
      if (btn.originalPosition === 'standalone') {
        position = 'standalone'
      } else if (isStartOfGroup && isEndOfGroup) {
        position = 'standalone'
      } else if (isStartOfGroup) {
        position = 'first'
      } else if (isEndOfGroup) {
        position = 'last'
      } else {
        position = 'middle'
      }
      
      return { ...btn, position }
    })
  })
  
  // Detect toolbar overflow and move buttons to More dropdown
  let resizeTimeoutId: number | null = null
  let measuredButtonWidth: number | null = null
  let measuredMoreButtonWidth: number | null = null
  let measuredGapWidth: number | null = null
  
  function checkToolbarOverflow() {
    if (!toolbarElement || !showToolbar) return
    
    // Measure actual button widths on first run
    if (measuredButtonWidth === null || measuredMoreButtonWidth === null || measuredGapWidth === null) {
      const toolButton = toolbarElement.querySelector('.tool-group button')
      const moreButton = toolbarElement.querySelector('.more-button button')
      const toolGroups = toolbarElement.querySelectorAll('.toolbar-left > .tool-group')
      
      if (toolButton) {
        const rect = toolButton.getBoundingClientRect()
        measuredButtonWidth = rect.width
      }
      
      if (moreButton) {
        const rect = moreButton.getBoundingClientRect()
        measuredMoreButtonWidth = rect.width
      }
      
      // Measure gap by checking distance between two tool groups
      if (toolGroups.length >= 2) {
        const firstGroup = toolGroups[0].getBoundingClientRect()
        const secondGroup = toolGroups[1].getBoundingClientRect()
        measuredGapWidth = secondGroup.left - firstGroup.right
      }
      
      // If we couldn't measure, use fallback values and try again later
      if (!measuredButtonWidth || !measuredMoreButtonWidth || !measuredGapWidth) {
        measuredButtonWidth = 38
        measuredMoreButtonWidth = 40
        measuredGapWidth = 8
      }
    }
    
    const toolbarWidth = toolbarElement.clientWidth
    const moreButtonWidth = measuredMoreButtonWidth || 40
    const buttonWidth = measuredButtonWidth || 38
    const gapWidth = measuredGapWidth || 8
    const rightButtonWidth = currentRightButton ? buttonWidth : 0
    
    // Calculate how many buttons we can fit
    const totalButtons = flatButtons.length
    
    // Calculate available space (with reduced safety margin for more generosity)
    const availableWidthForLeft = toolbarWidth - rightButtonWidth - (currentRightButton ? gapWidth : 0) - 10 // Only 10px margin
    
    // Estimate total width needed for all left buttons
    let estimatedWidth = 0
    let lastGroupIndex = -1
    
    for (let i = 0; i < totalButtons; i++) {
      const btn = flatButtons[i]
      if (btn.groupIndex !== lastGroupIndex && i > 0) {
        estimatedWidth += gapWidth // Add gap between groups
      }
      estimatedWidth += buttonWidth
      lastGroupIndex = btn.groupIndex
    }
    
    // If everything fits comfortably, show all left buttons
    if (estimatedWidth <= availableWidthForLeft) {
      visibleButtonIndices = Array.from({ length: totalButtons }, (_, i) => i)
      overflowButtons = []
      visibleButtonsCount = totalButtons
      showRightButton = currentRightButton !== null
      return
    }
    
    // Check if we can fit all left buttons by hiding the right button (scroll preview)
    const availableWithoutRightButton = toolbarWidth - moreButtonWidth - gapWidth - 10
    if (estimatedWidth + moreButtonWidth <= availableWithoutRightButton && currentRightButton) {
      // Hide right button, show all left buttons, More button contains right button
      visibleButtonIndices = Array.from({ length: totalButtons }, (_, i) => i)
      overflowButtons = [{
        label: currentRightButton.label,
        icon: currentRightButton.icon,
        onclick: currentRightButton.onclick
      }]
      visibleButtonsCount = totalButtons
      showRightButton = false
      return
    }
    
    // Otherwise, calculate how many left buttons we can fit with the More button
    // Right button is already hidden at this point
    let visibleCount = 0
    let currentWidth = moreButtonWidth + gapWidth // Start with More button space
    lastGroupIndex = -1
    
    for (let i = 0; i < totalButtons; i++) {
      const btn = flatButtons[i]
      const groupGap = (btn.groupIndex !== lastGroupIndex && i > 0) ? gapWidth : 0
      const buttonSpace = buttonWidth + groupGap
      
      if (currentWidth + buttonSpace <= availableWithoutRightButton) {
        currentWidth += buttonSpace
        visibleCount = i + 1
        lastGroupIndex = btn.groupIndex
      } else {
        break
      }
    }
    
    // Build list of visible button indices
    const newVisibleIndices: number[] = []
    for (let i = 0; i < visibleCount; i++) {
      newVisibleIndices.push(i)
    }
    
    visibleButtonIndices = newVisibleIndices
    
    // Build overflow menu items (hidden left buttons + right button if exists)
    const newOverflow: Array<{ label: string; icon?: Component; onclick: () => void }> = []
    
    // Add hidden left buttons
    for (let i = visibleCount; i < totalButtons; i++) {
      const btn = flatButtons[i]
      newOverflow.push({
        label: btn.label,
        icon: btn.icon,
        onclick: btn.onclick
      })
    }
    
    // Add right button to overflow if it exists
    if (currentRightButton) {
      newOverflow.push({
        label: currentRightButton.label,
        icon: currentRightButton.icon,
        onclick: currentRightButton.onclick
      })
    }
    
    overflowButtons = newOverflow
    visibleButtonsCount = newVisibleIndices.length
    showRightButton = false
  }
  
  // Set up ResizeObserver for toolbar with debouncing
  $effect(() => {
    if (toolbarElement && showToolbar) {
      const resizeObserver = new ResizeObserver(() => {
        // Debounce the overflow check to prevent flickering
        if (resizeTimeoutId !== null) {
          clearTimeout(resizeTimeoutId)
        }
        
        resizeTimeoutId = window.setTimeout(() => {
          checkToolbarOverflow()
          resizeTimeoutId = null
        }, 50) // 50ms debounce
      })
      
      resizeObserver.observe(toolbarElement)
      checkToolbarOverflow() // Initial check
      
      return () => {
        resizeObserver.disconnect()
        if (resizeTimeoutId !== null) {
          clearTimeout(resizeTimeoutId)
        }
      }
    }
  })

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
  <!-- Action Toolbar - Dynamic with overflow detection -->
  {#if (selectedAsset || selectedFile) && showToolbar}
    <div class="action-toolbar" class:has-more={overflowButtons.length > 0} bind:this={toolbarElement}>
      <div class="toolbar-left">
        {#each Object.entries(
          visibleLeftButtons.reduce((groups, button) => {
            const key = button.groupIndex
            if (!groups[key]) groups[key] = []
            groups[key].push(button)
            return groups
          }, {} as Record<number, typeof visibleLeftButtons>)
        ) as [groupIndex, groupButtons]}
          <div class="tool-group">
            {#each groupButtons as button}
              <Tooltip text={button.label} position="bottom" shortcut={button.shortcut}>
                <ToolButton 
                  icon={button.icon} 
                  onclick={button.onclick} 
                  position={button.position}
                  strokeWidth={button.strokeWidth}
                />
              </Tooltip>
            {/each}
          </div>
        {/each}
      </div>
      
      <div class="toolbar-right">
        {#if showRightButton && currentRightButton}
          <div class="tool-group">
            <Tooltip text={currentRightButton.label} position="bottom">
              <ToolButton 
                icon={currentRightButton.icon} 
                onclick={currentRightButton.onclick} 
                position={currentRightButton.position}
                strokeWidth={currentRightButton.strokeWidth}
              />
            </Tooltip>
          </div>
        {/if}
        
        {#if overflowButtons.length > 0}
          <div class="more-button">
            <Tooltip text="More options" position="bottom">
              <DropdownToolButton 
                icon={MoreHorizontal} 
                items={overflowButtons} 
                position="standalone"
                buttonWidth="32px"
                allowIconOverflow={false}
              />
            </Tooltip>
          </div>
        {/if}
      </div>
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
             {wrapLines}
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
        {#if onGetAssetBlob}
          {#if safeBlobUrl}
            {#if isImage(selectedAsset.mime_type)}
              <img src={safeBlobUrl} alt={selectedAsset.filename} />
            {:else if isPdf(selectedAsset.mime_type)}
              <iframe src={safeBlobUrl} title={selectedAsset.filename}></iframe>
            {:else}
              <div class="no-preview">
                <p>No preview available for this file type</p>
                <a href={safeBlobUrl} download={selectedAsset.filename} class="download-link">
                  Download {selectedAsset.filename}
                </a>
              </div>
            {/if}
          {:else}
            <div class="loading-preview">
              <p>Loading preview...</p>
            </div>
          {/if}
        {:else if onGetAssetUrl}
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
          {:catch}
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
    overflow: auto;
  }

  .editor-wrapper {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .asset-preview {
    border-top-left-radius: 8px;
  }

  .editor-wrapper.hidden {
    display: none;
  }

  .action-toolbar {
    background: var(--bg-top-bar);
    padding: 0 0 var(--space-2) 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    overflow: visible;
  }
  
  .action-toolbar.has-more {
    padding-right: 0;
  }
  
  .toolbar-left {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .toolbar-right {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }

  .tool-group {
    display: flex;
    align-items: center;
  }
  
  .more-button {
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
