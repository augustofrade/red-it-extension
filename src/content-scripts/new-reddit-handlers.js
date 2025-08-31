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
