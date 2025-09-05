class OldReddit {
  static hostname = "old.reddit.com";
  static _configs = {};
  static _observer = new DomObserver();
  static _httpInterceptor = new HTTPInterceptor();

  static async handle() {
    Logger.log("[RED-IT] Handling posts for " + this.hostname);
    await this._loadConfigs();
    this._hidePremiumAd();
    this._handleCurrentPage();
    this._handleTopBarSubreddits();
  }

  static async _handleCurrentPage() {
    this._observer.stopAll();
    const url = new RedditUrlHandler(new URL(window.location));

    switch (true) {
      case url.isHomepage():
        this._handlePosts();
        break;
      case url.isPost():
        this._handleComments();
        break;
      case url.isSearch():
        this._handleSearchPagePosts();
        this._handleSearchPageSubreddits();
        break;
      case url.isSubreddit():
        this._handlePosts();
        break;
      default:
        Logger.log("[RED-IT] Unhandled URL:", url.href);
        break;
    }
  }

  static async _loadConfigs() {
    const configs = (await browser.storage.sync.get("oldReddit")).oldReddit;
    this._configs.hidePremiumAd = configs?.hidePremiumAd ?? false;
  }

  static _handlePosts() {
    for (let post of document.querySelectorAll("#siteTable .thing")) {
      const title = post.querySelector(".title a").textContent;
      const isNsfw = post.querySelector(".nsfw-stamp") !== null;
      const subreddit = post.querySelector(".subreddit")?.innerText;
      ContentHandler.handlePost(post, title, isNsfw, subreddit);
    }
  }

  static _handleComments() {
    function handle() {
      for (let comment of document.querySelectorAll(".comment:not(.red-it--blocked-content)")) {
        const body = comment.querySelector(".usertext-body");
        ContentHandler.handleComment(comment, body, body.textContent);
      }
    }

    handle();
    this._httpInterceptor.on("/api/morechildren", (_) => setTimeout(handle, 100));
  }

  static _handleSearchPageSubreddits() {
    for (let result of document.querySelectorAll(".search-result-subreddit")) {
      const subreddit = result.querySelector(".search-subreddit-link").textContent;
      ContentHandler.handleSubreddit(result, subreddit);
    }
  }

  static _handleSearchPagePosts() {
    for (let post of document.querySelectorAll(".search-result-link")) {
      const title = post.querySelector(".search-title").textContent;
      const isNsfw = post.querySelector(".nsfw-stamp") !== null;
      const subreddit = post.querySelector(".search-subreddit-link").textContent;
      ContentHandler.handlePost(post, title, isNsfw, subreddit);
    }
  }

  static _handleTopBarSubreddits() {
    const list = document.querySelector(".sr-bar:last-of-type");
    for (let item of list.querySelectorAll(".choice")) {
      const subreddit = item.textContent;
      ContentHandler.handleSubreddit(item.parentElement, subreddit);
    }
  }

  static _hidePremiumAd() {
    if (!this._configs.hidePremiumAd) return;

    const banner = document.querySelector(".premium-banner-outer");
    if (banner) {
      banner.parentElement.removeChild(banner);
    }
    const footerAd = document.querySelector(".footer .col:last-child");
    if (footerAd) {
      footerAd.parentElement.removeChild(footerAd);
    }
  }
}

(async function () {
  await ContentHandler.init();
  await OldReddit.handle();

  browser.runtime.onMessage.addListener(function (message) {
    if (message.type === "update-mode") {
      ContentHandler.mode = message.newMode;
      OldReddit.handle();
    }
  });
})();
