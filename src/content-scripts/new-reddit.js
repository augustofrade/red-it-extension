class LocationObserver {
  static currentUrl = location.href;

  static _events = [];
  static _observer = null;

  static on(callback) {
    this._events.push(callback);
    return this;
  }

  static disconnect() {
    this._events = [];
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
  }

  static observe() {
    if (this._observer) return;
    this._observer = new MutationObserver(() => {
      if (this.currentUrl === location.href) return;
      this.currentUrl = location.href;

      for (let event of this._events) {
        event(new URL(this.currentUrl));
      }
    });
    this._observer.observe(document.body, { childList: true, subtree: false });
  }
}

class DomObserver {
  _observers = {};

  /**
   * Observes changes in a feed container and calls the callback for each new element added
   * @param {string} expectedElementTag
   * @param {string} cssSelector
   * @param {Function} callback
   */
  observe(cssSelector, expectedElementTag, callback) {
    if (this._observers[cssSelector]) {
      this._observers[cssSelector].disconnect();
      delete this._observers[cssSelector];
    }
    const container = document.querySelector(cssSelector);
    if (container === null) return;

    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName !== expectedElementTag.toLocaleUpperCase()) continue;
          callback(node);
        }
        return;
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    this._observers[cssSelector] = observer;
  }

  stop(observerName) {
    if (this._observers[observerName]) {
      this._observers[observerName].disconnect();
      delete this._observers[observerName];
    }
  }

  stopAll() {
    for (let key in this._observers) {
      this._observers[key].disconnect();
      delete this._observers[key];
    }
  }
}

class NewRedditUrlHandler {
  constructor(url) {
    if (!(url instanceof URL)) {
      throw new Error("url must be an instance of URL");
    }
    this.url = url;
  }

  isPost() {
    return this.url.pathname.startsWith("/r/") && this.url.pathname.includes("/comments/");
  }

  isSubreddit() {
    return this.url.pathname.startsWith("/r/");
  }

  isHomepage() {
    return this.url.pathname === "/";
  }

  isSearch() {
    return this.url.pathname.includes("/search/");
  }
}

class NewReddit {
  static hostname = "www.reddit.com";
  static _configs = {};
  static _observers = new DomObserver();
  static _currentPageHandler = null;

  static async handle() {
    console.log("[RED-IT] Handling posts for " + this.hostname);
    await this._loadConfigs();
    this._handleGenericPage(new URL(location.href));
    this._hidePremiumAd();
    LocationObserver.on(this._handleGenericPage.bind(this)).observe();
  }

  static async _loadConfigs() {
    const configs = (await browser.storage.sync.get("newReddit")).newReddit;
    this._configs._hidePremiumAd = configs?.hidePremiumAd ?? false;
  }

  static _handleGenericPage(urlObj) {
    if (this._currentPageHandler) {
      this._currentPageHandler.stop();
      this._currentPageHandler = null;
    }

    const url = new NewRedditUrlHandler(urlObj);
    console.log("[RED-IT] URL changed to:", urlObj.href);

    switch (true) {
      case url.isHomepage():
        this._currentPageHandler = new NewRedditHomepageHandler(urlObj);
        break;
      case url.isPost():
        this._currentPageHandler = new NewRedditPostHandler(urlObj);
        break;
      case url.isSearch():
        this._currentPageHandler = new NewRedditSearchHandler(urlObj);
        break;
      case url.isSubreddit():
        this._currentPageHandler = new NewRedditSubredditHandler(urlObj);
        break;
      default:
        console.log("[RED-IT] Unhandled URL:", url.href);
        break;
    }

    if (this._currentPageHandler) {
      this._currentPageHandler.handle();
    }
  }

  static _hidePremiumAd() {
    if (this._configs._hidePremiumAd === false) return;

    this._observers.observe("#user-drawer-content", "ul", (list) => {
      const drawerItems = list.querySelectorAll("faceplate-tracker");
      for (let item of drawerItems) {
        if (item.textContent.includes("Reddit Pro")) {
          item.remove();
        }
      }
    });

    const resourceList = document.querySelectorAll("#RESOURCES faceplate-tracker");
    for (let resource of resourceList) {
      if (resource?.textContent.includes("Reddit Pro")) {
        resource.remove();
      }
    }
  }
}

(async function () {
  await ContentHandler.init();
  await NewReddit.handle();
  ContentHandler.handleMetrics();

  browser.runtime.onMessage.addListener(function (message) {
    if (message.type === "update-mode") {
      ContentHandler.mode = message.newMode;
      NewReddit.handle();
      ContentHandler.handleMetrics();
    }
  });
})();
