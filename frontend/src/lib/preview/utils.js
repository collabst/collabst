// Utility to sync theme from parent window to preview iframe
const updateThemeFromParent = () => {
  const theme = window.parent.document.documentElement.getAttribute("data-theme") || 'light';
  document.documentElement.setAttribute("data-theme", theme);
};

// Listen for theme change messages from parent window
window.addEventListener("message", (event) => {
  const { type } = event.data || {};
  if (type === "typst-update-theme") {
    updateThemeFromParent();
  }
});
