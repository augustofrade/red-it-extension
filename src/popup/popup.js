const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
Element.prototype.on = Element.prototype.addEventListener;

var mode;

function selectMode(newMode) {
  browser.runtime
    .sendMessage({
      type: "set-mode",
      newMode,
    })
    .then(() => {
      mode = newMode;
      $(".mode-list-wrapper").classList.remove("active");
      $(".mode-list-label").textContent = `Mode: ${mode}`;
    });
}

$("#settings-btn").on("click", () => {
  browser.runtime.sendMessage("open-settings");
});

$("#about-btn").on("click", () => {
  browser.runtime.sendMessage("open-about");
});

$("#mode-btn").on("click", function () {
  this.classList.add("active");
  const modeListWrapper = $(".mode-list-wrapper");
  modeListWrapper.classList.toggle("active");

  if (modeListWrapper.classList.contains("active")) {
    $(".mode-list-label").textContent = "Select a mode";
  } else {
    $(".mode-list-label").textContent = `Mode: ${mode}`;
  }
});

browser.runtime.sendMessage("get-mode").then((currentMode) => {
  mode = currentMode;
  $(".mode-list-label").textContent = `Mode: ${mode}`;
});

browser.runtime.sendMessage("list-modes").then((modes) => {
  const modeList = $(".mode-list");

  Object.entries(modes).forEach(([mode, description]) => {
    const item = document.createElement("li");
    item.className = "menu-item mode-list-item";
    item.dataset.value = mode;
    item.title = description;
    item.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    item.on("click", () => selectMode(mode));
    modeList.appendChild(item);
  });
});

browser.storage.sync.get("metrics").then(({ metrics }) => {
  if (!metrics) {
    metrics = {
      blockedPosts: 0,
      blockedSubreddits: 0,
    };
  }

  $("#blocked-count--posts").textContent = metrics.blockedPosts;
  $("#blocked-count--subreddits").textContent = metrics.blockedSubreddits;
});
