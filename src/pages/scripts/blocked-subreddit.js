const subreddit = new RegExp("subreddit=(\\w+)").exec(location.href)[1];

document.title = `Red-It - r/${subreddit} Blocked`;
document.querySelector("h1").textContent = `r/${subreddit} is blocked`;

document.getElementById("settings-anchor").href = browser.runtime.getURL("pages/dashboard.html");
