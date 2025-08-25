function handleMessages(messages) {
  const messageList = Object.entries(messages);

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Received message:", message);

    for (const [key, handler] of messageList) {
      if (
        (typeof message === "string" && message === key) ||
        message.type === key
      ) {
        return handler(message, sender, sendResponse);
      }
    }
  });
}
handleMessages({
  "open-settings": () => {
    browser.tabs.create({
      url: browser.runtime.getURL("pages/home/index.html"),
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
    });
  },
  "set-mode": (message) => {
    return browser.storage.sync.set({ mode: message.newMode });
  },
  "get-mode": () => {
    return new Promise((resolve) => {
      browser.storage.sync.get("mode").then((data) => {
        resolve(data.mode || "purge");
      });
    });
  },
});
