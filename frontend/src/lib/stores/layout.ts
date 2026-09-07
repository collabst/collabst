import { writable } from "svelte/store";
import { loadLayoutState, saveLayoutState } from "$lib/utils/layoutStorage";

/**
 * Panel geometry.
 *
 * This used to live in `editor/context/context.ts`, which was wrong on two
 * counts: the geometry outlives any one project, so `destroyContext()` had to
 * remember *not* to reset it, and its three `saveLayoutState` subscriptions ran
 * at import time, which is what broke server rendering. It is an app-wide
 * preference and belongs here with `theme` and `editorSettings`.
 */

const MIN_LEFT_PANEL_WIDTH = 180;
const MAX_LEFT_PANEL_WIDTH = 640;
const MIN_EDITOR_PREVIEW_RATIO = 0.15;
const MAX_EDITOR_PREVIEW_RATIO = 0.85;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

const storedLayout = loadLayoutState();

export const leftPanelVisible = writable<boolean>(storedLayout.leftPanelVisible);
/** Width of the left panel in pixels; it is a fixed column, not a flex weight. */
export const leftPanelWidth = writable<number>(
  clamp(storedLayout.leftPanelWidth, MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH),
);
/** Share of the remaining width given to the editor, the rest goes to preview. */
export const editorPreviewRatio = writable<number>(
  clamp(
    storedLayout.editorPreviewRatio,
    MIN_EDITOR_PREVIEW_RATIO,
    MAX_EDITOR_PREVIEW_RATIO,
  ),
);

leftPanelVisible.subscribe((visible) => saveLayoutState({ leftPanelVisible: visible }));
leftPanelWidth.subscribe((width) => saveLayoutState({ leftPanelWidth: width }));
editorPreviewRatio.subscribe((ratio) => saveLayoutState({ editorPreviewRatio: ratio }));

export function toggleLeftPanel() {
  leftPanelVisible.update((visible) => !visible);
}

export function showLeftPanel() {
  leftPanelVisible.set(true);
}

export function setLeftPanelWidth(width: number) {
  leftPanelWidth.set(clamp(width, MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH));
}

export function setEditorPreviewRatio(ratio: number) {
  editorPreviewRatio.set(
    clamp(ratio, MIN_EDITOR_PREVIEW_RATIO, MAX_EDITOR_PREVIEW_RATIO),
  );
}
