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
    let data = await browser.storage.sync.get(["postBlocklist", "hideNsfw", "subredditBlocklist"]);
    if (data.postBlocklist?.every === undefined) data.postBlocklist = [];

    const regex = RegexHelper.fromArray(data.postBlocklist);
    this.blocklistRegex = regex === null ? null : new RegExp(regex.source, "gi");
    console.info("[RED-IT] Loaded blocklist");

    this.mode = await browser.runtime.sendMessage("get-mode");
    console.info("[RED-IT] Using mode:", this.mode);

    this.hideNsfw = data.hideNsfw;
    console.info("[RED-IT] Hide NSFW:", this.hideNsfw ? "Yes" : "No");

    this.blockedSubreddits = data.subredditBlocklist ?? [];
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
   * @returns {boolean} Whether the post was blocked
   */
  static handlePost(post, title, isNsfw = false, subreddit) {
    const titleString = " " + title + " ";

    this._resetPost(post);
    if (this.mode === "show") return false;

    const titleMatch = RegexHelper.hasMatches(this.blocklistRegex, titleString);
    const shouldBlock =
      (isNsfw && this.hideNsfw) || titleMatch || this.isSubredditBlocked(subreddit);
    if (!shouldBlock) return false;

    console.log(`[RED-IT] Detected post: "${title}"`);
    this.metrics.blockedPosts++;
    this.blockContent(post);
    return true;
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
