let lastSelection = '';
let debounceTimer = null;

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : '';
  if (!text || text === lastSelection) return;
  lastSelection = text;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'SELECTION', text });
      } catch (err) {
        console.warn('Cannot send message, context invalidated', err);
      }
    }
  }, 250);
});
