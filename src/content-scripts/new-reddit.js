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

class NewReddit {
  static hostname = "www.reddit.com";
  static _configs = {};
  static _observers = new DomObserver();
  static _currentPageHandler = null;

  static async init() {
    Logger.log("[RED-IT] Handling posts for " + this.hostname);
    await this._loadConfigs();
    this.handleContent();
  }

  static handleContent() {
    this._handleGenericPage(new URL(location.href));
    this._hidePremiumAd();
    LocationObserver.on(this._handleGenericPage.bind(this)).observe();
  }

  static async _loadConfigs() {
    const configs = await browser.storage.sync.get("blockPremiumAds");
    this._configs._hidePremiumAd = configs?.blockPremiumAds ?? false;
  }

  static _handleGenericPage(urlObj) {
    if (this._currentPageHandler) {
      this._currentPageHandler.stop();
      this._currentPageHandler = null;
    }

    const url = new RedditUrlHandler(urlObj);
    Logger.log("[RED-IT] URL changed to:", urlObj.href);

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
        Logger.log("[RED-IT] Unhandled URL:", url.href);
        break;
    }

    if (this._currentPageHandler) {
      this._currentPageHandler.handle();
    }
  }

  static _hidePremiumAd() {
    console.log(document.getElementById("RESOURCES")?.children);
    if (this._configs._hidePremiumAd === false) return;

    this._observers.observe("#user-drawer-content", "ul", (list) => {
      const drawerItems = list.querySelectorAll("faceplate-tracker");
      for (let item of drawerItems) {
        if (item.textContent.includes("Reddit Pro")) {
          item.remove();
        }
      }
    });

    function hidePremiumAdLeftNav() {
      const leftNavResources = document.getElementById("RESOURCES");
      if (leftNavResources === null) return setTimeout(hidePremiumAdLeftNav, 100);

      const resourceList = leftNavResources.querySelectorAll("faceplate-tracker");
      for (let resource of resourceList) {
        if (resource?.textContent.includes("Reddit Pro")) {
          resource.remove();
        }
      }
    }

    hidePremiumAdLeftNav();
  }
}

(async function () {
  await ContentHandler.init();
  await NewReddit.init();

  browser.runtime.onMessage.addListener(function (message) {
    if (message.type === "update-mode") {
      ContentHandler.updateCurrentMode(message.newMode, NewReddit.handleContent.bind(NewReddit));
    }
  });
})();
