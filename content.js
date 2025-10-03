// content.js
let lastSelection = '';
let debounceTimer = null;

// send selection text to background when user finishes selecting
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : '';
  if (!text || text === lastSelection) return;
  lastSelection = text;

  // debounce small rapid changes
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    window.chrome.runtime.sendMessage({ type: 'SELECTION', text });
  }, 250); // 250ms debounce
});
