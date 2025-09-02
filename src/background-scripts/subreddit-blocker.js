var blockedSubreddits = [];

function normalizeSubredditList(list) {
  return list?.map((item) => item.toLowerCase()) ?? [];
}

browser.storage.sync.get("subredditBlocklist").then((data) => {
  blockedSubreddits = normalizeSubredditList(data.subredditBlocklist);
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.subredditBlocklist) {
    blockedSubreddits = normalizeSubredditList(changes.subredditBlocklist.newValue);
  }
});

function blockSubredditPage(details) {
  const url = new URL(details.url);
  if (url.pathname === "/") {
    return {};
  }
  const subreddit = url.pathname.split("/")[2];
  const normalizedSubreddit = subreddit?.toLowerCase();

  if (subreddit === undefined) {
    return {};
  }

  if (blockedSubreddits.includes(normalizedSubreddit) === false) {
    return {};
  }

  const redirectUrl = browser.runtime.getURL(`pages/blocked-subreddit.html?subreddit=${subreddit}`);

  return { redirectUrl };
}

browser.webRequest.onBeforeRequest.addListener(
  blockSubredditPage,
  {
    urls: ["*://*.reddit.com/r/*"],
  },
  ["blocking"]
);
