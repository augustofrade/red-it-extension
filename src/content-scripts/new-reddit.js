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

class FeedObserver {
  _observer = null;

  /**
   * Observes changes in a feed container and calls the callback for each new element added
   * @param {string} expectedElementTag
   * @param {HTMLElement} container
   * @param {Function} callback
   */
  observe(expectedElementTag, container, callback) {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName !== expectedElementTag.toLocaleUpperCase()) continue;
          callback(node);
        }
        return;
      }
    });
    this._observer.observe(container, { childList: true, subtree: true });
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
  static _feed = new FeedObserver();

  static async handle() {
    console.log("[RED-IT] Handling posts for " + this.hostname);
    this._handleGenericPage(new URL(location.href));
    LocationObserver.on(this._handleGenericPage.bind(this)).observe();
  }

  static _handleGenericPage(url) {
    const handler = new NewRedditUrlHandler(url);
    console.log("[RED-IT] URL changed to:", url.href);
    switch (true) {
      case handler.isPost():
        break;
      case handler.isSubreddit():
        this._handleSubredditFeed();
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
    this._feed.observe(
      "faceplate-batch",
      document.querySelector("shreddit-feed"),
      this._handleSubredditDynamicFeed.bind(this)
    );
  }

  static _handleSubredditDynamicFeed() {
    const posts = document.querySelectorAll("faceplate-batch article");
    for (let post of posts) {
      this._handleSinglePost(post);
    }
  }

  static _handleHomepageFeed() {
    const posts = document.querySelectorAll("shreddit-feed article");
    for (let post of posts) {
      this._handleSinglePost(post);
    }
    // Homepage in new Reddit is initially rendered with only 3 articles
    this._feed.observe(
      "article",
      document.querySelector("shreddit-feed"),
      this._handleSinglePost.bind(this)
    );
  }

  static _handleHomepageCommunities() {
    const list = document.querySelector("#popular-communities-list > ul");
    for (let subreddit of list.querySelectorAll("li")) {
      const name = subreddit.querySelector(".text-neutral-content").textContent.trim();
      if (ContentHandler.isSubredditBlocked(name)) {
        console.log(subreddit);
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

  static _handleSinglePost(post) {
    const title = post.querySelector("faceplate-screen-reader-content").textContent.trim();
    const subreddit = post.querySelector("faceplate-hovercard a > span")?.textContent;
    ContentHandler.handlePost(post, title, false, subreddit);
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
