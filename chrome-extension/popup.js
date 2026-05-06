const statusText = document.getElementById('status-text');
const lastSyncText = document.getElementById('last-sync-text');
const backendUrlEl = document.getElementById('backend-url');
const apiKeyMaskEl = document.getElementById('api-key-mask');
const syncButton = document.getElementById('sync-button');
const openOptionsLink = document.getElementById('open-options');

function maskApiKey(key) {
  if (!key) return 'Not configured';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function formatDateTime(value) {
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
}

function loadStatus() {
  chrome.storage.local.get(
    {
      lastSyncAt: null,
      lastSyncStatus: 'unknown',
      lastSyncMessage: 'No sync attempt yet',
      lastSyncCount: 0,
    },
    (result) => {
      statusText.textContent = result.lastSyncStatus === 'success'
        ? `Last sync succeeded (${result.lastSyncCount} tabs)`
        : result.lastSyncStatus === 'error'
          ? `Last sync failed: ${result.lastSyncMessage}`
          : result.lastSyncMessage;

      lastSyncText.textContent = result.lastSyncAt
        ? `Last sync: ${formatDateTime(result.lastSyncAt)}`
        : 'No sync completed yet';
    }
  );
}

function loadConfig() {
  chrome.storage.sync.get(
    {
      apiBase: 'http://localhost:5001/api/tab',
      apiKey: '',
    },
    (result) => {
      backendUrlEl.textContent = result.apiBase;
      apiKeyMaskEl.textContent = maskApiKey(result.apiKey);
    }
  );
}

syncButton.addEventListener('click', () => {
  statusText.textContent = 'Syncing tabs…';
  chrome.runtime.sendMessage({ type: 'sync_tabs' }, (response) => {
    if (response?.success) {
      statusText.textContent = 'Sync request sent';
    } else {
      statusText.textContent = `Sync failed: ${response?.error || 'unknown error'}`;
    }
    loadStatus();
  });
});

openOptionsLink.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

loadStatus();
loadConfig();
