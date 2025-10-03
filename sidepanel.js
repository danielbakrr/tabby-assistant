// sidepanel.js

const selectionTextEl = document.getElementById('selectionText');
const aiResponseEl = document.getElementById('aiResponse');
const statusEl = document.getElementById('status');
const saveBtn = document.getElementById('saveBtn');
const summarizeBtn = document.getElementById('summarizeBtn');
const rollbackBtn = document.getElementById('rollbackBtn');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');

let currentSelection = '';
let lastPromptEntry = null; // {input, result, time}
let session = null; // LanguageModel session

// Utility: append to local history (storage.local)
async function addToHistory(entry) {
  const data = await chrome.storage.local.get({ aiHistory: [] });
  const aiHistory = data.aiHistory;
  aiHistory.unshift(entry);
  await chrome.storage.local.set({ aiHistory: aiHistory.slice(0, 200) }); // cap
}

// load history UI
async function loadHistoryUI() {
  const data = await chrome.storage.local.get({ aiHistory: [] });
  historyList.innerHTML = '';
  data.aiHistory.forEach((h, idx) => {
    const li = document.createElement('li');
    const time = new Date(h.time).toLocaleString();
    li.innerHTML = `<strong>${time}</strong><div class="hist-input">${escapeHtml(h.input)}</div><div class="hist-output">${escapeHtml(h.output)}</div><button data-idx="${idx}" class="restore">Restore</button>`;
    historyList.appendChild(li);
  });
}

// escape
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

// Receive messages forwarded from background/content
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SELECTION_FOR_PANEL') {
    onNewSelection(msg.text);
  }
});

// Called when a new selection arrives
async function onNewSelection(text) {
  currentSelection = text;
  selectionTextEl.textContent = text;
  aiResponseEl.textContent = '';
  saveBtn.disabled = true;
  summarizeBtn.disabled = true;

  statusEl.textContent = 'Checking model availability...';

  try {
    await ensureSession(); // create session or wait if needed
    statusEl.textContent = 'Asking AI...';
    // Build a helpful system prompt — you can adjust
    const prompt = `Explain the highlighted text simply and concisely. If it's long, provide a short summary, then 2-3 bullets for key points. Text:\n\n${text}`;

    // Use session.prompt() for non-streamed (short) results
    const result = await session.prompt(prompt);

    // result is a string (Prompt API returns text)
    aiResponseEl.textContent = result;
    statusEl.textContent = 'Done';
    saveBtn.disabled = false;
    summarizeBtn.disabled = false;

    lastPromptEntry = { input: text, prompt, output: result, time: Date.now() };
    await addToHistory(lastPromptEntry);
  } catch (err) {
    console.error('Prompt error', err);
    aiResponseEl.textContent = 'AI error: ' + (err && err.message ? err.message : String(err));
    statusEl.textContent = 'Error';
  }
}

// Ensures LanguageModel session exists and model is available.
// Follows guidance: check availability() then create() — model may need to download.
// See docs for availability / create lifecycle. :contentReference[oaicite:4]{index=4}
async function ensureSession() {
  if (session) return;
  if (!window.LanguageModel) {
    throw new Error('LanguageModel API not available in this context. Make sure you run this in a top-level extension page and Chrome supports the Prompt API.');
  }

  const avail = await LanguageModel.availability();
  if (avail === 'unavailable') {
    throw new Error('On-device language model unavailable on this device/profile.');
  }

  // If it's downloadable, the user must interact (click) to allow model download.
  if (avail === 'downloadable') {
    // Inform the user and request a click
    const proceed = confirm('The on-device model must be downloaded to use the AI. Click OK to start the download (this is required once).');
    if (!proceed) throw new Error('User cancelled model download.');
  }

  // Create a session; you can customize expectedOutputs / inputs
  session = await LanguageModel.create({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }]
  });

  // Optional: pre-populate with initial system prompt to make behaviour consistent
  await session.append([
    { role: 'system', content: 'You are a helpful assistant that explains highlighted text clearly and concisely.' }
  ]);
}

// Buttons
saveBtn.addEventListener('click', async () => {
  if (!lastPromptEntry) return;
  // we already stored it in history upon receiving response; but enable extra metadata
  const savedKey = `saved_${Date.now()}`;
  await chrome.storage.local.set({ [savedKey]: lastPromptEntry });
  alert('Saved to storage.');
});

summarizeBtn.addEventListener('click', async () => {
  if (!currentSelection) return;
  // Summarize: we can call the model again with a summarization prompt
  statusEl.textContent = 'Summarizing...';
  try {
    const prompt = `Create a 2-sentence summary for the following text:\n\n${currentSelection}`;
    const summary = await session.prompt(prompt);
    // show summary and push to history
    aiResponseEl.textContent = summary;
    lastPromptEntry = { input: currentSelection, prompt, output: summary, time: Date.now(), type: 'summary' };
    await addToHistory(lastPromptEntry);
    statusEl.textContent = 'Summary complete';
  } catch (err) {
    aiResponseEl.textContent = 'Summarize error: ' + (err && err.message ? err.message : String(err));
    statusEl.textContent = 'Error';
  }
});

rollbackBtn.addEventListener('click', () => {
  historyPanel.hidden = !historyPanel.hidden;
  if (!historyPanel.hidden) loadHistoryUI();
});

// Restore from history list (event delegation)
historyList.addEventListener('click', (e) => {
  if (e.target && e.target.matches('.restore')) {
    const li = e.target.closest('li');
    const idx = Number(e.target.dataset.idx);
    chrome.storage.local.get({ aiHistory: [] }).then(data => {
      const h = data.aiHistory[idx];
      if (h) {
        selectionTextEl.textContent = h.input;
        aiResponseEl.textContent = h.output;
      }
    });
  }
});
