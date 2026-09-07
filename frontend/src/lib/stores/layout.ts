import { writable } from "svelte/store";
import { loadLayoutState, saveLayoutState } from "$lib/utils/layoutStorage";

/**
 * Panel geometry: an app-wide preference that outlives any one project.
 *
 * The side panel and the preview are both columns of a set width; the editor
 * between them is the elastic one, and it absorbs every change. That is what
 * keeps the two handles independent — dragging one moves the panel beside it
 * and nothing else.
 */

const MIN_LEFT_PANEL_WIDTH = 180;
const MAX_LEFT_PANEL_WIDTH = 640;

/** The narrowest the preview is worth showing at. */
export const MIN_PREVIEW_WIDTH = 240;
/** What the columns beside the editor have to leave it. */
export const MIN_EDITOR_WIDTH = 320;

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
/**
 * Width of the preview in pixels. A preference rather than a promise: a window
 * too narrow to honour it has the preview give width back (see `Panel`), and
 * widening the window brings it back to this.
 */
export const previewWidth = writable<number>(
  Math.max(storedLayout.previewWidth, MIN_PREVIEW_WIDTH),
);

leftPanelVisible.subscribe((visible) => saveLayoutState({ leftPanelVisible: visible }));
leftPanelWidth.subscribe((width) => saveLayoutState({ leftPanelWidth: width }));
previewWidth.subscribe((width) => saveLayoutState({ previewWidth: width }));

export function toggleLeftPanel() {
  leftPanelVisible.update((visible) => !visible);
}

export function showLeftPanel() {
  leftPanelVisible.set(true);
}

export function setLeftPanelWidth(width: number) {
  leftPanelWidth.set(clamp(width, MIN_LEFT_PANEL_WIDTH, MAX_LEFT_PANEL_WIDTH));
}

export function setPreviewWidth(width: number) {
  previewWidth.set(clamp(width, MIN_PREVIEW_WIDTH, Number.MAX_SAFE_INTEGER));
}
