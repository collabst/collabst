// Utility to sync theme from parent window to preview iframe
const updateThemeFromParent = () => {
  const theme = window.parent.document.documentElement.getAttribute("data-theme") || 'light';
  document.documentElement.setAttribute("data-theme", theme);
};


// Utility to sync negative colors setting from local storage
const updateNegativePreviewFromStorage = () => {
  const negative = localStorage.getItem('editor.negativePreview') === 'true';
  const typstApp = document.querySelector('#typst-app');
  if (typstApp) {
    if (negative) {
      typstApp.classList.add('negative');
    } else {
      typstApp.classList.remove('negative');
    }
  }
}