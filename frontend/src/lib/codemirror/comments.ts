import { StateField, StateEffect } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import * as Y from 'yjs'
import type { Comment } from '$lib/types'

// State effects for comment operations
export const addCommentEffect = StateEffect.define<{
  commentId: string
  from: number
  to: number
}>()

export const removeCommentEffect = StateEffect.define<{ commentId: string }>()

export const updateCommentsEffect = StateEffect.define<{
  comments: Map<string, { from: number; to: number }>
}>()

// State effect for setting the active comment
export const setActiveCommentEffect = StateEffect.define<string | null>()

// Decoration for highlighted comment ranges
const commentMark = (commentId: string) =>
  Decoration.mark({
    class: 'cm-comment-highlight',
    attributes: {
      'data-comment-id': commentId,
    }
  })

const activeCommentMark = (commentId: string) =>
  Decoration.mark({
    class: 'cm-comment-highlight cm-comment-highlight-active',
    attributes: {
      'data-comment-id': commentId,
    }
  })

// State field to track the active comment ID
export const activeCommentField = StateField.define<string | null>({
  create() {
    return null
  },
  update(activeId, tr) {
    for (let effect of tr.effects) {
      if (effect.is(setActiveCommentEffect)) {
        return effect.value
      }
    }
    return activeId
  }
})

// State field to track comment decorations
export const commentField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)

    // Check if active comment changed
    let activeChanged = false
    let newActiveId: string | null = null
    for (let effect of tr.effects) {
      if (effect.is(setActiveCommentEffect)) {
        activeChanged = true
        newActiveId = effect.value
      }
    }

    for (let effect of tr.effects) {
      if (effect.is(addCommentEffect)) {
        const activeId = tr.state.field(activeCommentField)
        const mark = effect.value.commentId === activeId
          ? activeCommentMark(effect.value.commentId)
          : commentMark(effect.value.commentId)
        decorations = decorations.update({
          add: [mark.range(effect.value.from, effect.value.to)]
        })
      } else if (effect.is(removeCommentEffect)) {
        decorations = decorations.update({
          filter: (_from, _to, value) => {
            const commentId = value.spec?.attributes?.['data-comment-id']
            return commentId !== effect.value.commentId
          }
        })
      } else if (effect.is(updateCommentsEffect)) {
        const activeId = activeChanged ? newActiveId : tr.state.field(activeCommentField)
        const ranges: any[] = []
        effect.value.comments.forEach((range, commentId) => {
          const mark = commentId === activeId
            ? activeCommentMark(commentId)
            : commentMark(commentId)
          ranges.push(mark.range(range.from, range.to))
        })
        decorations = Decoration.set(ranges, true)
      }
    }

    // If only the active comment changed (no other effects), rebuild decorations
    if (activeChanged && !tr.effects.some(e => e.is(updateCommentsEffect))) {
      const iter = decorations.iter()
      const ranges: any[] = []
      while (iter.value) {
        const commentId = iter.value.spec?.attributes?.['data-comment-id']
        if (commentId) {
          const mark = commentId === newActiveId
            ? activeCommentMark(commentId)
            : commentMark(commentId)
          ranges.push(mark.range(iter.from, iter.to))
        }
        iter.next()
      }
      decorations = Decoration.set(ranges, true)
    }

    return decorations
  },
  provide: (f) => EditorView.decorations.from(f)
})

// Yjs integration for syncing comment ranges
export class CommentRangeTracker {
  private yComments: Y.Map<any>
  private yText: Y.Text
  private view: EditorView
  private rangeCache: Map<string, { anchor: Y.RelativePosition; head: Y.RelativePosition }>
  private changeCallback: (() => void) | null = null
  private clickCallback: ((commentId: string) => void) | null = null
  private hoverCallback: ((commentId: string | null) => void) | null = null
  private docChangeCallback: (() => void) | null = null
  private docChangeTimer: ReturnType<typeof setTimeout> | null = null
  private boundHandleYjsChange: (event: Y.YMapEvent<any>) => void

  private normalizeAuthorId(author: any): string {
    if (typeof author === 'string') return author
    if (typeof author === 'number') return String(author)
    if (author && typeof author === 'object' && typeof author.id === 'string') return author.id
    if (author && typeof author === 'object' && typeof author.id === 'number') return String(author.id)
    return ''
  }

  private normalizeReplies(replies: any[]): Comment['replies'] {
    return (replies || []).map((reply: any) => ({
      id: reply.id,
      content: reply.content,
      authorId: this.normalizeAuthorId(reply.authorId ?? reply.author),
      createdAt: reply.createdAt,
    }))
  }

  constructor(ydoc: Y.Doc, fileId: string, view: EditorView) {
    this.yComments = ydoc.getMap(`comments-${fileId}`)
    this.yText = ydoc.getText(`file-${fileId}`)
    this.view = view
    this.rangeCache = new Map()

    // Bind the handler once to avoid issues with unobserve
    this.boundHandleYjsChange = this.handleYjsChange.bind(this)

    // Listen for Yjs changes and update decorations
    this.yComments.observe(this.boundHandleYjsChange)

    // Initialize existing comments
    this.syncFromYjs()
  }

