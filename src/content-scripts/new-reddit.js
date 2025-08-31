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
          console.log("check");
          callback(node);
        }
        return;
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    this._observers[cssSelector] = observer;
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
}

class NewReddit {
  static hostname = "www.reddit.com";
  static _configs = {};
  static _observers = new DomObserver();

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

  static _handleGenericPage(url) {
    const handler = new NewRedditUrlHandler(url);
    console.log("[RED-IT] URL changed to:", url.href);
    switch (true) {
      case handler.isPost():
        this._handlePostPageRecommended();
        break;
      case handler.isSubreddit():
        this._handleSubredditFeed();
        this._handleSubredditTopCarousel();
        break;
      case handler.isHomepage():
        this._handleHomepageCommunities();
        this._handleHomepageFeed();
        this._handleHomepageTopCarousel();
        break;
      default:
        console.log("[RED-IT] Unhandled URL:", url.href);
        break;
    }
  }

  static _handleSubredditFeed() {
    const posts = document.querySelectorAll("shreddit-feed article");
    for (let post of posts) {
      this._handleSinglePost(post);
    }
    // Subreddits in new Reddit are initially rendered with only 3 articles
    // and its dynamically articles content is inside a subcomponent that is lazy-loaded
    this._observers.observe("shreddit-feed", "faceplate-batch", this._handleSinglePost.bind(this));
  }

  static _handleSubredditTopCarousel() {
    const carouselPosts = document.querySelectorAll("shreddit-gallery-carousel > li");
    for (let post of carouselPosts) {
      const title = post.querySelector("h2").textContent.trim();
      ContentHandler.handlePost(post, title, false, undefined);
    }
  }

  static _handleHomepageFeed() {
    const posts = document.querySelectorAll("shreddit-feed article");
    for (let post of posts) {
      this._handleSinglePost(post);
    }
    // Homepage in new Reddit is initially rendered with only 3 articles
    this._observers.observe("shreddit-feed", "article", this._handleSinglePost.bind(this));
  }

  static _handleHomepageCommunities() {
    const list = document.querySelector("#popular-communities-list > ul");
    if (list === null) return;

    for (let subreddit of list.querySelectorAll("li")) {
      const name = subreddit.querySelector(".text-neutral-content").textContent.trim();
      if (ContentHandler.isSubredditBlocked(name)) {
        list.removeChild(subreddit);
      }
    }
  }

  static _handleHomepageTopCarousel() {
    const carouselPosts = document.querySelectorAll("shreddit-gallery-carousel * > li");
    for (let post of carouselPosts) {
      const title = post.querySelector("h2").textContent.trim();
      const subreddit = post.querySelector("span.font-bold").textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    }
  }

  static _handlePostPageRecommended() {
    const recommendedPosts = document.querySelector("faceplate-tracker ul");
    if (recommendedPosts === null) {
      // Incosistent element, can't use mutation observer
      return setTimeout(this._handlePostPageRecommended.bind(this), 100);
    }

    for (let post of recommendedPosts.children) {
      const title = post.querySelector("h3").textContent.trim();
      const subreddit = post
        .querySelector("faceplate-hovercard a div:last-child")
        .textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    }
  }

  static _handleSinglePost(post) {
    const title = post.querySelector("faceplate-screen-reader-content").textContent.trim();
    const subreddit = post.querySelector("faceplate-hovercard a > span")?.textContent;
    ContentHandler.handlePost(post, title, false, subreddit);
  }

  static _hidePremiumAd() {
    if (this._configs._hidePremiumAd === false) return;

    const userDrawer = document.querySelector("#user-drawer-content");
    const premiumAd = userDrawer.querySelector("faceplate-tracker");
    if (premiumAd?.textContent.includes("Reddit Pro")) {
      premiumAd.remove();
    }

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
