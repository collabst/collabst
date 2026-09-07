import { currentZoomMode, currentZoomValue, previewIframe } from "../state";
import { separatePreviewTarget } from "./separateWindow";
import { resetWorkerDocument, syncFilesAndAssets } from "./worker";
import { get } from "svelte/store";

/**
 * The bridge to whichever surface is currently showing the preview.
 *
 * The preview is a `/typst-preview` page whose mock WebSocket talks to
 * `window.parent` by `postMessage`. That page is embedded twice — in the
 * preview panel and, when the reader pops it out, in the separate window — so
 * everything here is written against `activePreviewWindow()` rather than
 * against one specific frame.
 */

// Whether the frame's mock socket has announced itself, and whether it has
// asked for a document. Until it has, an artifact sent to it is not merely
// dropped: every later diff rebases onto a document it never received.
let iframeMockReady = false;
let isPreviewZoomInitialized = false;
let initialized = false;

/** The window the artifact stream and the zoom commands are aimed at. */
function activePreviewWindow(): Window | null {
  return separatePreviewTarget() ?? get(previewIframe)?.contentWindow ?? null;
}

function sendVectorDataToIframe(vectorData: ArrayBuffer, isFirstCompile: boolean) {
  const target = activePreviewWindow();
  if (!target || !iframeMockReady) {
    return;
  }

  // The preview expects "messageType,binaryData".
  const messageType = isFirstCompile ? 'new' : 'diff-v1';
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(messageType + ',');

  const combined = new Uint8Array(typeBytes.length + vectorData.byteLength);
  combined.set(typeBytes, 0);
  combined.set(new Uint8Array(vectorData), typeBytes.length);

  // Copied, not transferred: transferring would detach the original buffer.
  target.postMessage({
    type: 'typst-ws-message',
    data: combined.buffer.slice(0)
  }, '*');
}

let inhibNextZoomChange = false;

export function sendCommandToIframe(command: string, payload?: any) {
  activePreviewWindow()?.postMessage({
    type: 'typst-command',
    command,
    payload
  }, '*');
}

export function zoomIn() {
  sendCommandToIframe('zoom-in');
}

export function zoomOut() {
  sendCommandToIframe('zoom-out');
}


export function setZoom(zoom: number) {
  currentZoomValue.update(() => zoom);
  currentZoomMode.update(() => 'custom');
  sendCommandToIframe('set-zoom', { zoom, mode: 'custom' });
}

export function fitToWidth() {
  currentZoomMode.update(() => 'fit-width');
  inhibNextZoomChange = true;
  sendCommandToIframe('fit-width');
}

export function fitToHeight() {
  currentZoomMode.update(() => 'fit-height');
  inhibNextZoomChange = true;
  sendCommandToIframe('fit-height');
}

export function fitToPage() {
  currentZoomMode.update(() => 'fit-page');
  inhibNextZoomChange = true;
  sendCommandToIframe('fit-page');
}

export function reapplyCurrentZoomMode() {
  const $currentZoomMode = get(currentZoomMode);
  switch ($currentZoomMode) {
    case 'fit-width':
      fitToWidth();
      break;
    case 'fit-height':
      fitToHeight();
      break;
    case 'fit-page':
      fitToPage();
      break;
    case 'custom':
      const $currentZoomValue = get(currentZoomValue);
      setZoom($currentZoomValue);
      break;
  }
}

function handleIframeSend(data: string | ArrayBuffer) {
  if (typeof data === 'string') {
    if (data === 'current') {
      if (!iframeMockReady) {
        iframeMockReady = true;
        initialized = true;
      }
      // The preview resets its document every time its socket opens, so a
      // 'current' after we have already compiled means the next artifact it
      // gets must be a full one, not a diff.
      resetWorkerDocument();
      syncFilesAndAssets();
    }
  }
}

export function handleIframeMessage(event: MessageEvent) {
  const { type, data, command, zoom, mode } = event.data || {};

  switch (type) {
    case 'typst-ws-mock-ready':
    case 'typst-ws-connect':
      break;

    case 'typst-ws-send':
      handleIframeSend(data);
      break;

    case 'typst-ws-close':
      break;

    case 'typst-zoom-changed':
      if (inhibNextZoomChange) {
        // Echo of our own command.
        inhibNextZoomChange = false;
        return;
      }
      if (typeof zoom === 'number') {
        currentZoomValue.update(() => zoom);
        currentZoomMode.update(() => mode ?? 'custom');
      }
      break;

    case 'typst-request-current':
      resetWorkerDocument();
      syncFilesAndAssets();
      break;

    case 'typst-zoom-initialized':
      isPreviewZoomInitialized = true;
      break;
  }
}

// --- Accessors ---------------------------------------------------------------

/**
 * Whether the preview frame has asked for a document yet. `compile()` holds
 * back until it has; see the comment there.
 */
export function isIframeInitialized(): boolean {
  return initialized;
}

/**
 * Forget the frame that is going away: the next project mounts a fresh iframe
 * with an empty document, which must not be treated as ready for diffs.
 */
export function resetIframeBridge() {
  iframeMockReady = false;
  initialized = false;
  isPreviewZoomInitialized = false;
}

export { sendVectorDataToIframe };
