import { commentsExtension } from "$lib/codemirror/comments";
import {
  greyDarkSyntax,
  greyDarkTheme,
  greyLightSyntax,
  greyLightTheme,
} from "$lib/codemirror/greyTheme";
import { editorSettings } from "$lib/stores/editorSettings";
import { wrapLines } from "$lib/stores/preferences";
import { theme } from "$lib/stores/theme";
import { selectComment } from "../comments";
import { getHighlightExtensions } from "../search";
import {
  canWrite,
  comments,
  projectYjs,
  selectedFile,
  type Disposer,
  view,
} from "../state";
import { createUndoRedoKeymap } from "./commands";
import { getErrorLines } from "./diagnostics";
import { createFindKeymap } from "./find";
import { getUndoManager, ytext } from "./view";
import { closeBrackets } from "@codemirror/autocomplete";
import { bracketMatching, foldGutter, indentOnInput, indentUnit } from "@codemirror/language";
import { search } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate, lineNumbers } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { get } from "svelte/store";
import { yCollab } from "y-codemirror.next";
/**
 * The CodeMirror extension set, and the compartments that let pieces of it be
 * swapped without rebuilding the whole state: theme, syntax highlighting,
 * language, line numbers, wrapping, ligatures, read-only and editable.
 */

const themeCompartment = new Compartment();
const syntaxCompartment = new Compartment();
const lineWrappingCompartment = new Compartment();
const languageCompartment = new Compartment();
const editorStyleCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const ligaturesCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const editableCompartment = new Compartment();
const highlightCompartement = new Compartment();

function getLineWrappingExtensions() {
  return get(wrapLines) ? [EditorView.lineWrapping] : [];
}

function getLineNumbersExtension() {
  return lineNumbers({
    formatNumber: (lineNo) => {
      // Show × symbol instead of line number for lines with errors
      if (getErrorLines().has(lineNo)) {
        return "×";
      }
      return String(lineNo);
    },
    domEventHandlers: {
      // Add data-error attribute to gutter elements with errors
    },
  });
}

function getThemeExtensions() {
  return get(theme) === "light" ? [greyLightTheme] : [greyDarkTheme];
}

async function getSyntaxHighlighting() {
  const currentTheme = get(theme);
  const fileName = get(selectedFile)?.name || "";
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

  // For BibTeX files, use custom BibTeX highlighting
  if (extension === "bib") {
    if (typeof window !== "undefined") {
      const { bibtexDark, bibtexLight } = await import(
        "$lib/codemirror/bibtexHighlight"
      );
      return currentTheme === "light" ? bibtexLight : bibtexDark;
    }
  }

  // For other files, use default theme syntax highlighting
  return currentTheme === "light" ? greyLightSyntax : greyDarkSyntax;
}

async function getLanguageExtensions() {
  const fileName = get(selectedFile)?.name || "";
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "typ") {
    if (typeof window !== "undefined") {
      const { typst } = await import("codemirror-lang-typst");
      // `codemirror-lang-typst` does declare `commentTokens`, but only with a
      // block token and — because it builds its `Language` with the base
      // constructor instead of `LRLanguage.define()` — it never attaches that
      // facet to its top node, so `state.languageDataAt("commentTokens")` comes
      // back empty and *both* comment commands are no-ops in a `.typ` file.
      // A language-data provider bypasses the syntax-tree lookup entirely; it
      // is scoped to this compartment, which is reconfigured per file, so it
      // only ever answers for Typst documents.
      return [
        EditorState.languageData.of(() => [
          { commentTokens: { line: "//", block: { open: "/*", close: "*/" } } },
        ]),
        typst(),
      ];
    }
  }

  if (extension === "bib") {
    if (typeof window !== "undefined") {
      const { bibtex } = await import("codemirror-lang-bib");
      return [
        bibtex({
          enableLinting: false,
          enableTooltips: true,
          enableAutocomplete: true,
          autoCloseBrackets: false,
        }),
      ];
    }
  }

  return [];
}

function getEditorStyleExtensions() {
  const fontSize = get(editorSettings).fontSize;
  const fontFamily = get(editorSettings).fontFamily;
  return EditorView.theme({
    "&": {
      fontSize: `${fontSize}px`,
      fontFamily: fontFamily,
    },
    ".cm-content": {
      fontSize: `${fontSize}px`,
      fontFamily: fontFamily,
    },
    ".cm-gutters": {
      fontSize: `${fontSize}px`,
    },
  });
}

function getLigaturesExtension() {
  const ligatures = get(editorSettings).ligatures;
  return EditorView.theme({
    "&": {
      fontVariantLigatures: ligatures ? "normal" : "none",
    },
    ".cm-content": {
      fontVariantLigatures: ligatures ? "normal" : "none",
    },
  });
}

// `commentsExtension()` carries its own click handler, but it dispatches through
// the `CommentRangeTracker` singleton — part of the old Yjs-map comment storage,
// which this tree does not use — so it can never fire. Same behaviour, wired
// straight to the context: a plain click (no selection) inside a highlight opens
// its thread.
function createCommentClickHandler() {
  return EditorView.domEventHandlers({
    mouseup(event, viewValue) {
      const selection = viewValue.state.selection.main;
      if (selection.from !== selection.to) return false;

      const target = event.target as HTMLElement;
      const commentId = target
        .closest(".cm-comment-highlight")
        ?.getAttribute("data-comment-id");
      if (!commentId) return false;

      const comment = get(comments).find((c) => c.id === commentId);
      if (comment) selectComment(comment);
      return false;
    },
  });
}

