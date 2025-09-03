function debounce(callback, waitTime) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, waitTime);
  };
}

class ContentHandlerRegex {
  constructor(regex) {
    this.regex = regex;
  }

  static fromArray(arr) {
    if (arr.length === 0) {
      return new ContentHandlerRegex(null);
    }
    const wordBoundaryChars = "[ ,.?!-;:\"'()\\[\\]{}<>‘’]";
    const str = arr.join("|");

    const pattern = wordBoundaryChars + "(" + str + ")" + wordBoundaryChars;

    return new ContentHandlerRegex(new RegExp(pattern, "gi"));
  }

  hasMatches(str) {
    if (this.regex === null) return false;

    return str.match(this.regex) !== null;
  }
}

class Logger {
  static shouldLog = false;

  static log(message) {
    if (this.shouldLog) {
      console.log("[RED-IT]", message);
    }
  }
}

class ContentHandler {
  static blocklistRegex = null;
  static hideNsfw = false;
  static blockedSubreddits = [];
  static _saveMetricsDebounced = debounce(this._saveMetrics.bind(this), 1000);

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
    let data = await browser.storage.sync.get([
      "postBlocklist",
      "hideNsfw",
      "subredditBlocklist",
      "metrics",
    ]);

    if (data.postBlocklist?.every === undefined) data.postBlocklist = [];

    this.blocklistRegex = ContentHandlerRegex.fromArray(data.postBlocklist);
    Logger.log("[RED-IT] Loaded blocklist");

    this.mode = await browser.runtime.sendMessage("get-mode");
    Logger.log("[RED-IT] Using mode:", this.mode);

    this.hideNsfw = data.hideNsfw;
    Logger.log("[RED-IT] Hide NSFW:", this.hideNsfw ? "Yes" : "No");

    this.blockedSubreddits = data.subredditBlocklist ?? [];
    Logger.log("[RED-IT] Blocked subreddits:", this.blockedSubreddits.join(", ") || "None");
  }

  static async _saveMetrics() {
    Logger.log(`[RED-IT] Blocked ${this.metrics.blockedPosts} posts.`);
    Logger.log(`[RED-IT] Blocked ${this.metrics.blockedSubreddits} subreddits.`);
    browser.runtime.sendMessage({
      type: "update-metrics",
      metrics: this.metrics,
    });

    if (this.metrics.blockedPosts == 0) return (document.title = this.originalTitle);

    document.title = `(${this.metrics.blockedPosts}) ${this.originalTitle}`;
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

    const titleMatch = this.blocklistRegex.hasMatches(titleString);
    const shouldBlock =
      (isNsfw && this.hideNsfw) || titleMatch || this.isSubredditBlocked(subreddit);
    if (!shouldBlock) return false;

    Logger.log(`[RED-IT] Detected post: "${title}"`);
    this.metrics.blockedPosts++;
    this.blockContent(post);
    this._saveMetricsDebounced();
    return true;
  }

  /**
   * Handles a subreddit element and removes it if it's blocked
   * @param {HTMLElement} element
   * @param {string} subreddit
   * @returns
   */
  static handleSubreddit(element, subreddit) {
    if (!this.isSubredditBlocked(subreddit)) return;

    this.metrics.blockedSubreddits++;
    element.remove();
    this._saveMetricsDebounced();
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
