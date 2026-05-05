// chrome-extension/background.js

// Local backend:
// const API_URL = "http://127.0.0.1:5000/api/tab";

// Deployed backend:
const API_URL = "https://hybrid-ai-final-1.onrender.com/api/tab";

async function sendTab(tab) {
  if (!tab?.url || !tab.url.startsWith("http")) return;

  try {
    const url = new URL(tab.url);

    const payload = {
      domain: url.hostname,
      title: tab.title || url.hostname,
      url: tab.url,
      tabId: tab.id,
      windowId: tab.windowId,
      active: tab.active || false,
      lastSeenAt: new Date().toISOString()
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error("Tab sync failed:", res.status, await res.text());
      return;
    }

    console.log("Tab synced:", payload.domain, payload.title);
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

async function syncAllTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    for (const tab of tabs) {
      await sendTab(tab);
    }
  } catch (err) {
    console.error("syncAllTabs error:", err);
  }
}

// Run when extension starts/installed
chrome.runtime.onInstalled.addListener(() => {
  syncAllTabs();
});

chrome.runtime.onStartup.addListener(() => {
  syncAllTabs();
});

// When active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await sendTab(tab);
    await syncAllTabs();
  } catch (err) {
    console.error("onActivated error:", err);
  }
});

// When tab URL/title updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    await sendTab(tab);
    await syncAllTabs();
  }
});

// Periodic sync all open tabs
setInterval(syncAllTabs, 5000);