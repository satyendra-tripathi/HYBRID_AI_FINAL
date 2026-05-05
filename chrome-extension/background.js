// chrome-extension/background.js

// Backend URLs
const API_BASE = "https://hybrid-ai-final-1.onrender.com/api/tab";
const SYNC_INTERVAL_MINUTES = 1;

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
      lastSeenAt: new Date().toISOString()
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
 * This is preferred as it ensures the backend has the correct 'active' state for all tabs.
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

chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Extension Installed");
  syncAllTabs();
  chrome.alarms.create("sync_tabs", { periodInMinutes: SYNC_INTERVAL_MINUTES });
});

chrome.runtime.onStartup.addListener(() => {
  console.log("💻 Browser Startup");
  syncAllTabs();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync_tabs") {
    syncAllTabs();
  }
});

// When a new tab is created
chrome.tabs.onCreated.addListener(() => {
  // Use batch sync to ensure all states are consistent
  setTimeout(syncAllTabs, 2000);
});

// When a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete" || changeInfo.title) {
    // If it's a major change, sync all to ensure 'active' and other flags are correct
    syncAllTabs();
  }
});

// When active tab changes - CRITICAL for correct mapping
chrome.tabs.onActivated.addListener(() => {
  console.log("🔄 Tab activated - triggering full sync");
  syncAllTabs();
});

// When a tab is removed
chrome.tabs.onRemoved.addListener(() => {
  console.log("🗑️ Tab closed - triggering full sync");
  syncAllTabs();
});

// Initial run
syncAllTabs();