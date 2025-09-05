function debounce(callback, waitTime) {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, waitTime);
  };
}

class HTTPInterceptor {
  _observers = [];

  constructor() {
    browser.runtime.onMessage.addListener((message) => {
      if (message.type !== "http-request") return;
      this._observers.forEach((observer) => {
        const url = new URL(message.details.url);
        if (url.pathname.match(observer.endpoint)) {
          observer.callback(message.details);
        }
      });
    });
  }

  on(endpoint, callback) {
    this._observers.push({ endpoint, callback });
  }
}

class DomObserver {
  _observers = {};

  /**
   * Observes changes in a feed container and calls the callback for each new element added
   * @param {string} expectedElementTag
   * @param {string} cssSelector
   * @param {Function} callback
   */
  observe(cssSelector, expectedElementTag, callback) {
    if (this._observers[cssSelector]) {
      this._observers[cssSelector].disconnect();
      delete this._observers[cssSelector];
    }
    const container = document.querySelector(cssSelector);
    if (container === null) return;

    const observer = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.tagName !== expectedElementTag.toLocaleUpperCase()) continue;
          callback(node);
        }
        return;
      }
    });
    observer.observe(container, { childList: true, subtree: true });
    this._observers[cssSelector] = observer;
  }

  stop(observerName) {
    if (this._observers[observerName]) {
      this._observers[observerName].disconnect();
      delete this._observers[observerName];
    }
  }

  stopAll() {
    for (let key in this._observers) {
      this._observers[key].disconnect();
      delete this._observers[key];
    }
  }
}

class RedditUrlHandler {
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

  isSearch() {
    return this.url.pathname.match("^/search/?") !== null;
  }
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

  static _shouldResetContent = false;
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
      "logUsage",
    ]);

    if (data.postBlocklist?.every === undefined) data.postBlocklist = [];

    this.blocklistRegex = ContentHandlerRegex.fromArray(data.postBlocklist);
    Logger.log("[RED-IT] Loaded blocklist");

    this.mode = await browser.runtime.sendMessage("get-mode");
    Logger.log("[RED-IT] Using mode:", this.mode);

    this.hideNsfw = data.hideNsfw ?? false;
    Logger.log("[RED-IT] Hide NSFW:", this.hideNsfw ? "Yes" : "No");

    this.blockedSubreddits = data.subredditBlocklist ?? [];
    Logger.log("[RED-IT] Blocked subreddits:", this.blockedSubreddits.join(", ") || "None");

    Logger.shouldLog = data.logUsage ?? false;
    Logger.log("[RED-IT] Logging is enabled");
  }

  static updateCurrentMode(mode, callback) {
    this.mode = mode;
    this._shouldResetContent = true;
    callback();
    this._shouldResetContent = false;
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
    this.blockContent(post);
    this._handleMetrics(post, "blockedPosts");
    return true;
  }

  /**
   * Handles a single comment on the page
   * @param {HTMLElement} comment
   * @param {HTMLElement} commentBody
   * @param {string} text
   * @returns {boolean} Whether the comment was blocked
   */
  static handleComment(comment, commentBody, text) {
    this._handleResetContent(commentBody);
    if (this.mode === "show") return false;

    const textString = " " + text + " ";
    const shouldBlock = this.blocklistRegex.hasMatches(textString);
    if (!shouldBlock) return false;

    this.blockContent(commentBody);
    comment.classList.add("red-it--blocked-content");
    commentBody.classList.add("red-it--blocked-content");
    return true;
  }

  /**
   * Handles a subreddit element and removes it if it's blocked
   * @param {HTMLElement} element
   * @param {string} subreddit
   * @returns Whether the subreddit element was blocked
   */
  static handleSubreddit(element, subreddit) {
    if (!this.isSubredditBlocked(subreddit)) return false;

    element.remove();
    this._handleMetrics(element, "blockedSubreddits");
    return true;
  }

  static isSubredditBlocked(subreddit) {
    subreddit = subreddit?.replace("r/", "").trim().toLocaleLowerCase();
    return this.blockedSubreddits.includes(subreddit);
  }

  static addMetricsClass(element) {
    element.classList.add("red-it--metrics-handled");
  }

  /**
   * @param {HTMLElement} element
   * @param {keyof ContentHandler["metrics"]} key
   */
  static _handleMetrics(element, key) {
    if (element.classList.contains("red-it--metrics-handled")) return;
    this.metrics[key]++;
    this._saveMetricsDebounced();
  }

  static blockContent(content) {
    content.classList.add("red-it--content-" + this.mode);
  }

  static _handleResetContent(content) {
    if (!this._shouldResetContent) return;

    content.classList.remove(
      "red-it--blocked-content",
      "red-it--content-purge",
      "red-it--content-hide",
      "red-it--content-cover",
      "red-it--content-show"
    );
  }

  /**
   * Resets the styles of a post element
   * @param {HTMLElement} post
   */
  static _resetPost(post) {
    post.style.display = "block";
    post.classList.remove("red-it--content-cover");
    post.style.visibility = "initial";
  }
}
