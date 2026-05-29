import previewHtml from "$lib/preview/index.html?raw";
import previewCss from "$lib/preview/preview.css?raw";
import setupScript from "$lib/preview/setup.js?raw";
import themeCss from "$lib/styles/theme.css?raw";
import utilsScript from "$lib/preview/utils.js?raw";
import websocketMockScript from "$lib/preview/websocket-mock.js?raw";
import zoomBridgeScript from "$lib/preview/zoom-bridge.js?raw";

export const prerender = true;

/**
 * This endpoint serves the prerendered typst preview HTML with the local bridge scripts
 * injected into the document head at build time.
 */
export async function GET() {
  const injectedScripts = [
    `<script id="websocket-mock">${websocketMockScript}</script>`,
    `<script id="zoom-bridge">${zoomBridgeScript}</script>`,
    `<script id="setup">${setupScript}</script>`,
    `<script id="utils">${utilsScript}</script>`,
    `<style id="preview-css">${previewCss}</style>`,
    `<style id="theme-css">${themeCss}</style>`,
  ].join("\n");

  const headMatch = previewHtml.match(/<head[^>]*>/i);
  const html = headMatch
    ? previewHtml.replace(headMatch[0], `${headMatch[0]}\n${injectedScripts}`)
    : `${injectedScripts}\n${previewHtml}`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
