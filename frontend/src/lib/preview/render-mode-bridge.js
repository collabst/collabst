/** @typedef {"typst-set-render-mode"} RenderModeCommand */

/**
 * Switches the render mode of a Typst document.
 *
 * The document structure is:
 * - doc.impl: The internal TypstDocumentContext instance
 * - doc.impl.modes: Array of [modeName, facade] tuples (e.g., ["svg", svgFacade], ["canvas", canvasFacade])
 * - doc.impl.r: The active render facade with rescale, rerender, postRender methods
 * - doc.impl.renderMode: The current mode name string
 * - doc.impl.hookedElem: The DOM element where rendering happens
 * - doc.impl.addViewportChange(): Triggers a re-render
 * 
 * @param {RenderModeCommand} targetMode - The mode to switch to ("svg" or "canvas")
 * @returns {boolean} - Whether the switch was successful
 */
const switchRenderMode = (targetMode) => {
  const doc = document.getElementById('typst-container')?.documents?.[0];

  if (!doc) {
    console.warn("[RenderModeBridge] No document found.");
    return false;
  }

  // Access the internal implementation
  const impl = doc.impl;
  if (!impl) {
    console.warn("[RenderModeBridge] No impl found on document.");
    return false;
  }

  // Check if already in the target mode
  if (impl.renderMode === targetMode) {
    return true;
  }

  // Find the target mode facade in the modes array
  // modes is an array of [modeName, facade] tuples
  const modeTuple = impl.modes.find(([name]) => name === targetMode);
  if (!modeTuple) {
    console.warn(`[RenderModeBridge] Mode "${targetMode}" not found in registered modes:`, impl.modes.map(([n]) => n));
    return false;
  }

  const [, targetFacade] = modeTuple;
  console.log(`[RenderModeBridge] Switching from "${impl.renderMode}" to "${targetMode}"`);

  // Clear the current render output
  if (impl.hookedElem) {
    impl.hookedElem.innerHTML = "";
  }

  // Update the render mode and active facade
  impl.renderMode = targetMode;
  impl.r = targetFacade;

  // Trigger a fresh render via viewport change
  impl.addViewportChange();

  return true;
};

const handleCommandRenderMode = (
  /** @type {RenderModeCommand} */ command,
  /** @type {any} */ payload
) => {
  switch (command) {
    case "typst-set-render-mode": {
      const mode = payload.mode;
      switchRenderMode(mode);
      return;
    }
    default:
      return;
  }
};

window.addEventListener("message", (event) => {
  const { type, command, payload } = event.data || {};
  if (type === "typst-command" && command) {
    handleCommandRenderMode(command, payload);
  }
});
