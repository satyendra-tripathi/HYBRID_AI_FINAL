chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);

  if (tab.url && tab.url.startsWith("http")) {
    console.log("Sending tab:", tab.url, tab.title);

    fetch("http://127.0.0.1:5000/api/tab", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: new URL(tab.url).hostname,
        title: tab.title,
      }),
    })
    .then(res => console.log("Tab sent successfully"))
    .catch(err => console.error("Fetch error:", err));
  }
});

// Also handle updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith("http")) {
    console.log("Updating tab:", tab.url, tab.title);

    fetch("http://127.0.0.1:5000/api/tab", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        domain: new URL(tab.url).hostname,
        title: tab.title,
      }),
    })
    .then(res => console.log("Tab updated successfully"))
    .catch(err => console.error("Fetch error:", err));
  }
});
