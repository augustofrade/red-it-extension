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
  static _feedObserver = null;

  static async handle() {
    console.log("[RED-IT] Handling posts for " + this.hostname);

    LocationObserver.on(this.handleGenericPage.bind(this)).observe();
  }

  static handleGenericPage(url) {
    const handler = new NewRedditUrlHandler(url);
    console.log("[RED-IT] URL changed to:", url.href);
    if (handler.isPost()) {
    } else if (handler.isSubreddit()) {
    } else if (handler.isHomepage()) {
      this._handleFeedPosts();
      this._handleTopCarouselPosts();
    } else {
      console.log("[RED-IT] Unhandled URL:", url.href);
    }
  }

  static _listenFeedForPosts(element) {
    if (this._feedObserver) {
      this._feedObserver.disconnect();
      this._feedObserver = null;
    }
    this._feedObserver = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName !== "ARTICLE") continue;
          this._handleSinglePost(node);
        }
      }
    });
    this._feedObserver.observe(element, { childList: true, subtree: true });
  }

  static _handleFeedPosts() {
    const feed = document.querySelector("shreddit-feed");
    for (let post of feed.children) {
      if (post.tagName !== "ARTICLE") continue;
      this._handleSinglePost(post);
    }
    // New reddit is initially rendered with only 3 articles
    this._listenFeedForPosts(feed);
  }

  static _handleTopCarouselPosts() {
    const carouselPosts = document.querySelectorAll("shreddit-gallery-carousel * > li");
    for (let post of carouselPosts) {
      const title = post.querySelector("h2").textContent.trim();
      const subreddit = post.querySelector("span.font-bold").textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    }
  }

  static _handleSinglePost(post) {
    const title = post.querySelector("faceplate-screen-reader-content").textContent.trim();
    const subreddit = post.querySelector("faceplate-hovercard a > span").textContent;
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
