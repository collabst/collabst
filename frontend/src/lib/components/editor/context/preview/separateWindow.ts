import { notifications } from "$lib/stores/notifications";
import { theme } from "$lib/stores/theme";
import { project, separatePreviewOpen } from "../state";
import { handleIframeMessage, reapplyCurrentZoomMode } from "./iframe";
import { resetWorkerDocument, syncFilesAndAssets } from "./worker";
import { get } from "svelte/store";

// --- Separate preview window ---------------------------------------------
//
// The popup is a bare same-origin document holding one `<iframe src="/typst-preview">`
// — the very page the preview panel embeds. That keeps a single renderer
// implementation: the artifact stream and the zoom commands are simply pointed
// at the popup's frame instead of the panel's, and the bridge scripts inside
// the frame still talk to `window.parent`, which is now the popup. The main
// window listens on the popup for those messages, so `handleIframeMessage`
// serves both surfaces unchanged.
let separateWindow: Window | null = null;
let separateFrame: HTMLIFrameElement | null = null;
let separateThemeUnsubscribe: (() => void) | null = null;

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
  popup.document.body.style.margin = "0";

  const frame = popup.document.createElement("iframe");
  frame.id = "preview-iframe";
  frame.src = "/typst-preview";
  frame.style.cssText = "display:block;border:none;width:100vw;height:100vh;";
  popup.document.body.appendChild(frame);
  separateFrame = frame;
  // The frame has no document yet, so the theme is applied once it has one.
  frame.addEventListener("load", () => applySeparateTheme(get(theme)));

  // The frame's bridge posts to its parent, which is the popup, not us.
  popup.addEventListener("message", handleIframeMessage);
  popup.addEventListener("beforeunload", closeSeparatePreview);

  separateThemeUnsubscribe = theme.subscribe((value) => applySeparateTheme(value));

  separatePreviewOpen.set(true);
  // The popup's frame connects with a fresh document, asks for 'current', and
  // that request is what pulls a full artifact over — no push needed here.
}

function applySeparateTheme(value: string) {
  if (!separateWindow || separateWindow.closed) return;
  separateWindow.document.documentElement.setAttribute("data-theme", value);
  separateFrame?.contentDocument?.documentElement.setAttribute("data-theme", value);
}

/** Close the popup without asking the (about to be terminated) worker for a
 * fresh artifact. */
function closeSeparatePreviewOnTeardown() {
  separateThemeUnsubscribe?.();
  separateThemeUnsubscribe = null;
  const popup = separateWindow;
  separateWindow = null;
  separateFrame = null;
  separatePreviewOpen.set(false);
  if (popup && !popup.closed) {
    popup.removeEventListener("message", handleIframeMessage);
    popup.close();
  }
}

export function closeSeparatePreview() {
  if (!separateWindow) return;
  closeSeparatePreviewOnTeardown();

  // The panel's own frame has been idle meanwhile, so it needs a full artifact
  // rather than a diff against a document it never received.
  resetWorkerDocument();
  syncFilesAndAssets();
  reapplyCurrentZoomMode();
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
