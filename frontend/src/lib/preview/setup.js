// Sets up all necessary bridges between the Typst preview and the host application.
const setupBridge = () => {
  const doc = document.getElementById('typst-container')?.documents?.[0];
  if (doc) {
    doc.setPartialRendering(true)
    setupZoomHook();
    updateThemeFromParent();
    updateNegativePreviewFromStorage();
  } else {
    // Retry if document not ready yet
    setTimeout(setupBridge, 100);
  }
};

// Initialize the bridge when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  setupBridge();
});
