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
      case "posts":
        this._handlePostsTab();
        break;
      case "communities":
        this._handleCommunitiesTab();
        break;
    }
  }

  _handlePostsTab() {
    const handlePost = (post) => {
      const title = post.querySelector("div > a").textContent.trim();
      const subreddit = post.querySelector(".truncate").textContent.trim();
      ContentHandler.handlePost(post, title, false, subreddit);
    };

    const posts = document.querySelectorAll("#main-content > div > search-telemetry-tracker");
    for (let post of posts) {
      handlePost(post);
    }
    this._observers.observe("#main-content > div", "search-telemetry-tracker", handlePost);
  }

  _handleCommunitiesTab() {
    const handleCommunity = (community) => {
      const subreddit = community.querySelector("h2").textContent.trim();
      if (ContentHandler.isSubredditBlocked(subreddit)) {
        community.remove();
      }
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
  }

  _handleCommunities() {
    const list = document.querySelector("#popular-communities-list > ul");
    if (list === null) return;

    for (let subreddit of list.querySelectorAll("li")) {
      const name = subreddit.querySelector(".text-neutral-content").textContent.trim();
      if (ContentHandler.isSubredditBlocked(name)) {
        list.removeChild(subreddit);
      }
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
    const handlePost = (post) => {
      const title = post.querySelector("faceplate-screen-reader-content").textContent.trim();
      const subreddit = post.querySelector("faceplate-hovercard a > span")?.textContent;
      ContentHandler.handlePost(post, title, false, subreddit);
    };

    const posts = document.querySelectorAll("shreddit-feed article");
    for (let post of posts) {
      handlePost(post);
    }
    // Homepage in new Reddit is initially rendered with only 3 articles
    this._observers.observe("shreddit-feed", "article", handlePost);
  }
}
