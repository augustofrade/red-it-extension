function handleMessages(messages) {
  const messageList = Object.entries(messages);

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message:", message);

    for (const [key, handler] of messageList) {
      if ((typeof message === "string" && message === key) || message.type === key) {
        return handler(message, sender, sendResponse);
      }
    }
  });
}

function getRedditTabs() {
  return browser.tabs.query({ url: "*://*.reddit.com/*" });
}

handleMessages({
  "open-settings": () => {
    browser.tabs.create({
      url: browser.runtime.getURL("pages/settings.html"),
      active: true,
    });
  },
  "open-about": () => {
    browser.tabs.create({
      url: "https://github.com/augustofrade/red-it-extension",
    });
  },
  "list-modes": () => {
    return Promise.resolve({
      purge: "Removes the content from the page",
      cover: "Covers the content with a placeholder. You can hover to see it.",
      hide: "Blanks the content",
      show: "Shows all content (disables the extension)",
    });
  },
  "set-mode": (message) => {
    return new Promise((resolve) => {
      const { newMode } = message;
      browser.storage.sync.set({ mode: newMode });

      getRedditTabs().then((tabs) => {
        for (const tab of tabs) {
          browser.tabs.sendMessage(tab.id, { type: "update-mode", newMode });
        }
      });

      resolve(newMode);
    });
  },
  "get-mode": () => {
    return new Promise((resolve) => {
      browser.storage.sync.get("mode").then((data) => {
        resolve(data.mode || "hide");
      });
    });
  },
  "update-metrics": (message) => {
    const metrics = message.metrics;

    return browser.storage.sync.get("metrics").then((data) => {
      let { metrics: existingMetrics } = data;
      existingMetrics = {
        blockedPosts: existingMetrics?.blockedPosts ?? 0,
        blockedSubreddits: existingMetrics?.blockedSubreddits ?? 0,
      };

      metrics.blockedPosts += existingMetrics.blockedPosts;
      metrics.blockedSubreddits += existingMetrics.blockedSubreddits;
      return browser.storage.sync.set({ metrics });
    });
  },
});
