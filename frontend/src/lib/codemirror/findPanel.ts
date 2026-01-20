import Find from '../components/editor/Find.svelte'
import { mount } from 'svelte'
import type { EditorView } from '@codemirror/view'

export function createFindPanel(view: EditorView) {
  const dom = document.createElement('div')
  const args = {
    target: dom,
    props: {
      view,
    },
  }
  mount(Find, args)
  return {
    dom,
    top: false, // Show at bottom
  }
}
