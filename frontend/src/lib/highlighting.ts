import {
  Decoration,
  type DecorationSet as DecorationSetType,
} from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "codemirror";
import type { SemanticTokenLegend } from "./types";

export const updateHighlightEffect = StateEffect.define<DecorationSetType>();

export const highlightField = StateField.define<DecorationSetType>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (let effect of tr.effects) {
      if (effect.is(updateHighlightEffect)) {
        return effect.value;
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const tokenTypeToClass: Record<string, string> = {
  comment: "cm-typst-comment",
  string: "cm-typst-string",
  operator: "cm-typst-operator",
  keyword: "cm-typst-keyword",
  number: "cm-typst-number",
  function: "cm-typst-function",
  decorator: "cm-typst-function",
  bool: "cm-typst-bool",
  punctuation: "cm-typst-punctuation",
  escape: "cm-typst-escape",
  link: "cm-typst-link",
  raw: "cm-typst-raw",
  label: "cm-typst-label",
  ref: "cm-typst-ref",
  heading: "cm-typst-heading",
  marker: "cm-typst-marker",
  term: "cm-typst-term",
  pol: "cm-typst-pol",
  delim: "cm-typst-delim",
  text: "cm-typst-text",
  error: "cm-typst-error",
};

function getTokenClass(tokenType: string, modifiers: string[]): string {
  let className = tokenTypeToClass[tokenType] || "";

  if (modifiers.includes("math")) {
    return "cm-typst-math";
  }

  if (modifiers.includes("strong") && modifiers.includes("emph")) {
    return "cm-typst-strong-emphasis";
  }

  if (modifiers.includes("strong")) {
    return "cm-typst-strong";
  }

  if (modifiers.includes("emph")) {
    return "cm-typst-emphasis";
  }

  return className;
}

function getTokenModifiers(
  tokenModifiersSet: number,
  semanticTokenLegend: SemanticTokenLegend
): string[] {
  const modifiers: string[] = [];
  let modSet = tokenModifiersSet;

  for (
    let j = 0;
    modSet > 0 && j < semanticTokenLegend.tokenModifiers.length;
    j++
  ) {
    if (modSet & 1) {
      modifiers.push(semanticTokenLegend.tokenModifiers[j]);
    }
    modSet = modSet >> 1;
  }

  return modifiers;
}

export function getHighlightsFromString(
  content: string,
  parser: any,
  semanticTokenLegend: SemanticTokenLegend | null
): any[] {
  if (!parser || !semanticTokenLegend) return [];

  const tokens = parser.get_semantic_tokens_by_string(content, "utf-8");
  if (!tokens || tokens.length === 0) return [];

  const decorations: any[] = [];
  const lines = content.split("\n");
  const lineOffsets: number[] = [0];

  for (let i = 0; i < lines.length - 1; i++) {
    lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
  }

  let currentLine = 0;
  let currentChar = 0;
  let endOffset = 0;

  for (let i = 0; i < tokens.length; i += 5) {
    const deltaLine = tokens[i];
    const deltaStart = tokens[i + 1];
    const length = tokens[i + 2];
    const tokenTypeIndex = tokens[i + 3];
    const tokenModifiersSet = tokens[i + 4];

    if (deltaLine > 0) {
      currentLine += deltaLine;
      currentChar = deltaStart;
    } else {
      currentChar += deltaStart;
    }

    if (currentLine >= lines.length) continue;

    const startOffset = lineOffsets[currentLine] + currentChar;
    if (startOffset < endOffset) continue;
    endOffset = startOffset + length;

    const tokenType = semanticTokenLegend.tokenTypes[tokenTypeIndex] || "text";
    const modifiers = getTokenModifiers(tokenModifiersSet, semanticTokenLegend);
    const className = getTokenClass(tokenType, modifiers);

    if (className && startOffset < endOffset) {
      decorations.push(
        Decoration.mark({ class: className }).range(startOffset, endOffset)
      );
    }
  }

  return decorations;
}

export function updateSyntaxHighlighting(
  editorView: EditorView | null,
  parser: any,
  semanticTokenLegend: SemanticTokenLegend | null
): void {
  if (!editorView) return;

  try {
    const content = editorView.state.doc.toString();
    const decorations = getHighlightsFromString(
      content,
      parser,
      semanticTokenLegend
    );
    const decorationSet = Decoration.set(decorations, true);

    // Use requestAnimationFrame to avoid interfering with ongoing edits
    requestAnimationFrame(() => {
      if (editorView) {
        editorView.dispatch({
          effects: updateHighlightEffect.of(decorationSet),
        });
      }
    });
  } catch (e) {
    console.warn("Syntax highlighting error:", e);
  }
}
