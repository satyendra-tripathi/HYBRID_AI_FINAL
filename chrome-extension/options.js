const apiBaseInput = document.getElementById('apiBase');
const apiKeyInput = document.getElementById('apiKey');
const saveButton = document.getElementById('saveButton');

function loadSettings() {
  chrome.storage.sync.get(
    {
      apiBase: 'http://localhost:5000/api/tab',
      apiKey: '',
    },
    (result) => {
      apiBaseInput.value = result.apiBase || 'http://localhost:5000/api/tab';
      apiKeyInput.value = result.apiKey || '';
    }
  );
}

function saveSettings() {
  const apiBase = apiBaseInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  chrome.storage.sync.set({ apiBase, apiKey }, () => {
    saveButton.textContent = 'Saved';
    setTimeout(() => {
      saveButton.textContent = 'Save settings';
    }, 1400);
  });
}

saveButton.addEventListener('click', saveSettings);
loadSettings();
