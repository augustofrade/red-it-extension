class OldReddit {
  static hostname = "old.reddit.com";
  static _configs = {};

  static async handle() {
    Logger.log("[RED-IT] Handling posts for " + this.hostname);
    await this._loadConfigs();
    this._hidePremiumAd();
    this._handlePosts();
    this._handleSearchPagePosts();
    this._handleSearchPageSubreddits();
    this._handleTopBarSubreddits();
  }

  static async _loadConfigs() {
    const configs = (await browser.storage.sync.get("oldReddit")).oldReddit;
    this._configs._hidePremiumAd = configs?.hidePremiumAd ?? false;
  }

  static _handlePosts() {
    for (let post of document.querySelectorAll("#siteTable .thing")) {
      const title = post.querySelector(".title a").textContent;
      const isNsfw = post.querySelector(".nsfw-stamp") !== null;
      const subreddit = post.querySelector(".subreddit")?.innerText;
      ContentHandler.handlePost(post, title, isNsfw, subreddit);
    }
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
  ContentHandler.handleMetrics();

  browser.runtime.onMessage.addListener(function (message) {
    if (message.type === "update-mode") {
      ContentHandler.mode = message.newMode;
      OldReddit.handle();
      ContentHandler.handleMetrics();
    }
  });
})();
