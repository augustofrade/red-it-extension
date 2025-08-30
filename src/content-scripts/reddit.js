(async function () {
  class OldReddit {
    static hostname = "old.reddit.com";
    static _configs = {};

    static async handle() {
      console.log("[RED-IT] Handling posts for " + this.hostname);
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
        ContentHandler.handleSearchResultSubreddit(result, subreddit);
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
        if (ContentHandler.isSubredditBlocked(subreddit)) {
          list.removeChild(item.parentElement);
        }
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

  let site = location.hostname === OldReddit.hostname ? OldReddit : NewReddit;
  await ContentHandler.init();
  await site.handle();
  ContentHandler.handleMetrics();

  browser.runtime.onMessage.addListener(function (message) {
    if (message.type === "update-mode") {
      ContentHandler.mode = message.newMode;
      site.handle();
      ContentHandler.handleMetrics();
    }
  });
})();
