// chrome-extension/background.js

const DEFAULT_API_BASE = "https://backend-service-ot4f.onrender.com/api/tab";
const DEFAULT_SYNC_INTERVAL_MINUTES = 1;

let pendingSync = null;

/* =========================
   FORMAT TAB DATA
========================= */
function formatTab(tab) {

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
      detection_source: "EXTENSION",
      browser: "Chrome",
      active: Boolean(tab.active),
      timestamp: new Date().toISOString(),
    };

  } catch (e) {
    console.error("❌ formatTab error:", e);
    return null;
  }
}

/* =========================
   CONFIG
========================= */
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

/* =========================
   HEADERS
========================= */
async function requestHeaders(apiKey) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

/* =========================
   SYNC ALL TABS
========================= */
async function syncAllTabs() {

  const { apiBase, apiKey } = await getStoredConfig();

  try {

    const tabs = await chrome.tabs.query({});

    console.log("🟢 Total Tabs:", tabs.length);

    const formattedTabs = tabs
      .map(formatTab)
      .filter(Boolean);

    console.log("🟢 Valid Tabs:", formattedTabs.map(t => t.domain));

    if (formattedTabs.length === 0) return;

    const res = await fetch(`${apiBase}/batch`, {
      method: "POST",
      headers: await requestHeaders(apiKey),
      body: JSON.stringify({ tabs: formattedTabs }),
    });

    if (res.ok) {
      console.log(`✅ Synced ${formattedTabs.length} tabs`);
    } else {
      console.error("❌ Sync failed:", res.status, await res.text());
    }

  } catch (err) {
    console.error("❌ syncAllTabs error:", err);
  }
}

/* =========================
   DEBOUNCE
========================= */
function scheduleSync(delay = 1000) {
  if (pendingSync) clearTimeout(pendingSync);

  pendingSync = setTimeout(() => {
    pendingSync = null;
    syncAllTabs();
  }, delay);
}

/* =========================
   EVENTS
========================= */

// Installed
chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Extension Installed");
  syncAllTabs();
  chrome.alarms.create("sync_tabs", {
    periodInMinutes: DEFAULT_SYNC_INTERVAL_MINUTES,
  });
});

// Startup
chrome.runtime.onStartup.addListener(() => {
  console.log("💻 Startup");
  syncAllTabs();
});

// Alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync_tabs") {
    syncAllTabs();
  }
});

// Tab created
chrome.tabs.onCreated.addListener(() => {
  scheduleSync();
});

// Tab updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    scheduleSync();
  }
});

// Tab activated
chrome.tabs.onActivated.addListener(() => {
  scheduleSync();
});

// Window focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    scheduleSync();
  }
});

// Tab removed
chrome.tabs.onRemoved.addListener(() => {
  scheduleSync();
});

/* =========================
   INITIAL RUN
========================= */
syncAllTabs();