  // Set a callback that will be called when comments change
  onCommentsChange(callback: () => void) {
    this.changeCallback = callback
  }

  // Set a callback that will be called when the document content changes (new lines, edits, etc.)
  onDocChange(callback: () => void) {
    this.docChangeCallback = callback
  }

  // Notify doc change callback with debouncing (called from the update listener extension)
  notifyDocChange() {
    if (this.docChangeCallback) {
      if (this.docChangeTimer) clearTimeout(this.docChangeTimer)
      this.docChangeTimer = setTimeout(() => {
        this.docChangeCallback?.()
      }, 30)
    }
  }

  // Set a callback that will be called when a comment highlight is hovered in the editor
  onCommentHover(callback: (commentId: string | null) => void) {
    this.hoverCallback = callback
  }

  // Notify hover callback (called from the hover handler extension)
  notifyCommentHover(commentId: string | null) {
    if (this.hoverCallback) {
      this.hoverCallback(commentId)
    }
  }

  // Set a callback that will be called when a comment highlight is clicked in the editor
  onCommentClick(callback: (commentId: string) => void) {
    this.clickCallback = callback
  }

  // Notify click callback (called from the click handler extension)
  notifyCommentClick(commentId: string) {
    if (this.clickCallback) {
      this.clickCallback(commentId)
    }
  }

  // Set the active comment and update decorations
  setActiveComment(commentId: string | null) {
    this.view.dispatch({
      effects: setActiveCommentEffect.of(commentId)
    })
  }

  // Scroll the editor to show the range of a given comment
  scrollToComment(commentId: string) {
    const range = this.getCommentRange(commentId)
    if (range) {
      this.view.dispatch({
        selection: { anchor: range.from, head: range.to },
        scrollIntoView: true
      })
    }
  }

  private handleYjsChange(_event: Y.YMapEvent<any>) {
    this.syncFromYjs()
    // Notify the callback if set
    if (this.changeCallback) {
      this.changeCallback()
    }
  }

  private syncFromYjs() {
    const comments = new Map<string, { from: number; to: number }>()

    this.yComments.forEach((commentData, commentId) => {
      const anchor = Y.createRelativePositionFromJSON(commentData.anchor)
      const head = Y.createRelativePositionFromJSON(commentData.head)

      const anchorPos = Y.createAbsolutePositionFromRelativePosition(anchor, this.yText.doc!)
      const headPos = Y.createAbsolutePositionFromRelativePosition(head, this.yText.doc!)

      if (anchorPos && headPos) {
        const from = Math.min(anchorPos.index, headPos.index)
        const to = Math.max(anchorPos.index, headPos.index)

        // Only add decoration if range is not empty and comment is still open.
        if (from < to && !commentData.resolved) {
          comments.set(commentId, { from, to })
        }

        // Update cache
        this.rangeCache.set(commentId, { anchor, head })

        // Update line number in Yjs
        const line = this.view.state.doc.lineAt(from).number
        if (commentData.line !== line) {
          this.yComments.set(commentId, { ...commentData, line })
        }
      }
    })

    // Update editor decorations
    this.view.dispatch({
      effects: updateCommentsEffect.of({ comments })
    })
  }

  addComment(commentId: string, from: number, to: number, comment: Comment) {
    // Create relative positions that will adjust as document changes
    const anchor = Y.createRelativePositionFromTypeIndex(this.yText, from)
    const head = Y.createRelativePositionFromTypeIndex(this.yText, to)

    // Get the line number
    const line = this.view.state.doc.lineAt(from).number

    // Store in Yjs (without the selected text)
    this.yComments.set(commentId, {
      anchor: Y.relativePositionToJSON(anchor),
      head: Y.relativePositionToJSON(head),
      line: line,
      fileId: comment.fileId,
      content: comment.content,
      authorId: comment.authorId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      resolved: comment.resolved,
      replies: comment.replies
    })

    // Cache the relative positions
    this.rangeCache.set(commentId, { anchor, head })
  }

  removeComment(commentId: string) {
    this.yComments.delete(commentId)
    this.rangeCache.delete(commentId)
  }

  resolveComment(commentId: string) {
    const commentData = this.yComments.get(commentId)
    if (commentData) {
      this.yComments.set(commentId, { ...commentData, resolved: true })
    }
  }

  reopenComment(commentId: string) {
    const commentData = this.yComments.get(commentId)
    if (commentData) {
      this.yComments.set(commentId, { ...commentData, resolved: false })
    }
  }

  getComment(commentId: string): Comment | null {
    const data = this.yComments.get(commentId)
    if (!data) return null

    return {
      id: commentId,
      fileId: data.fileId,
      content: data.content,
      authorId: this.normalizeAuthorId(data.authorId ?? data.author),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      resolved: data.resolved,
      replies: this.normalizeReplies(data.replies || []),
      line: data.line || 1
    }
  }

