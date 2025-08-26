const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
Element.prototype.on = Element.prototype.addEventListener;

function showStatus(message, isError = false) {
  const statusEl = $("#status");
  statusEl.innerText = message;
  statusEl.classList.remove("d-none");
  const styleClass = isError ? "danger" : "success";
  statusEl.classList.add("alert-" + styleClass);
}

function saveChanges(data) {
  let { postBlocklist, subredditBlocklist, hideNsfw } = data;
  postBlocklist = postBlocklist
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*")
    .split("\n")
    .map((item) => item.trim());
  if (typeof postBlocklist === "string") {
    postBlocklist = [postBlocklist.trim()];
  }

  subredditBlocklist = subredditBlocklist
    .split("\n")
    .map((item) => item.trim());
  if (typeof subredditBlocklist === "string") {
    subredditBlocklist = [subredditBlocklist.trim()];
  }

  browser.storage.sync
    .set({ postBlocklist, subredditBlocklist, hideNsfw })
    .then(() => {
      showStatus("Changes saved.");
    })
    .catch((err) => {
      console.log(err);
      showStatus("Error saving changes.", true);
    });
}

function setFormValues(values) {
  $("#post-blocklist").value = values.postBlocklist
    .join("\n")
    .replace(/\\/g, "")
    .replace(".*", "*");
  $("#subreddit-blocklist").value = values.subredditBlocklist.join("\n");
  $("#hide-nsfw-checkbox").checked = values.hideNsfw;
}

browser.storage.sync
  .get(["postBlocklist", "hideNsfw", "subredditBlocklist"])
  .then((res) => {
    console.log(res);
    const postBlocklist = res.postBlocklist || [];
    const subredditBlocklist = res.subredditBlocklist || [];
    const hideNsfw = res.hideNsfw || false;
    setFormValues({ postBlocklist, subredditBlocklist, hideNsfw });
  });

$("#submit-btn").on("click", function (e) {
  e.preventDefault();
  const postBlocklist = $("#post-blocklist").value;
  const hideNsfw = $("#hide-nsfw-checkbox").checked;
  const subredditBlocklist = $("#subreddit-blocklist").value;

  saveChanges({
    postBlocklist,
    subredditBlocklist,
    hideNsfw,
  });
});
