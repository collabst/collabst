import { notifications } from "$lib/stores/notifications";
import { theme } from "$lib/stores/theme";
import { project, separatePreviewHost, separatePreviewOpen } from "../state";
import {
  handleIframeMessage,
  requestZoomReapplyOnNextInit,
  resetIframeBridge,
} from "./iframe";
import { flushSync } from "svelte";
import { get } from "svelte/store";

// --- Separate preview window ---------------------------------------------
//
// The popup is a bare same-origin document holding one `<iframe
// src="/typst-preview">` — the same page the preview panel embeds, so there is
// one renderer. While it is open the split view drops its preview column
// entirely, so the popup owns the whole preview surface: the artifact stream,
// the zoom commands, and the toolbar. Its frame's bridge talks to
// `window.parent` (the popup); the main window listens there, so
// `handleIframeMessage` serves both surfaces.
let separateWindow: Window | null = null;
let separateFrame: HTMLIFrameElement | null = null;
let separateThemeUnsubscribe: (() => void) | null = null;

/** Layout only: the app's own stylesheets, copied below, carry the looks. */
const POPUP_LAYOUT_CSS = `
  html, body { height: 100%; }
  body { margin: 0; overflow: hidden; }
  .separate-preview {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .separate-preview iframe {
    flex: 1;
    min-height: 0;
    width: 100%;
    border: none;
    display: block;
  }
`;

/**
 * Give the popup the app's stylesheets, so the toolbar mounted into it renders
 * with the same scoped styles and theme tokens as the one in the split view.
 */
function copyStyles(popup: Window) {
  const nodes = document.querySelectorAll('style, link[rel="stylesheet"]');
  for (const node of nodes) {
    const clone = popup.document.importNode(node, true) as HTMLElement;
    // `about:blank` has no base URL of its own, so a relative `href` copied as
    // written would resolve against nothing.
    if (clone.tagName === "LINK") {
      (clone as HTMLLinkElement).href = (node as HTMLLinkElement).href;
    }
    popup.document.head.appendChild(clone);
  }

  const layout = popup.document.createElement("style");
  layout.textContent = POPUP_LAYOUT_CSS;
  popup.document.head.appendChild(layout);
}

export function openSeparatePreview() {
  if (separateWindow && !separateWindow.closed) {
    separateWindow.focus();
    return;
  }

  const popup = window.open("", "collabst-preview", "width=900,height=700");
  if (!popup) {
    notifications.show(
      "The preview window was blocked by the browser",
      "error",
      5000,
    );
    return;
  }

  separateWindow = popup;
  popup.document.title = `${get(project)?.name ?? "Preview"} — Collabst`;
  copyStyles(popup);

  // The toolbar is positioned against this element and mounted into it by
  // `SeparateWindow.svelte`; see `separatePreviewHost`.
  const host = popup.document.createElement("div");
  host.className = "separate-preview";
  popup.document.body.appendChild(host);

  const frame = popup.document.createElement("iframe");
  frame.id = "preview-iframe";
  frame.title = "Typst Preview";
  frame.src = "/typst-preview";
  host.appendChild(frame);
  separateFrame = frame;
  // The frame has no document yet, so the theme is applied once it has one.
  frame.addEventListener("load", () => applySeparateTheme(get(theme)));

  // The frame's bridge posts to its parent, which is the popup, not us.
  popup.addEventListener("message", handleIframeMessage);
  popup.addEventListener("beforeunload", closeSeparatePreview);

  separateThemeUnsubscribe = theme.subscribe((value) => applySeparateTheme(value));

  // The split view's frame is unmounted the moment the store flips, so the
  // bridge has to forget it and wait for the popup's frame to introduce itself.
  resetIframeBridge();
  requestZoomReapplyOnNextInit();
  separatePreviewOpen.set(true);
  separatePreviewHost.set(host);
  // The popup's frame connects with a fresh document, asks for 'current', and
  // that request is what pulls a full artifact over — no push needed here.
}

function applySeparateTheme(value: string) {
  if (!separateWindow || separateWindow.closed) return;
  separateWindow.document.documentElement.setAttribute("data-theme", value);
  separateFrame?.contentDocument?.documentElement.setAttribute("data-theme", value);
}

/**
 * Drop the popup and everything pointed at it.
 *
 * `flushToolbar` forces the toolbar mounted into the popup down before that
 * document goes, rather than on the next scheduled flush. The teardown path
 * passes `false`: it runs inside an effect, where `flushSync()` is forbidden,
 * and there the tree holding the toolbar is being destroyed anyway.
 */
function releaseSeparatePreview(flushToolbar: boolean) {
  separateThemeUnsubscribe?.();
  separateThemeUnsubscribe = null;
  const popup = separateWindow;
  separateWindow = null;
  separateFrame = null;
  separatePreviewOpen.set(false);
  separatePreviewHost.set(null);
  if (flushToolbar) flushSync();
  if (popup && !popup.closed) {
    popup.removeEventListener("message", handleIframeMessage);
    popup.removeEventListener("beforeunload", closeSeparatePreview);
    popup.close();
  }
}

/** Close the popup without asking the (about to be terminated) worker for a
 * fresh artifact. */
function closeSeparatePreviewOnTeardown() {
  releaseSeparatePreview(false);
}

export function closeSeparatePreview() {
  if (!separateWindow) return;
  releaseSeparatePreview(true);

  // The split view mounts a brand-new frame, which introduces itself with a
  // 'current' request; that request is what pulls a full artifact over.
  resetIframeBridge();
  // That frame also starts at its own default zoom, so the reader's zoom has to
  // be pushed back once it is ready to take it.
  requestZoomReapplyOnNextInit();
}

/**
 * The popup's frame, for `activePreviewWindow()`. Returns `null` whenever the
 * preview is not popped out, which is the common case.
 */
export function separatePreviewTarget(): Window | null {
  if (separateWindow && !separateWindow.closed && separateFrame?.contentWindow) {
    return separateFrame.contentWindow;
  }
  return null;
}

export { closeSeparatePreviewOnTeardown };
