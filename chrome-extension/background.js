// chrome-extension/background.js

const DEFAULT_API_BASE = "http://localhost:5001/api/tab";
const DEFAULT_SYNC_INTERVAL_MINUTES = 1;

let pendingSync = null;

// -----------------------------
// FORMAT TAB DATA
// -----------------------------
function formatTab(tab) {

  // Ignore invalid/internal tabs
  if (
    !tab?.url ||
    !tab.url.startsWith("http") ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("edge://") ||
    tab.url.startsWith("chrome-extension://")
  ) {
    return null;
  }

  try {

    const url = new URL(tab.url);

    return {
      domain: url.hostname,
      title: tab.title || url.hostname,
      url: tab.url,

      // IMPORTANT
      detection_source: "EXTENSION",

      browser: "Chrome",

      tabId: tab.id,
      windowId: tab.windowId,

      active: Boolean(tab.active),

      timestamp: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

  } catch (e) {

    console.error("❌ formatTab error:", e);

    return null;
  }
}

// -----------------------------
// GET CONFIG
// -----------------------------
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

// -----------------------------
// SAVE STATUS
// -----------------------------
async function saveSyncStatus(status, message, count = 0) {

  chrome.storage.local.set({
    lastSyncAt: new Date().toISOString(),
    lastSyncStatus: status,
    lastSyncMessage: message,
    lastSyncCount: count,
  });

}

// -----------------------------
// REQUEST HEADERS
// -----------------------------
async function requestHeaders(apiKey) {

  const headers = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

// -----------------------------
// SEND SINGLE TAB
// -----------------------------
async function sendTab(tab, apiBase, apiKey) {

  const payload = formatTab(tab);

  if (!payload) return;

  try {

    console.log("📤 Sending Tab:", payload);

    const res = await fetch(apiBase, {
      method: "POST",
      headers: await requestHeaders(apiKey),
      body: JSON.stringify(payload),
    });

    if (res.ok) {

      console.log("✅ Tab synced:", payload.domain);

    } else {

      console.error(
        "❌ Tab sync failed:",
        res.status,
        await res.text()
      );

    }

  } catch (err) {

    console.error("❌ Tab sync error:", err);

  }
}

// -----------------------------
// SYNC ALL TABS
// -----------------------------
async function syncAllTabs() {

  const { apiBase, apiKey } = await getStoredConfig();

  try {

    const tabs = await chrome.tabs.query({});

    console.log("🟢 Total Chrome Tabs:", tabs.length);

    const formattedTabs = tabs
      .map(formatTab)
      .filter(Boolean);

    console.log("🟢 Valid Tabs:", formattedTabs);

    if (formattedTabs.length === 0) {

      await saveSyncStatus(
        "success",
        "No syncable tabs found",
        0
      );

      return;
    }

    // -----------------------------
    // BATCH SEND
    // -----------------------------
    const response = await fetch(`${apiBase}/batch`, {
      method: "POST",
      headers: await requestHeaders(apiKey),

      body: JSON.stringify({
        tabs: formattedTabs,
      }),
    });

    if (response.ok) {

      console.log(
        `✅ Batch synced ${formattedTabs.length} tabs`
      );

      await saveSyncStatus(
        "success",
        `Batch synced ${formattedTabs.length} tabs`,
        formattedTabs.length
      );

    } else {

      const text = await response.text();

      console.error(
        "❌ Batch sync failed:",
        response.status,
        text
      );

      await saveSyncStatus(
        "error",
        `Batch sync failed: ${response.status}`,
        formattedTabs.length
      );

    }

  } catch (err) {

    console.error("❌ syncAllTabs error:", err);

    await saveSyncStatus(
      "error",
      err.message || "Unknown error",
      0
    );

  }
}

// -----------------------------
// DEBOUNCE SYNC
// -----------------------------
function scheduleSync(delay = 1000) {

  if (pendingSync) {
    clearTimeout(pendingSync);
  }

  pendingSync = setTimeout(() => {

    pendingSync = null;

    syncAllTabs();

  }, delay);

}

// -----------------------------
// EXTENSION INSTALLED
// -----------------------------
chrome.runtime.onInstalled.addListener(async () => {

  console.log("🚀 Extension Installed");

  await syncAllTabs();

  chrome.alarms.create("sync_tabs", {
    periodInMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
  });

});

// -----------------------------
// BROWSER STARTUP
// -----------------------------
chrome.runtime.onStartup.addListener(async () => {

  console.log("💻 Browser Startup");

  await syncAllTabs();

});

// -----------------------------
// PERIODIC SYNC
// -----------------------------
chrome.alarms.onAlarm.addListener((alarm) => {

  if (alarm.name === "sync_tabs") {

    console.log("⏰ Alarm Sync");

    syncAllTabs();

  }

});

// -----------------------------
// NEW TAB CREATED
// -----------------------------
chrome.tabs.onCreated.addListener((tab) => {

  console.log("🆕 New Tab:", tab.url);

  scheduleSync();

});

// -----------------------------
// TAB UPDATED
// -----------------------------
chrome.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => {

    if (
      changeInfo.url ||
      changeInfo.status === "complete" ||
      changeInfo.title
    ) {

      console.log("🔄 Tab Updated:", tab.url);

      scheduleSync();

    }

  }
);

// -----------------------------
// TAB ACTIVATED
// -----------------------------
chrome.tabs.onActivated.addListener(
  async (activeInfo) => {

    try {

      const tab = await chrome.tabs.get(activeInfo.tabId);

      console.log("🟢 Active Tab:", tab.url);

      scheduleSync();

    } catch (err) {

      console.error("❌ onActivated error:", err);

    }

  }
);

// -----------------------------
// WINDOW FOCUS CHANGED
// -----------------------------
chrome.windows.onFocusChanged.addListener(
  (windowId) => {

    if (
      windowId !== chrome.windows.WINDOW_ID_NONE
    ) {

      console.log("🪟 Window Focus Changed");

      scheduleSync();

    }

  }
);

// -----------------------------
// TAB REMOVED
// -----------------------------
chrome.tabs.onRemoved.addListener((tabId) => {

  console.log("❌ Tab Removed:", tabId);

  scheduleSync();

});

// -----------------------------
// MANUAL MESSAGE SYNC
// -----------------------------
chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {

    if (message?.type === "sync_tabs") {

      syncAllTabs()
        .then(() =>
          sendResponse({ success: true })
        )
        .catch((error) =>
          sendResponse({
            success: false,
            error: error?.message,
          })
        );

      return true;
    }

  }
);

// -----------------------------
// INITIAL SYNC
// -----------------------------
syncAllTabs();