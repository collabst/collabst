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

  // Format message as the typst preview expects: "messageType,binaryData"
  const messageType = isFirstCompile ? 'new' : 'diff-v1';
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(messageType + ',');

  // Combine type and data
  const combined = new Uint8Array(typeBytes.length + vectorData.byteLength);
  combined.set(typeBytes, 0);
  combined.set(new Uint8Array(vectorData), typeBytes.length);

  // Send via postMessage to iframe
  // Note: We copy the buffer to avoid transferring ownership which would detach the original
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
        // First time receiving 'current' - iframe mock is ready
        iframeMockReady = true;
        initialized = true;
      }
      // The preview resets its document every time its socket opens, so a
      // 'current' after we have already compiled means the next artifact it
      // gets must be a full one, not a diff.
      resetWorkerDocument();
      // Iframe is requesting current state - trigger a recompile
      syncFilesAndAssets();
    }
  }
}

export function handleIframeMessage(event: MessageEvent) {
  // Security: verify origin in production
  const { type, data, command, zoom, mode } = event.data || {};

  switch (type) {
    case 'typst-ws-mock-ready':
      // Iframe mock WebSocket is ready to receive connections - can be usefull ¯\_(ツ)_/¯
      break;

    case 'typst-ws-connect':
      // Iframe mock WebSocket is now connected - can be usefull too ¯\_(ツ)_/¯
      break;

    case 'typst-ws-send':
      handleIframeSend(data);
      break;

    case 'typst-ws-close':
      // Iframe mock WebSocket closed - can be usefull also ¯\_(ツ)_/¯
      break;

    case 'typst-zoom-changed':
      if (inhibNextZoomChange) {
        // Ignore this change - it was a backlash of our own command
        inhibNextZoomChange = false;
        return;
      }
      if (typeof zoom === 'number') {
        currentZoomValue.update(() => zoom);
        currentZoomMode.update(() => mode ?? 'custom');
      }
      break;

    case 'typst-request-current':
      // Iframe is requesting current state - trigger a recompile
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
 * Forget everything about the frame that is going away. The next project mounts
 * a fresh iframe with an empty document; leaving these set made us treat it as
 * ready for diffs before it had asked for anything, so it never received a full
 * artifact.
 */
export function resetIframeBridge() {
  iframeMockReady = false;
  initialized = false;
  isPreviewZoomInitialized = false;
}

export { sendVectorDataToIframe };