  getAllComments(): Comment[] {
    const comments: Comment[] = []
    this.yComments.forEach((data, commentId) => {
      comments.push({
        id: commentId,
        fileId: data.fileId,
        content: data.content,
        authorId: this.normalizeAuthorId(data.authorId ?? data.author),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        resolved: data.resolved,
        replies: this.normalizeReplies(data.replies || []),
        line: data.line || 1
      })
    })
    return comments
  }

  getCommentRange(commentId: string): { from: number; to: number } | null {
    const cached = this.rangeCache.get(commentId)
    if (!cached) return null

    const anchorPos = Y.createAbsolutePositionFromRelativePosition(cached.anchor, this.yText.doc!)
    const headPos = Y.createAbsolutePositionFromRelativePosition(cached.head, this.yText.doc!)

    if (anchorPos && headPos) {
      return {
        from: Math.min(anchorPos.index, headPos.index),
        to: Math.max(anchorPos.index, headPos.index)
      }
    }

    return null
  }

  // Get the pixel y-position of each comment's start relative to editor content top
  getCommentPositions(): Map<string, number> {
    const positions = new Map<string, number>()
    const scrollDOM = this.view.scrollDOM
    const scrollTop = scrollDOM.scrollTop
    const editorRect = scrollDOM.getBoundingClientRect()

    this.yComments.forEach((commentData, commentId) => {
      const range = this.getCommentRange(commentId)
      if (range) {
        const coords = this.view.coordsAtPos(range.from)
        if (coords) {
          // Position relative to the top of the scroll content (not viewport)
          const top = coords.top - editorRect.top + scrollTop
          positions.set(commentId, top)
        }
      }
    })

    return positions
  }

  // Get the editor scroll DOM element for scroll syncing
  getScrollDOM(): HTMLElement {
    return this.view.scrollDOM
  }

  addReply(commentId: string, reply: any) {
    const commentData = this.yComments.get(commentId)
    if (commentData) {
      const replies = commentData.replies || []
      this.yComments.set(commentId, {
        ...commentData,
        replies: [...replies, reply],
        updatedAt: new Date().toISOString()
      })
    }
  }

  destroy() {
    this.yComments.unobserve(this.boundHandleYjsChange)
    this.rangeCache.clear()
    this.changeCallback = null
    this.clickCallback = null
    this.hoverCallback = null
    this.docChangeCallback = null
    if (this.docChangeTimer) clearTimeout(this.docChangeTimer)
  }
}

// Store a reference to the tracker so the click handler can access it
let currentTracker: CommentRangeTracker | null = null

export function setCurrentTracker(tracker: CommentRangeTracker | null) {
  currentTracker = tracker
}

// Hover handler extension for comment highlights
let lastHoveredCommentId: string | null = null
const commentHoverHandler = EditorView.domEventHandlers({
  mouseover(event) {
    const target = event.target as HTMLElement
    const commentEl = target.closest('.cm-comment-highlight')
    const commentId = commentEl?.getAttribute('data-comment-id') ?? null
    if (commentId !== lastHoveredCommentId) {
      lastHoveredCommentId = commentId
      if (currentTracker) {
        currentTracker.notifyCommentHover(commentId)
      }
    }
    return false
  },
  mouseout(event) {
    const target = event.target as HTMLElement
    const related = (event as MouseEvent).relatedTarget as HTMLElement | null
    // Only clear if we're leaving a comment highlight and not entering another one
    if (target.closest('.cm-comment-highlight') && !related?.closest('.cm-comment-highlight')) {
      lastHoveredCommentId = null
      if (currentTracker) {
        currentTracker.notifyCommentHover(null)
      }
    }
    return false
  }
})

// Click handler extension for comment highlights
// Uses mouseup so it doesn't interfere with text selection
const commentClickHandler = EditorView.domEventHandlers({
  mouseup(event, view) {
    // Only notify if there was no text selection (i.e. a simple click)
    const selection = view.state.selection.main
    if (selection.from !== selection.to) return false

    const target = event.target as HTMLElement
    const commentEl = target.closest('.cm-comment-highlight')
    if (commentEl) {
      const commentId = commentEl.getAttribute('data-comment-id')
      if (commentId && currentTracker) {
        currentTracker.notifyCommentClick(commentId)
      }
    }
    return false
  }
})

// Update listener that notifies tracker of doc changes
const docChangeListener = EditorView.updateListener.of((update) => {
  if (update.docChanged || update.geometryChanged) {
    if (currentTracker) {
      currentTracker.notifyDocChange()
    }
  }
})

// Extension to add comment functionality to CodeMirror
export function commentsExtension(): Extension {
  return [
    activeCommentField,
    commentField,
    commentClickHandler,
    commentHoverHandler,
    docChangeListener,
    EditorView.baseTheme({
      '.cm-comment-highlight': {
        backgroundColor: 'var(--comment-highlight-bg)',
        transition: 'background-color 0.2s'
      },
      '.cm-comment-highlight-hovered': {
        filter: 'brightness(1.3)'
      },
      '.cm-comment-highlight-active': {
        backgroundColor: 'var(--comment-highlight-active-bg) !important'
      }
    })
  ]
}
