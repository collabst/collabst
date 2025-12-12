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

// Decoration for highlighted comment ranges
const commentMark = (commentId: string, color: string) =>
  Decoration.mark({
    class: 'cm-comment-highlight',
    attributes: {
      'data-comment-id': commentId,
      style: `background-color: ${color}40; border-bottom: 2px solid ${color};`
    }
  })

// State field to track comment decorations
export const commentField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)

    for (let effect of tr.effects) {
      if (effect.is(addCommentEffect)) {
        const mark = commentMark(effect.value.commentId, getCommentColor(effect.value.commentId))
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
          const mark = commentMark(commentId, getCommentColor(commentId))
          ranges.push(mark.range(range.from, range.to))
        })
        decorations = Decoration.set(ranges, true)
      }
    }

    return decorations
  },
  provide: (f) => EditorView.decorations.from(f)
})

// Helper to generate consistent colors for comment IDs
function getCommentColor(commentId: string): string {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#6366f1', // indigo
    '#f97316'  // orange
  ]
  const hash = commentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

// Yjs integration for syncing comment ranges
export class CommentRangeTracker {
  private yComments: Y.Map<any>
  private yText: Y.Text
  private view: EditorView
  private rangeCache: Map<string, { anchor: Y.RelativePosition; head: Y.RelativePosition }>
  private changeCallback: (() => void) | null = null
  private boundHandleYjsChange: (event: Y.YMapEvent<any>) => void

  constructor(ydoc: Y.Doc, fileId: number, view: EditorView) {
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
      if (commentData.resolved) return // Skip resolved comments

      const anchor = Y.createRelativePositionFromJSON(commentData.anchor)
      const head = Y.createRelativePositionFromJSON(commentData.head)

      const anchorPos = Y.createAbsolutePositionFromRelativePosition(anchor, this.yText.doc!)
      const headPos = Y.createAbsolutePositionFromRelativePosition(head, this.yText.doc!)

      if (anchorPos && headPos) {
        const from = Math.min(anchorPos.index, headPos.index)
        const to = Math.max(anchorPos.index, headPos.index)

        // Only add decoration if range is not empty
        if (from < to) {
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
      author: comment.author,
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

  getComment(commentId: string): Comment | null {
    const data = this.yComments.get(commentId)
    if (!data) return null

    return {
      id: commentId,
      fileId: data.fileId,
      content: data.content,
      author: data.author,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      resolved: data.resolved,
      replies: data.replies || [],
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
        author: data.author,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        resolved: data.resolved,
        replies: data.replies || [],
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
  }
}

// Extension to add comment functionality to CodeMirror
export function commentsExtension(): Extension {
  return [
    commentField,
    EditorView.baseTheme({
      '.cm-comment-highlight': {
        // cursor: 'pointer',
        // transition: 'background-color 0.2s'
      },
      '.cm-comment-highlight:hover': {
        // filter: 'brightness(1.1)'
      }
    })
  ]
}
