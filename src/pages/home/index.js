const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
Element.prototype.on = Element.prototype.addEventListener;

class Status {
  static ExtensionSettings(message, isError = false) {
    this._showStatus($("#settings-status-extension"), message, isError);
  }

  static Settings(message, isError = false) {
    this._showStatus($("#settings-status"), message, isError);
  }

  static _showStatus(statusEl, message, isError = false) {
    this._resetAllAlerts();
    statusEl.innerText = message;
    statusEl.classList.remove("d-none");
    const styleClass = isError ? "danger" : "success";
    statusEl.classList.add("alert-" + styleClass);
  }

  static _resetAllAlerts() {
    $$(".alert").forEach((el) => {
      if (!el.classList.contains("d-none")) {
        el.classList.add("d-none");
      }
    });
  }
}

class ExtensionDataResetOption {
  static init() {
    this.button = $("#reset-data-btn");
    this.button.on("click", this._showConfirmationModal.bind(this));
  }

  static _showConfirmationModal() {
    const confirmed = window.confirm(
      "Are you sure you want to delete all extension data? This action cannot be undone."
    );
    if (confirmed) {
      this._clearData();
    }
  }

  static _clearData() {
    browser.storage.sync
      .clear()
      .then(() => {
        Status.ExtensionSettings("All extension data cleared.");
      })
      .catch((err) => {
        console.log(err);
        Status.ExtensionSettings("Error clearing extension data.", true);
      });
  }
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
      Status.Settings("Changes saved.");
    })
    .catch((err) => {
      console.log(err);
      Status.Settings("Error saving changes.", true);
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

ExtensionDataResetOption.init();
