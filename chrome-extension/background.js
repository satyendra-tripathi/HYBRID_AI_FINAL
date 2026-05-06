// chrome-extension/background.js

const DEFAULT_API_BASE = "http://localhost:5000/api/tab";
const DEFAULT_SYNC_INTERVAL_MINUTES = 1;

let pendingSync = null;

function formatTab(tab) {
  if (!tab?.url || !tab.url.startsWith("http")) return null;
  try {
    const url = new URL(tab.url);
    return {
      domain: url.hostname,
      title: tab.title || url.hostname,
      url: tab.url,
      tabId: tab.id,
      windowId: tab.windowId,
      active: Boolean(tab.active),
      lastSeenAt: new Date().toISOString(),
    };
  } catch (e) {
    return null;
  }
}

function getStoredConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        apiBase: DEFAULT_API_BASE,
        apiKey: "",
      },
      (result) => {
        resolve({
          apiBase: result.apiBase || DEFAULT_API_BASE,
          apiKey: result.apiKey || "",
        });
      }
    );
  });
}

async function saveSyncStatus(status, message, count = 0) {
  chrome.storage.local.set({
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: status,
    lastSyncMessage: message,
    lastSyncCount: count,
  });
}

async function requestHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

async function sendTab(tab, apiBase, apiKey) {
  const payload = formatTab(tab);
  if (!payload) return;

  try {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: await requestHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log("✅ Tab synced:", payload.domain);
    } else {
      console.error("❌ Tab sync failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("❌ Tab sync error:", err);
  }
}

async function syncAllTabs() {
  const { apiBase, apiKey } = await getStoredConfig();

  try {
    const tabs = await chrome.tabs.query({});
    const formattedTabs = tabs.map(formatTab).filter(Boolean);

    if (formattedTabs.length === 0) {
      await saveSyncStatus("success", "No syncable tabs found", 0);
      return;
    }

    const response = await fetch(`${apiBase}/batch`, {
      method: "POST",
      headers: await requestHeaders(apiKey),
      body: JSON.stringify({ tabs: formattedTabs }),
    });

    if (response.ok) {
      console.log(`✅ Batch synced ${formattedTabs.length} tabs`);
      await saveSyncStatus("success", `Batch synced ${formattedTabs.length} tabs`, formattedTabs.length);
    } else {
      const text = await response.text();
      console.error("❌ Batch sync failed:", response.status, text);
      await saveSyncStatus("error", `Batch sync failed: ${response.status}`, formattedTabs.length);
    }
  } catch (err) {
    console.error("❌ syncAllTabs error:", err);
    await saveSyncStatus("error", err.message || "Unknown error", 0);
  }
}

function scheduleSync(delay = 500) {
  if (pendingSync) {
    clearTimeout(pendingSync);
  }
  pendingSync = setTimeout(() => {
    pendingSync = null;
    syncAllTabs();
  }, delay);
}

chrome.runtime.onInstalled.addListener(async () => {
  console.log("🚀 Extension Installed");
  await syncAllTabs();
  chrome.alarms.create("sync_tabs", { periodInMinutes: DEFAULT_SYNC_INTERVAL_MINUTES });
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("💻 Browser Startup");
  await syncAllTabs();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync_tabs") {
    syncAllTabs();
  }
});

chrome.tabs.onCreated.addListener(() => {
  scheduleSync();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete" || changeInfo.title) {
    scheduleSync();
  }
});

chrome.tabs.onActivated.addListener(() => {
  console.log("🔄 Tab activated - scheduling full sync");
  scheduleSync();
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    scheduleSync();
  }
});

chrome.tabs.onRemoved.addListener(() => {
  scheduleSync();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "sync_tabs") {
    syncAllTabs()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error?.message }));
    return true;
  }
});

syncAllTabs();