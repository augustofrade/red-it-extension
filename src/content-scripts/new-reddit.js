class NewReddit {
  static hostname = "www.reddit.com";
  static _configs = {};

  static async handle() {
    console.log("[RED-IT] Handling posts for " + this.hostname);
    this._handleFeedPosts();
    this._handleTopCarouselPosts();
  }

  static _listenFeedForPosts(element) {
    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName !== "ARTICLE") continue;
          this._handleSinglePost(node);
        }
      }
    });
    observer.observe(element, { childList: true, subtree: true });
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
