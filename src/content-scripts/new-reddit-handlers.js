const handlePost = (post) => {
  const title = post.querySelector("faceplate-screen-reader-content").textContent.trim();
  const subreddit = post.querySelector("faceplate-hovercard a > span")?.textContent;
  ContentHandler.handlePost(post, title, false, subreddit);
};

class NewRedditSearchHandler {
  /**
   * @param {URL} url
   */
  constructor(url) {
    this.url = url;
    this._observers = new DomObserver();
  }

  handle() {
    const searchType = new URLSearchParams(location.search).get("type");
    switch (searchType) {
      case "communities":
        this._handleCommunitiesTab();
        break;
      case "comments":
        this._handleCommentsTab();
        break;
      case "media":
        this._handleMediaTab();
      default:
        this._handlePostsTab();
        break;
    }
  }

  stop() {
    this._observers.stopAll();
  }

  _handlePostsTab() {
    const handlePost = (post) => {
      const title = post.querySelector("div > a").textContent.trim();
      const subreddit = post.querySelector(".truncate").textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    };

    this._handleRelatedCommunities();

    let query = "#main-content > div > search-telemetry-tracker";
    if (location.pathname.startsWith("/r/"))
      // If searching in a subreddit, the first two elements are not posts
      query += ":nth-child(n+3)";

    const posts = document.querySelectorAll(query);
    for (let post of posts) {
      handlePost(post);
    }
    this._observers.observe("#main-content > div", "search-telemetry-tracker", handlePost);
  }

  _handleRelatedCommunities() {
    const communities = document.querySelectorAll(
      "#right-sidebar-contents section:first-child > search-telemetry-tracker"
    );

    for (let community of communities) {
      const subreddit = community.querySelector("h3")?.textContent.trim();
      ContentHandler.handleSubreddit(community, subreddit);
    }
  }

  _handleMediaTab() {
    const handlePost = (post) => {
      const title = post.querySelector("search-telemetry-tracker:last-child").textContent.trim();
      const subreddit = post
        .querySelector("faceplate-hovercard a > span:last-child")
        ?.textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    };

    const posts = document.querySelectorAll("search-media-feed > search-telemetry-tracker");
    for (let post of posts) {
      handlePost(post);
    }
    this._observers.observe("search-media-feed", "search-telemetry-tracker", handlePost);
  }

  _handleCommentsTab() {
    const handlePost = (post) => {
      const title = post.querySelector("h2").textContent.trim();
      const subreddit = post.querySelector("faceplate-hovercard a").textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    };

    setTimeout(() => {
      let query = "#main-content > div > search-telemetry-tracker";
      if (location.pathname.startsWith("/r/"))
        // If searching in a subreddit, the first two elements are not posts
        query += ":nth-child(n+3)";

      const posts = document.querySelectorAll(query);
      for (let post of posts) {
        handlePost(post);
      }
    }, 300);
    this._observers.observe("#main-content > div", "search-telemetry-tracker", handlePost);
  }

  _handleCommunitiesTab() {
    const handleCommunity = (community) => {
      const subreddit = community.querySelector("h2").textContent.trim();
      ContentHandler.handleSubreddit(community, subreddit);
    };

    const communities = document.querySelectorAll("#main-content > div > search-telemetry-tracker");
    for (let community of communities) {
      handleCommunity(community);
    }
    this._observers.observe("#main-content > div", "search-telemetry-tracker", (community) => {
      handleCommunity(community);
    });
  }
}

class NewRedditHomepageHandler {
  /**
   * @param {URL} url
   */
  constructor(url) {
    this.url = url;
    this._observers = new DomObserver();
  }

  handle() {
    this._handleCommunities();
    this._handleTopCarousel();
    this._handleFeed();
  }

  stop() {
    this._observers.stopAll();
  }

  _handleCommunities() {
    const list = document.querySelector("#popular-communities-list > ul");
    if (list === null) return;

    for (let subreddit of list.querySelectorAll("li")) {
      const name = subreddit.querySelector(".text-neutral-content").textContent.trim();
      ContentHandler.handleSubreddit(subreddit, name);
    }
  }

  _handleTopCarousel() {
    const carouselPosts = document.querySelectorAll("shreddit-gallery-carousel * > li");
    for (let post of carouselPosts) {
      const title = post.querySelector("h2").textContent.trim();
      const subreddit = post.querySelector("span.font-bold").textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    }
  }

  _handleFeed() {
    const posts = document.querySelectorAll("shreddit-feed article");
    for (let post of posts) {
      handlePost(post);
    }
    // Homepage in new Reddit is initially rendered with only 3 articles
    this._observers.observe("shreddit-feed", "article", handlePost);
  }
}

class NewRedditSubredditHandler {
  /**
   * @param {URL} url
   */
  constructor(url) {
    this.url = url;
    this._observers = new DomObserver();
  }

  handle() {
    this._handleTopCarousel();
    this._handleFeed();
  }

  stop() {
    this._observers.stopAll();
  }

  _handleFeed() {
    const posts = document.querySelectorAll("shreddit-feed article");
    for (let post of posts) {
      handlePost(post);
    }
    // Subreddits in new Reddit are initially rendered with only 3 articles
    // and its dynamically articles content is inside a subcomponent that is lazy-loaded
    // Content is loaded in batches.
    this._observers.observe("shreddit-feed", "faceplate-batch", (batch) => {
      const posts = batch.querySelectorAll("article");
      for (let post of posts) {
        handlePost(post);
      }
    });
  }

  _handleTopCarousel() {
    const carouselPosts = document.querySelectorAll("shreddit-gallery-carousel > li");
    for (let post of carouselPosts) {
      const title = post.querySelector("h2").textContent.trim();
      ContentHandler.handlePost(post, title, false, undefined);
    }
  }
}

class NewRedditPostHandler {
  /**
   * @param {URL} url
   */
  constructor(url) {
    this.url = url;
  }

  handle() {
    this._handleRecommendedPosts();
  }

  stop() {}

  _handleRecommendedPosts() {
    const recommendedPosts = document.querySelector("faceplate-tracker ul");
    if (recommendedPosts === null) {
      // Incosistent element, can't use mutation observer
      return setTimeout(this._handleRecommendedPosts.bind(this), 100);
    }

    for (let post of recommendedPosts.children) {
      const title = post.querySelector("h3").textContent.trim();
      const subreddit = post
        .querySelector("faceplate-hovercard a div:last-child")
        .textContent.trim();

      ContentHandler.handlePost(post, title, false, subreddit);
    }
  }
}
