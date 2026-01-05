<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import { EditorView, basicSetup } from "codemirror";
  import { EditorState, Compartment, Transaction } from "@codemirror/state";
  import { lintGutter, setDiagnostics } from "@codemirror/lint";
  import { lineNumbers } from "@codemirror/view";
  import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
  import {
    greyDark,
    greyLight,
    greyDarkTheme,
    greyLightTheme,
    greyDarkSyntax,
    greyLightSyntax,
  } from "$lib/codemirror/greyTheme";
  import { keymap } from "@codemirror/view";
  import { openSearchPanel, search } from "@codemirror/search";
  import * as Y from "yjs";
  import type { WebsocketProvider } from "y-websocket";
  import {
    commentsExtension,
    CommentRangeTracker,
  } from "$lib/codemirror/comments";
  import { theme as themeStore } from "$lib/stores/theme";
  import { editorSettings } from "$lib/stores/editorSettings";
  import type { Diagnostic } from "$lib/types";
  import {
    bracketMatching,
    foldGutter,
    indentOnInput,
  } from "@codemirror/language";

  export let ytext: Y.Text;
  export let provider: WebsocketProvider;
  export let fileId: number;
  export let ydoc: Y.Doc;
  export let onTrackerReady: ((tracker: CommentRangeTracker) => void) | null =
    null;
  export let diagnostics: Diagnostic[] = [];
  export let fileName = "";
  export let wrapLines = true;

  let editorElement: HTMLDivElement;
  let view: EditorView | null = null;
  let undoManager: Y.UndoManager | null = null;
  let currentFileId: number | null = null;
  let commentTracker: CommentRangeTracker | null = null;
  let currentTheme: "light" | "dark" = $themeStore;
  const themeCompartment = new Compartment();
  const syntaxCompartment = new Compartment();
  const lineWrappingCompartment = new Compartment();
  const languageCompartment = new Compartment();
  const editorStyleCompartment = new Compartment();

  // Subscribe to theme changes
  $: currentTheme = $themeStore;
  $: if (view && currentTheme) {
    updateEditorTheme();
  }

  // Subscribe to editor settings changes
  $: if (view && $editorSettings) {
    updateEditorStyles();
  }

  // Update line wrapping when prop changes
  $: if (view && wrapLines !== undefined) {
    updateLineWrapping();
  }

  // Get theme extensions based on current theme (theme only, no syntax highlighting)
  function getThemeExtensions() {
    return currentTheme === "light" ? [greyLightTheme] : [greyDarkTheme];
  }

  // Get syntax highlighting extensions based on current theme and file type
  async function getSyntaxHighlighting() {
    const extension = fileName.split(".").pop()?.toLowerCase();

    // For Typst files, use custom Typst highlighting
    if (extension === "typ") {
      if (typeof window !== "undefined") {
        const { typstDark, typstLight } = await import(
          "$lib/codemirror/typstHighlight"
        );
        return currentTheme === "light" ? typstLight : typstDark;
      }
    }

    // For other files, use default theme syntax highlighting
    return currentTheme === "light" ? greyLightSyntax : greyDarkSyntax;
  }

  // Get line wrapping extensions based on wrapLines prop
  function getLineWrappingExtensions() {
    return wrapLines ? [EditorView.lineWrapping] : [];
  }

  // Get editor style extensions based on settings
  function getEditorStyleExtensions() {
    return EditorView.theme({
      "&": {
        fontSize: `${$editorSettings.fontSize}px`,
        fontFamily: $editorSettings.fontFamily,
      },
      ".cm-content": {
        fontSize: `${$editorSettings.fontSize}px`,
        fontFamily: $editorSettings.fontFamily,
      },
      ".cm-gutters": {
        fontSize: `${$editorSettings.fontSize}px`,
      }
    });
  }

  // Update editor styles when settings change
  function updateEditorStyles() {
    if (!view) return;

    view.dispatch({
      effects: editorStyleCompartment.reconfigure(getEditorStyleExtensions()),
    });
  }

  // Get language extensions based on file name (language support only, no syntax highlighting)
  async function getLanguageExtensions() {
    const extension = fileName.split(".").pop()?.toLowerCase();

    if (extension === "typ") {
      if (typeof window !== "undefined") {
        const { typst } = await import("codemirror-lang-typst");
        return [typst()];
      }
    }

    return [];
  }

  // Update editor theme when theme changes
  async function updateEditorTheme() {
    if (!view) return;

    // Reconfigure the main theme
    view.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtensions()),
    });

    // Reconfigure syntax highlighting (includes Typst-specific highlighting if applicable)
    const syntaxHighlighting = await getSyntaxHighlighting();
    view.dispatch({
      effects: syntaxCompartment.reconfigure(syntaxHighlighting),
    });
  }

  // Update line wrapping when prop changes
  function updateLineWrapping() {
    if (!view) return;

    view.dispatch({
      effects: lineWrappingCompartment.reconfigure(getLineWrappingExtensions()),
    });
  }

  // Update language when fileName changes
  async function updateLanguage() {
    if (!view) return;

    const languageExtensions = await getLanguageExtensions();
    view.dispatch({
      effects: languageCompartment.reconfigure(languageExtensions),
    });

    // Also update syntax highlighting for the new file type
    const syntaxHighlighting = await getSyntaxHighlighting();
    view.dispatch({
      effects: syntaxCompartment.reconfigure(syntaxHighlighting),
    });
  }

  // Store cursor positions as Yjs relative positions per file
  let cursorPositions: Map<number, any> = new Map();

  // Export methods for comment management
  export function getView() {
    return view;
  }

  export function getCommentTracker() {
    return commentTracker;
  }

  export function getSelection() {
    if (!view) return null;
    const { from, to } = view.state.selection.main;
    return {
      from,
      to,
      text: view.state.doc.sliceString(from, to),
    };
  }

  // Export editor action methods
  export function undo() {
    if (view && undoManager && undoManager.canUndo()) {
      undoManager.undo();
      view.focus();
    }
  }

  export function redo() {
    if (view && undoManager && undoManager.canRedo()) {
      undoManager.redo();
      view.focus();
    }
  }

  export function selectAll() {
    if (view) {
      view.dispatch({
        selection: { anchor: 0, head: view.state.doc.length },
        userEvent: "select",
      });
      view.focus();
    }
  }

  export function openSearch() {
    if (view) {
      openSearchPanel(view);
      view.focus();
    }
  }

  export function canUndo(): boolean {
    return undoManager ? undoManager.canUndo() : false;
  }

  export function canRedo(): boolean {
    return undoManager ? undoManager.canRedo() : false;
  }

  // Insert text at current cursor position or replace selection
  export function insertText(text: string) {
    if (!view) return;

    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }

  // Smart wrap: Toggle prefix/suffix around selection or cursor
  // If already wrapped, removes the wrapping. If not wrapped, adds it.
  export function toggleWrap(prefix: string, suffix: string) {
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const selectedText = view.state.doc.sliceString(from, to);

    // Check if we have text before and after selection
    const beforeStart = Math.max(0, from - prefix.length);
    const afterEnd = Math.min(view.state.doc.length, to + suffix.length);
    const textBefore = view.state.doc.sliceString(beforeStart, from);
    const textAfter = view.state.doc.sliceString(to, afterEnd);

    // Check if already wrapped
    const isWrapped =
      textBefore.endsWith(prefix) && textAfter.startsWith(suffix);

    if (isWrapped) {
      // Remove wrapping
      if (selectedText) {
        // Selection exists - remove prefix before and suffix after
        // Changes array positions are relative to original document, CodeMirror handles adjustments
        view.dispatch({
          changes: [
            { from: from - prefix.length, to: from, insert: "" },
            { from: to, to: to + suffix.length, insert: "" },
          ],
          selection: { anchor: from - prefix.length, head: to - prefix.length },
        });
      } else {
        // No selection, just cursor - remove prefix before and suffix after
        view.dispatch({
          changes: [
            { from: from - prefix.length, to: from, insert: "" },
            { from: from, to: from + suffix.length, insert: "" },
          ],
          selection: { anchor: from - prefix.length },
        });
      }
    } else {
      // Add wrapping
      if (selectedText) {
        // Wrap selection
        view.dispatch({
          changes: { from, to, insert: `${prefix}${selectedText}${suffix}` },
          selection: {
            anchor: from + prefix.length,
            head: from + prefix.length + selectedText.length,
          },
        });
      } else {
        // Insert prefix and suffix at cursor
        view.dispatch({
          changes: { from, insert: `${prefix}${suffix}` },
          selection: { anchor: from + prefix.length },
        });
      }
    }
    view.focus();
  }

  // Toggle line prefixes for lists (handles indentation and list type switching)
  export function toggleLinePrefix(marker: string, alternateMarker?: string) {
    if (!view) return;

    const { from, to } = view.state.selection.main;
    const doc = view.state.doc;

    // Get all lines in selection
    const fromLine = doc.lineAt(from);
    const toLine = doc.lineAt(to);

    const changes: { from: number; to: number; insert: string }[] = [];
    let newCursorPos = from;

    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = doc.line(lineNum);
      const lineText = line.text;

      // Find indentation (spaces at start)
      const indentMatch = lineText.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : "";
      const contentStart = indent.length;
      const restOfLine = lineText.slice(contentStart);

      // Check what's at the start of the content
      const hasCurrentMarker = restOfLine.startsWith(marker);
      const hasAlternateMarker =
        alternateMarker && restOfLine.startsWith(alternateMarker);

      if (hasCurrentMarker) {
        // Remove current marker
        changes.push({
          from: line.from + contentStart,
          to: line.from + contentStart + marker.length,
          insert: "",
        });
        if (lineNum === fromLine.number) {
          newCursorPos = Math.max(
            line.from + indent.length,
            from - marker.length,
          );
        }
      } else if (hasAlternateMarker && alternateMarker) {
        // Replace alternate marker with current marker
        changes.push({
          from: line.from + contentStart,
          to: line.from + contentStart + alternateMarker.length,
          insert: marker,
        });
        if (lineNum === fromLine.number) {
          newCursorPos = from + (marker.length - alternateMarker.length);
        }
      } else {
        // Add current marker
        changes.push({
          from: line.from + contentStart,
          to: line.from + contentStart,
          insert: marker,
        });
        if (lineNum === fromLine.number) {
          newCursorPos = from + marker.length;
        }
      }
    }

    view.dispatch({
      changes,
      selection: { anchor: newCursorPos },
    });
    view.focus();
  }

  // Custom keymap for undo/redo and formatting shortcuts
  function createUndoRedoKeymap() {
    return keymap.of([
      {
        key: "Mod-z",
        run: (view) => {
          if (undoManager && undoManager.canUndo()) {
            undoManager.undo();
            return true;
          }
          return false;
        },
      },
      {
        key: "Mod-Shift-z",
        run: (view) => {
          if (undoManager && undoManager.canRedo()) {
            undoManager.redo();
            return true;
          }
          return false;
        },
      },
      {
        key: "Mod-y",
        run: (view) => {
          if (undoManager && undoManager.canRedo()) {
            undoManager.redo();
            return true;
          }
          return false;
        },
      },
      {
        key: "Mod-b",
        run: () => {
          toggleWrap("*", "*");
          return true;
        },
      },
      {
        key: "Mod-i",
        run: () => {
          toggleWrap("_", "_");
          return true;
        },
      },
      {
        key: "Mod-u",
        run: () => {
          toggleWrap("#underline[", "]");
          return true;
        },
      },
    ]);
  }

  async function initializeEditor() {
    if (!editorElement || !ytext || !provider) return;

    console.log("[CodeEditor] Initializing editor for file", fileId);
    currentFileId = fileId;

    // Load language extensions and syntax highlighting
    const languageExtensions = await getLanguageExtensions();
    const syntaxHighlighting = await getSyntaxHighlighting();

    undoManager = new Y.UndoManager(ytext);

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        foldGutter(),
        lineWrappingCompartment.of(getLineWrappingExtensions()),
        basicSetup,
        search(),
        themeCompartment.of(getThemeExtensions()),
        syntaxCompartment.of(syntaxHighlighting),
        languageCompartment.of(languageExtensions),
        editorStyleCompartment.of(getEditorStyleExtensions()),
        bracketMatching(),
        indentOnInput(),
        yCollab(ytext, provider.awareness, { undoManager }),
        createUndoRedoKeymap(),
        commentsExtension(),
        lineNumbers(),
        lintGutter(),
      ],
    });

    view = new EditorView({
      state,
      parent: editorElement,
    });

    // Focus the editor
    view.focus();

    // Initialize comment tracker
    commentTracker = new CommentRangeTracker(ydoc, fileId, view);

    // Notify parent that tracker is ready
    if (onTrackerReady) {
      onTrackerReady(commentTracker);
    }
  }

  async function switchFile() {
    if (!view || !ytext || !provider) return;
    if (currentFileId === fileId) return;

    console.log(
      "[CodeEditor] Switching from file",
      currentFileId,
      "to",
      fileId,
    );

    // Load language extensions and syntax highlighting
    const languageExtensions = await getLanguageExtensions();
    const syntaxHighlighting = await getSyntaxHighlighting();

    // Save current cursor position as relative position before switching
    if (currentFileId !== null) {
      const currentYtext = ydoc.getText(`file-${currentFileId}`);
      const selection = view.state.selection.main;
      const relativePos = Y.createRelativePositionFromTypeIndex(
        currentYtext,
        selection.head,
      );
      cursorPositions.set(currentFileId, Y.relativePositionToJSON(relativePos));
    }

    currentFileId = fileId;

    if (undoManager) {
      undoManager.destroy();
    }
    undoManager = new Y.UndoManager(ytext);

    // Destroy old comment tracker
    if (commentTracker) {
      commentTracker.destroy();
    }

    view.setState(
      EditorState.create({
        doc: ytext.toString(),
        extensions: [
          lineWrappingCompartment.of(getLineWrappingExtensions()),
          basicSetup,
          foldGutter(),
          search(),
          themeCompartment.of(getThemeExtensions()),
          syntaxCompartment.of(syntaxHighlighting),
          languageCompartment.of(languageExtensions),
          editorStyleCompartment.of(getEditorStyleExtensions()),
          bracketMatching(),
          indentOnInput(),
          yCollab(ytext, provider.awareness, { undoManager }),
          createUndoRedoKeymap(),
          commentsExtension(),
          lineNumbers(),
          lintGutter(),
        ],
      }),
    );

    // Restore cursor position if we have one saved
    const savedPosition = cursorPositions.get(fileId);
    if (savedPosition) {
      const relativePos = Y.createRelativePositionFromJSON(savedPosition);
      const absolutePos = Y.createAbsolutePositionFromRelativePosition(
        relativePos,
        ydoc,
      );
      if (absolutePos) {
        view.dispatch({
          selection: { anchor: absolutePos.index, head: absolutePos.index },
        });
      }
    }

    // Focus the editor
    view.focus();

    // Initialize new comment tracker for this file
    commentTracker = new CommentRangeTracker(ydoc, fileId, view);

    // Notify parent that tracker is ready
    if (onTrackerReady) {
      onTrackerReady(commentTracker);
    }
  }

  $: if (view && ytext && provider && currentFileId !== fileId) {
    switchFile();
  }

  // Function to update lint marker styling based on error length
  function updateLintMarkers() {
    if (!view) return;

    // Find all lint range elements
    const lintRanges = view.dom.querySelectorAll(".cm-lintRange-error");
    lintRanges.forEach((element: Element) => {
      const textContent = element.textContent || "";
      const isSingleChar = textContent.length === 1;

      if (isSingleChar) {
        (element as HTMLElement).setAttribute("data-single-char", "true");
      } else {
        (element as HTMLElement).removeAttribute("data-single-char");
      }
    });
  }

  // Watch for diagnostics changes and update styling
  $: if (view && diagnostics && diagnostics.length > 0) {
    // Update lint marker styling after a brief delay for DOM updates
    setTimeout(updateLintMarkers, 10);
  }

  // Update lint markers when diagnostics change
  onMount(() => {
    initializeEditor();
  });

  onDestroy(() => {
    console.log("[CodeEditor] Destroying editor");
    if (commentTracker) {
      commentTracker.destroy();
      commentTracker = null;
    }
    if (view) {
      view.destroy();
      view = null;
    }
    if (undoManager) {
      undoManager.destroy();
      undoManager = null;
    }
    currentFileId = null;
  });
</script>

<div bind:this={editorElement} class="editor"></div>

<style>
  .editor {
    height: 100%;
    font-size: 14px;
    font-family: monospace;
  }

  :global(.cm-editor) {
    height: 100%;
  }

  /* Custom error underline for diagnostics */
  :global(.cm-lintRange.cm-lintRange-error) {
    text-decoration: underline wavy var(--color-error) 1px;
    text-underline-offset: 2px;
    background: none;
  }

  /* Single character error styling with arrow */
  :global(.cm-lintRange.cm-lintRange-error[data-single-char="true"]) {
    text-decoration: none;
    position: relative;
  }

  :global(.cm-lintRange.cm-lintRange-error[data-single-char="true"]::after) {
    content: "‸";
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--color-error);
    font-size: 18px;
    font-weight: bold;
    pointer-events: none;
    z-index: 10;
  }

  /* Custom text box info */
  :global(.cm-diagnostic) {
    background-color: var(--bg-topbar);
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    box-shadow: var(--shadow-lg);
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-3);
  }
</style>
