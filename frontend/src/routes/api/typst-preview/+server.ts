import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * This endpoint proxies the typst-preview-frontend HTML and injects the WebSocket mock script.
 * This allows the parent to communicate with the iframe via postMessage since the mock
 * intercepts WebSocket connections and bridges them.
 *
 * The mock script is injected at the very beginning of the <head> to ensure it runs
 * before any other scripts that might create WebSocket connections.
 */
export async function GET({ fetch, url }) {
  // Local file path: use bundled dist to avoid external references
  const thisFile = fileURLToPath(import.meta.url);
  const repoHtmlPath = path.resolve(
    path.dirname(thisFile),
    "../../../lib/typst-preview-frontend/dist/index.html"
  );
  let html = await readFile(repoHtmlPath, "utf-8");

  // Load the WebSocket mock script
  const repoMockPath = path.resolve(
    path.dirname(thisFile),
    "../../../lib/preview/websocket-mock.js"
  );
  const websocketMockScript = await readFile(repoMockPath, "utf-8");

  // Load the zoom bridge script to sync zoom between iframe and parent
  const repoZoomBridgePath = path.resolve(
    path.dirname(thisFile),
    "../../../lib/preview/zoom-bridge.js"
  );
  const zoomBridgeScript = await readFile(repoZoomBridgePath, "utf-8");

  // Load the render mode bridge script
  const repoRenderModeBridgePath = path.resolve(
    path.dirname(thisFile),
    "../../../lib/preview/render-mode-bridge.js"
  );
  const renderModeBridgeScript = await readFile(
    repoRenderModeBridgePath,
    "utf-8"
  );

  // Inject helper scripts at the beginning of <head>
  const injectedScripts = [
    `<script id="websocket-mock">${websocketMockScript}</script>`,
    `<script id="zoom-bridge">${zoomBridgeScript}</script>`,
    `<script id="render-mode-bridge">${renderModeBridgeScript}</script>`,
  ].join("\n");

  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    const headTag = headMatch[0];
    const headIndex = html.indexOf(headTag) + headTag.length;
    html =
      html.slice(0, headIndex) +
      "\n" +
      injectedScripts +
      "\n" +
      html.slice(headIndex);
  } else {
    html = injectedScripts + "\n" + html;
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
