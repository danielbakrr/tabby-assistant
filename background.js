// background.js
chrome.runtime.onInstalled.addListener(() => {
  // open the panel on action click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((e) => console.warn('sidePanel.setPanelBehavior failed', e));
  }
});

// Relay selection messages from content scripts to the side panel (if open)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'SELECTION') {
    // forward to clients so sidepanel.html can receive it
    // send a message to all extension views (side panel)
    chrome.runtime.sendMessage({ type: 'SELECTION_FOR_PANEL', text: msg.text, tabId: sender.tab?.id });
    // Optionally open the side panel automatically:
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open().catch(() => {});
    }
  }
});
