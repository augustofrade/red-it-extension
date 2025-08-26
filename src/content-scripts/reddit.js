(async function (mode = "purge") {
  class RegexHelper {
    static fromArray(arr) {
      const wordBoundaryChars = "[ ,.?!;:\"'()\\[\\]{}<>‘’]";
      const str = arr.join("|");
      return new RegExp(
        wordBoundaryChars + "(" + str + ")" + wordBoundaryChars,
        "gi"
      );
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
    };

    /**
     * Reads user-defined settings from storage
     */
    static async init() {
      let blockListString = (await browser.storage.sync.get("postBlocklist"))
        .postBlocklist;
      if (blockListString?.every === undefined) blockListString = [];

      const regex = RegexHelper.fromArray(blockListString).source;

      this.blocklistRegex = new RegExp(regex, "gi");
      console.info("[RED-IT] Loaded blocklist");

      this.mode = await browser.runtime.sendMessage("get-mode");
      console.info("[RED-IT] Using mode:", this.mode);

      this.hideNsfw = (await browser.storage.sync.get("hideNsfw")).hideNsfw;
      console.info("[RED-IT] Hide NSFW:", this.hideNsfw ? "Yes" : "No");

      this.blockedSubreddits = (
        await browser.storage.sync.get("subredditBlocklist")
      ).subredditBlocklist;
      console.info(
        "[RED-IT] Blocked subreddits:",
        this.blockedSubreddits.join(", ") || "None"
      );
    }

    static async handleMetrics() {
      console.log(`[RED-IT] Blocked ${this.metrics.blockedPosts} posts.`);
      if (this.metrics.blockedPosts == 0)
        return (document.title = this.originalTitle);

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
      subreddit = subreddit?.replace("r/", "").trim();

      this.resetPost(post);
      if (this.mode === "show") return;

      const titleMatch = titleString.match(this.blocklistRegex) !== null;
      const isSubredditBlocked = this.blockedSubreddits.includes(subreddit);
      const shouldBlock =
        (isNsfw && this.hideNsfw) || titleMatch || isSubredditBlocked;
      if (!shouldBlock) return;

      console.log(`[RED-IT] Detected post: "${title}"`);
      this.metrics.blockedPosts++;

      if (this.mode === "purge") {
        post.style.display = "none";
      } else if (this.mode === "cover") {
        post.classList.add("unwanted-post");
      } else if (this.mode === "hide") {
        post.style.visibility = "hidden";
      }
    }

    /**
     * Resets the styles of a post element
     * @param {HTMLElement} post
     */
    static resetPost(post) {
      post.style.display = "block";
      post.classList.remove("unwanted-post");
      post.style.visibility = "initial";
    }
  }

  class OldReddit {
    static hostname = "old.reddit.com";

    static handle() {
      console.log("[RED-IT] Handling posts for " + this.hostname);
      this._handlePosts();
    }

    static _handlePosts() {
      for (let post of document.querySelectorAll("#siteTable .thing")) {
        const title = post.querySelector(".title a").textContent;
        const isNsfw = post.querySelector(".nsfw-stamp") !== null;
        const subreddit = post.querySelector(".subreddit")?.innerText;
        ContentHandler.handlePost(post, title, isNsfw, subreddit);
      }
    }
  }

  let site;
  await ContentHandler.init();
  if (location.hostname === OldReddit.hostname) {
    site = OldReddit;
  }
  site.handle();
  ContentHandler.handleMetrics();

  browser.runtime.onMessage.addListener(function (message) {
    if (message.type === "update-mode") {
      ContentHandler.mode = message.newMode;
      site.handle();
      ContentHandler.handleMetrics();
    }
  });
})("cover");
