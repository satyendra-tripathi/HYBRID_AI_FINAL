// chrome-extension/background.js

// Backend URLs
const API_BASE = "https://hybrid-ai-final-1.onrender.com/api/tab";
const SYNC_INTERVAL_MINUTES = 1; // Sync all tabs every 1 minute

/**
 * Format tab object for the backend
 */
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
      active: tab.active || false,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Send a single tab update
 */
async function sendTab(tab) {
  const payload = formatTab(tab);
  if (!payload) return;

  try {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log("✅ Tab synced:", payload.domain);
    }
  } catch (err) {
    console.error("❌ Tab sync error:", err);
  }
}

/**
 * Sync all open tabs using the batch endpoint
 */
async function syncAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    const formattedTabs = tabs.map(formatTab).filter(Boolean);

    if (formattedTabs.length === 0) return;

    const res = await fetch(`${API_BASE}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs: formattedTabs }),
    });

    if (res.ok) {
      console.log(`✅ Batch synced ${formattedTabs.length} tabs`);
    } else {
      console.error("❌ Batch sync failed:", res.status);
    }
  } catch (err) {
    console.error("❌ syncAllTabs error:", err);
  }
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------------------

// On Installation or Update
chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Extension Installed");
  syncAllTabs();
  
  // Create alarm for periodic sync
  chrome.alarms.create("sync_tabs", { periodInMinutes: SYNC_INTERVAL_MINUTES });
});

// On Startup
chrome.runtime.onStartup.addListener(() => {
  console.log("💻 Browser Startup");
  syncAllTabs();
});

// On Alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync_tabs") {
    syncAllTabs();
  }
});

// When a new tab is created
chrome.tabs.onCreated.addListener((tab) => {
  // Wait a bit for URL to be available (often starts as 'about:blank')
  setTimeout(() => {
    chrome.tabs.get(tab.id, (updatedTab) => {
      if (updatedTab) sendTab(updatedTab);
    });
  }, 1000);
});

// When a tab is updated (URL change, title change, loading status)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Sync immediately on URL change or when status is complete
  if (changeInfo.url || changeInfo.status === "complete" || changeInfo.title) {
    sendTab(tab);
  }
});

// When active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    sendTab(tab);
  } catch (err) {
    console.error("onActivated error:", err);
  }
});

// When a tab is removed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // We don't have a remove endpoint on backend yet, but we could trigger a full sync to refresh the map
  // For now, just log it. Full sync happens via alarm.
  console.log("🗑️ Tab closed:", tabId);
});

// Initial run
syncAllTabs();