function createErrorIconPlugin() {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.applyClasses(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.applyClasses(update.view);
        }
      }

      applyClasses(view: EditorView) {
        setTimeout(() => {
          const gutterElements = view.dom.querySelectorAll(
            ".cm-lineNumbers .cm-gutterElement",
          );
          gutterElements.forEach((el) => {
            const text = el.textContent?.trim();
            if (text === "×") {
              (el as HTMLElement).classList.add("cm-error-icon");
            } else {
              (el as HTMLElement).classList.remove("cm-error-icon");
            }
          });
        }, 0);
      }
    },
  );
}

export async function createExtensions() {
  const ytextValue = get(ytext);
  const provider = get(projectYjs)?.provider;
  // Read into a const: `undoManager` is reassigned on every file switch, and
  // the extension list must be built against the one that existed when it ran.
  const undoManagerValue = getUndoManager();
  const collabReady = ytextValue && provider && undoManagerValue;
  const extensions = [
    foldGutter(),
    lineWrappingCompartment.of(getLineWrappingExtensions()),
    lineNumbersCompartment.of(getLineNumbersExtension()),
    basicSetup,
    // The search *state* only; the panel is `editorPanel/Find.svelte`, a normal
    // component driven by the stores above.
    search({ top: true }),
    createFindKeymap(),
    themeCompartment.of(getThemeExtensions()),
    syntaxCompartment.of(await getSyntaxHighlighting()),
    languageCompartment.of(await getLanguageExtensions()),
    editorStyleCompartment.of(getEditorStyleExtensions()),
    ligaturesCompartment.of(getLigaturesExtension()),
    createErrorIconPlugin(),
    bracketMatching(),
    closeBrackets(),
    indentOnInput(),
    indentUnit.of("  "), // Set indentation to 2 spaces
    readOnlyCompartment.of(EditorState.readOnly.of(!get(canWrite))),
    editableCompartment.of(EditorView.editable.of(get(canWrite))),
    ...(collabReady ? [yCollab(ytextValue, provider.awareness, { undoManager: undoManagerValue })] : []),
    createUndoRedoKeymap(),
    commentsExtension(),
    createCommentClickHandler(),
    highlightCompartement.of(getHighlightExtensions()),
  ];
  return extensions;
}


// `createExtensions()` only *seeds* the compartments — nothing ever called
// `reconfigure()`, so a theme, font or file-type change did not reach a view that
// was already built, and only took effect at the next full rebuild. Each
// subscription below bails out when there is no view yet (the next
// `createExtensions()` reads the new value anyway) and re-checks the view after
// every `await`, so a rebuild that happens mid-flight is not clobbered.

async function reconfigureSyntaxHighlighting(viewValue: EditorView) {
  const syntax = await getSyntaxHighlighting();
  if (get(view) !== viewValue) return;
  viewValue.dispatch({ effects: syntaxCompartment.reconfigure(syntax) });
}

async function reconfigureLanguage(viewValue: EditorView) {
  const language = await getLanguageExtensions();
  if (get(view) !== viewValue) return;
  viewValue.dispatch({ effects: languageCompartment.reconfigure(language) });
}

/**
 * Keep the compartments in step with what they depend on.
 *
 * Four module-scope subscriptions until now (`PHASE2.md` §2.2). `wrapLines` is
 * the odd one out: the store itself is an app-wide preference living in
 * `lib/stores/preferences.ts`, but *applying* it to the view is project-scoped,
 * so only that half is wired here.
 */
export function wireEditorExtensions(): Disposer {
  const disposers = [
    theme.subscribe(() => {
      const viewValue = get(view);
      if (!viewValue) return;
      viewValue.dispatch({
        effects: themeCompartment.reconfigure(getThemeExtensions()),
      });
      void reconfigureSyntaxHighlighting(viewValue);
    }),
    editorSettings.subscribe(() => {
      const viewValue = get(view);
      if (!viewValue) return;
      viewValue.dispatch({
        effects: [
          editorStyleCompartment.reconfigure(getEditorStyleExtensions()),
          ligaturesCompartment.reconfigure(getLigaturesExtension()),
        ],
      });
    }),
    // `wrapLines` is persisted by `lib/stores/preferences.ts`; what belongs to the
    // editor is applying it, by reconfiguring the line-wrapping compartment.
    wrapLines.subscribe(() => {
      const viewValue = get(view);
      if (!viewValue) return;
      viewValue.dispatch({
        effects: lineWrappingCompartment.reconfigure(getLineWrappingExtensions()),
      });
    }),
    // The file extension is what picks Typst over BibTeX. `ytext` normally rebuilds
    // the whole state just after this, but not when the Yjs document is not up yet.
    selectedFile.subscribe(() => {
      const viewValue = get(view);
      if (!viewValue) return;
      void reconfigureLanguage(viewValue);
      void reconfigureSyntaxHighlighting(viewValue);
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/**
 * Repaint the line-number gutter after the error set changes. Called by
 * `./diagnostics`, which owns `errorLines` but not the compartment.
 */
export function reconfigureLineNumbers(viewValue: EditorView) {
  viewValue.dispatch({
    effects: lineNumbersCompartment.reconfigure(getLineNumbersExtension()),
  });
}

/**
 * Lock or unlock the open document after a live role change.
 *
 * `createExtensions()` seeds both compartments from `canWrite`, so only an
 * already-built view needs reconfiguring — which is why this is a wire and not
 * part of the extension set.
 */
export function wireEditability(): Disposer {
  return canWrite.subscribe((writeAllowed) => {
    const viewValue = get(view);
    if (!viewValue) return;
    viewValue.dispatch({
      effects: [
        readOnlyCompartment.reconfigure(EditorState.readOnly.of(!writeAllowed)),
        editableCompartment.reconfigure(EditorView.editable.of(writeAllowed)),
      ],
    });
  });
}
