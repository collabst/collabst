import { StateField, StateEffect } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'
import * as Y from 'yjs'
import type { Comment } from '$lib/types'

export const addCommentEffect = StateEffect.define<{
  commentId: string
  from: number
  to: number
}>()

export const removeCommentEffect = StateEffect.define<{ commentId: string }>()

export const updateCommentsEffect = StateEffect.define<{
  comments: Map<string, { from: number; to: number }>
}>()

export const setActiveCommentEffect = StateEffect.define<string | null>()

export const setHoveredCommentEffect = StateEffect.define<string | null>()

// Decoration for highlighted comment ranges. Active and hovered are independent
// — a thread can be both — so the classes are composed rather than switched.
const commentMark = (
  commentId: string,
  activeId: string | null,
  hoveredId: string | null,
) => {
  let className = 'cm-comment-highlight'
  if (commentId === activeId) className += ' cm-comment-highlight-active'
  if (commentId === hoveredId) className += ' cm-comment-highlight-hovered'
  return Decoration.mark({
    class: className,
    attributes: {
      'data-comment-id': commentId,
    }
  })
}

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

export const hoveredCommentField = StateField.define<string | null>({
  create() {
    return null
  },
  update(hoveredId, tr) {
    for (let effect of tr.effects) {
      if (effect.is(setHoveredCommentEffect)) {
        return effect.value
      }
    }
    return hoveredId
  }
})

export const commentField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)

    // The active/hovered fields update in this same transaction, so their new
    // values must be read from the effects rather than from `tr.state`.
    let activeChanged = false
    let newActiveId: string | null = tr.startState.field(activeCommentField)
    let hoveredChanged = false
    let newHoveredId: string | null = tr.startState.field(hoveredCommentField)
    for (let effect of tr.effects) {
      if (effect.is(setActiveCommentEffect)) {
        activeChanged = true
        newActiveId = effect.value
      } else if (effect.is(setHoveredCommentEffect)) {
        hoveredChanged = true
        newHoveredId = effect.value
      }
    }

    for (let effect of tr.effects) {
      if (effect.is(addCommentEffect)) {
        const mark = commentMark(effect.value.commentId, newActiveId, newHoveredId)
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
        const ranges: any[] = []
        effect.value.comments.forEach((range, commentId) => {
          ranges.push(commentMark(commentId, newActiveId, newHoveredId).range(range.from, range.to))
        })
        decorations = Decoration.set(ranges, true)
      }
    }

    // Active/hovered changed alone: rebuild the marks with their new classes.
    if ((activeChanged || hoveredChanged) && !tr.effects.some(e => e.is(updateCommentsEffect))) {
      const iter = decorations.iter()
      const ranges: any[] = []
      while (iter.value) {
        const commentId = iter.value.spec?.attributes?.['data-comment-id']
        if (commentId) {
          ranges.push(commentMark(commentId, newActiveId, newHoveredId).range(iter.from, iter.to))
        }
        iter.next()
      }
      decorations = Decoration.set(ranges, true)
    }

    return decorations
  },
  provide: (f) => EditorView.decorations.from(f)
})

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

    this.boundHandleYjsChange = this.handleYjsChange.bind(this)

    this.yComments.observe(this.boundHandleYjsChange)

    this.syncFromYjs()
  }

  onCommentsChange(callback: () => void) {
    this.changeCallback = callback
  }

  onDocChange(callback: () => void) {
    this.docChangeCallback = callback
  }

  notifyDocChange() {
    if (this.docChangeCallback) {
      if (this.docChangeTimer) clearTimeout(this.docChangeTimer)
      this.docChangeTimer = setTimeout(() => {
        this.docChangeCallback?.()
      }, 30)
    }
  }

  onCommentHover(callback: (commentId: string | null) => void) {
    this.hoverCallback = callback
  }

  notifyCommentHover(commentId: string | null) {
    if (this.hoverCallback) {
      this.hoverCallback(commentId)
    }
  }

  onCommentClick(callback: (commentId: string) => void) {
    this.clickCallback = callback
  }

  notifyCommentClick(commentId: string) {
    if (this.clickCallback) {
      this.clickCallback(commentId)
    }
  }

  setActiveComment(commentId: string | null) {
    this.view.dispatch({
      effects: setActiveCommentEffect.of(commentId)
    })
  }

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

        this.rangeCache.set(commentId, { anchor, head })

        const line = this.view.state.doc.lineAt(from).number
        if (commentData.line !== line) {
          this.yComments.set(commentId, { ...commentData, line })
        }
      }
    })

    this.view.dispatch({
      effects: updateCommentsEffect.of({ comments })
    })
  }

  addComment(commentId: string, from: number, to: number, comment: Comment) {
    const anchor = Y.createRelativePositionFromTypeIndex(this.yText, from)
    const head = Y.createRelativePositionFromTypeIndex(this.yText, to)

    const line = this.view.state.doc.lineAt(from).number

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
          const top = coords.top - editorRect.top + scrollTop
          positions.set(commentId, top)
        }
      }
    })

    return positions
  }

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

let currentTracker: CommentRangeTracker | null = null

export function setCurrentTracker(tracker: CommentRangeTracker | null) {
  currentTracker = tracker
}

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
    // Only clear when leaving a highlight without entering another.
    if (target.closest('.cm-comment-highlight') && !related?.closest('.cm-comment-highlight')) {
      lastHoveredCommentId = null
      if (currentTracker) {
        currentTracker.notifyCommentHover(null)
      }
    }
    return false
  }
})

// mouseup, so it does not interfere with text selection.
const commentClickHandler = EditorView.domEventHandlers({
  mouseup(event, view) {
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

const docChangeListener = EditorView.updateListener.of((update) => {
  if (update.docChanged || update.geometryChanged) {
    if (currentTracker) {
      currentTracker.notifyDocChange()
    }
  }
})

export function commentsExtension(): Extension {
  return [
    activeCommentField,
    hoveredCommentField,
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
