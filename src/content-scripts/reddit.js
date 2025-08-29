(async function () {
  class RegexHelper {
    static fromArray(arr) {
      if (arr.length === 0) return null; // Matches nothing
      const wordBoundaryChars = "[ ,.?!-;:\"'()\\[\\]{}<>‘’]";
      const str = arr.join("|");
      return new RegExp(wordBoundaryChars + "(" + str + ")" + wordBoundaryChars, "gi");
    }

    static hasMatches(regex, str) {
      if (regex === null) return false;
      return str.match(regex) !== null;
    }
  }

  class ContentHandler {
    static blocklistRegex = "";
    static hideNsfw = false;
    static blockedSubreddits = [];

    static mode = "hide";
    static originalTitle = document.title;
    static metrics = {
      blockedPosts: 0,
      blockedSubreddits: 0,
    };

    /**
     * Reads user-defined settings from storage
     */
    static async init() {
      let blockListString = (await browser.storage.sync.get("postBlocklist")).postBlocklist;
      if (blockListString?.every === undefined) blockListString = [];

      const regex = RegexHelper.fromArray(blockListString);
      this.blocklistRegex = regex === null ? null : new RegExp(regex.source, "gi");
      console.info("[RED-IT] Loaded blocklist");

      this.mode = await browser.runtime.sendMessage("get-mode");
      console.info("[RED-IT] Using mode:", this.mode);

      this.hideNsfw = (await browser.storage.sync.get("hideNsfw")).hideNsfw;
      console.info("[RED-IT] Hide NSFW:", this.hideNsfw ? "Yes" : "No");

      this.blockedSubreddits =
        (await browser.storage.sync.get("subredditBlocklist")).subredditBlocklist ?? [];
      console.info("[RED-IT] Blocked subreddits:", this.blockedSubreddits.join(", ") || "None");
    }

    static async handleMetrics() {
      console.log(`[RED-IT] Blocked ${this.metrics.blockedPosts} posts.`);
      console.log(`[RED-IT] Blocked ${this.metrics.blockedSubreddits} subreddits.`);
      if (this.metrics.blockedPosts == 0) return (document.title = this.originalTitle);

      document.title = `(${this.metrics.blockedPosts}) ${this.originalTitle}`;
      this.metrics.blockedPosts = 0;
    }

    /**
     * Handles a single post on the page
     * @param {HTMLElement} post
     * @param {string} title
     * @param {boolean} isNsfw
     * @param {string?} subreddit
     */
    static handlePost(post, title, isNsfw = false, subreddit) {
      const titleString = " " + title + " ";

      this._resetPost(post);
      if (this.mode === "show") return;

      const titleMatch = RegexHelper.hasMatches(this.blocklistRegex, titleString);
      const shouldBlock =
        (isNsfw && this.hideNsfw) || titleMatch || this.isSubredditBlocked(subreddit);
      if (!shouldBlock) return;

      console.log(`[RED-IT] Detected post: "${title}"`);
      this.metrics.blockedPosts++;
      this.blockContent(post);
    }

    static handleSearchResultSubreddit(post, subreddit) {
      this._resetPost(post);
      if (this.mode === "show") return;
      if (!this.isSubredditBlocked(subreddit)) return;

      console.log(`[RED-IT] Detected subreddit: "r/${subreddit}"`);
      this.metrics.blockedSubreddits++;
      this.blockContent(post);
    }

    static isSubredditBlocked(subreddit) {
      subreddit = subreddit?.replace("r/", "").trim().toLocaleLowerCase();
      return this.blockedSubreddits.includes(subreddit);
    }

    static blockContent(content) {
      if (this.mode === "purge") {
        content.style.display = "none";
      } else if (this.mode === "cover") {
        content.classList.add("red-it--blocked-content");
      } else if (this.mode === "hide") {
        content.style.visibility = "hidden";
      }
    }

    /**
     * Resets the styles of a post element
     * @param {HTMLElement} post
     */
    static _resetPost(post) {
      post.style.display = "block";
      post.classList.remove("red-it--blocked-content");
      post.style.visibility = "initial";
    }
  }

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
      const list = document.getElementById("sr-bar");
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
    }
  }

  let site;
  await ContentHandler.init();
  if (location.hostname === OldReddit.hostname) {
    site = OldReddit;
  }
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
