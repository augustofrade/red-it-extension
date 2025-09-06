const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
Element.prototype.on = Element.prototype.addEventListener;

/**
 * Wrapper for displaying alert messages to the user with a chosen alert element.
 */
class Alert {
  timeout = null;

  static ExtensionSettings(message, isError = false) {
    this._showAlert($("#settings-extension-alert"), message, isError);
  }

  static Settings(message, isError = false) {
    this._showAlert($("#settings-alert"), message, isError);
  }

  static _showAlert(alertEl, message, isError = false) {
    this.hideAllAlerts();
    alertEl.innerText = message;
    alertEl.classList.remove("d-none");
    const styleClass = isError ? "alert-danger" : "alert-success";
    alertEl.classList.add(styleClass);

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    this.timeout = setTimeout(() => {
      alertEl.classList.add("d-none");
      alertEl.classList.remove(styleClass);
    }, 2500);
  }

  static hideAllAlerts() {
    $$(".alert").forEach((el) => {
      if (!el.classList.contains("d-none")) {
        el.classList.add("d-none");
      }
    });
  }
}

/**
 * Handles the "Delete Data" button functionality.
 */
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
    StorageManager.clear()
      .then(() => {
        $("#general-settings-form").reset();
        Alert.ExtensionSettings("All extension data cleared.");
      })
      .catch((err) => {
        console.log(err);
        Alert.ExtensionSettings("Error clearing extension data.", true);
      });
  }
}

/**
 * Handles the "Reset Metrics" button functionality.
 */
class ExtensionMetricsResetOption {
  static init() {
    this.button = $("#reset-metrics-btn");
    this.button.on("click", this._showConfirmationModal.bind(this));
  }

  static _showConfirmationModal() {
    const confirmed = window.confirm(
      "Are you sure you want to reset all metrics collected by the extension? This action cannot be undone."
    );
    if (confirmed) {
      this._resetMetrics();
    }
  }

  static _resetMetrics() {
    StorageManager.remove("metrics")
      .then(() => {
        Alert.ExtensionSettings("Extension metrics reset.");
      })
      .catch((err) => {
        console.log(err);
        Alert.ExtensionSettings("Error resetting extension metrics.", true);
      });
  }
}

/**
 * Handles storage operations using the browser's storage API.
 * Serves as a wrapper around browser.storage.sync methods.
 */
class StorageManager {
  static set(keyValuePair) {
    return browser.storage.sync.set(keyValuePair);
  }

  static get(keys) {
    return browser.storage.sync.get(keys);
  }

  static clear() {
    return browser.storage.sync.clear();
  }

  static remove(keys) {
    return browser.storage.sync.remove(keys);
  }
}

/**
 * Manages the user interaction with the extension settings form,
 * including loading existing settings into it.
 */
class GeneralSettingsForm {
  static init() {
    this._load();

    $("#submit-btn--general").on("click", function (e) {
      e.preventDefault();
      const values = new FormData($("#general-settings-form"));
      const postBlocklist = values.get("post-blocklist") ?? "";
      const hideNsfw = values.get("hide-nsfw-checkbox") === "on";
      const subredditBlocklist = values.get("subreddit-blocklist") ?? "";
      const blockPremiumAds = values.get("block-premium-ads") === "on";
      const blockComments = values.get("comment-blocking-enabled-checkbox") === "on";
      const commentBlockingBehavior =
        values.get("comment-blocking-whole") === "on" ? "all" : "text";
      const logUsage = $("#log-usage-checkbox").checked;

      GeneralSettingsForm.saveChanges({
        postBlocklist,
        subredditBlocklist,
        hideNsfw,
        logUsage,
        blockPremiumAds,
        commentBlocking: {
          enabled: blockComments,
          behavior: commentBlockingBehavior,
        },
      });
    });
  }

  static saveChanges(data) {
    let { postBlocklist, subredditBlocklist } = data;
    if (postBlocklist.trim().length === 0) {
      postBlocklist = [];
    } else {
      postBlocklist = postBlocklist
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replaceAll("*", ".*")
        .split("\n")
        .map((item) => item.trim());
    }

    if (subredditBlocklist.trim().length === 0) {
      subredditBlocklist = [];
    } else {
      subredditBlocklist = subredditBlocklist.split("\n").map((item) => item.trim());
    }

    StorageManager.set({ ...data, postBlocklist, subredditBlocklist })
      .then(() => {
        Alert.Settings("Changes saved.");
      })
      .catch((err) => {
        console.log(err);
        Alert.Settings("Error saving changes.", true);
      });
  }

  static setFormValues(values) {
    const { commentBlocking: comment } = values;
    $("#post-blocklist").value = values.postBlocklist
      .join("\n")
      .replace(/\\/g, "")
      .replaceAll(".*", "*");
    $("#block-premium-ads").checked = values.blockPremiumAds;
    $("#subreddit-blocklist").value = values.subredditBlocklist.join("\n");
    $("#hide-nsfw-checkbox").checked = values.hideNsfw;
    $("#log-usage-checkbox").checked = values.logUsage;
    $("#comment-blocking-enabled-checkbox").checked = comment.enabled;
    $(`#comment-blocking-whole`).checked = comment.behavior === "all";
  }

  static async _load() {
    const data = await StorageManager.get([
      "postBlocklist",
      "hideNsfw",
      "subredditBlocklist",
      "logUsage",
      "commentBlocking",
      "blockPremiumAds",
    ]);

    const postBlocklist = data.postBlocklist || [];
    const subredditBlocklist = data.subredditBlocklist || [];
    const hideNsfw = data.hideNsfw ?? false;
    const logUsage = data.logUsage ?? false;
    const blockPremiumAds = data.blockPremiumAds ?? false;

    const commentBlocking =
      data.commentBlocking === undefined || Object.keys(data.commentBlocking).length == 0
        ? { enabled: true, behavior: "all" }
        : data.commentBlocking;

    this.setFormValues({
      postBlocklist,
      subredditBlocklist,
      hideNsfw,
      logUsage,
      commentBlocking,
      blockPremiumAds,
    });
  }
}

class QuickSettings {
  static async init() {
    Promise.all([
      browser.runtime.sendMessage("get-mode"),
      browser.runtime.sendMessage("list-modes"),
    ])
      .then(([mode, modeList]) => {
        this._currentMode = mode;
        this._initExtensionModeSelector(modeList, mode);
      })
      .catch((err) => {
        console.error(err);
        alert("Error initializing quick settings. Please try reloading the page.");
      });
  }

  static _initExtensionModeSelector(modes, currentMode) {
    const selector = $("#extension-mode-options");
    for (const [modeKey, modeDesc] of Object.entries(modes)) {
      const option = document.createElement("div");
      if (modeKey === currentMode) {
        option.classList.add("selected");
      }
      option.dataset.value = modeKey;
      option.title = modeDesc;
      option.classList.add("extension-mode-option");
      option.innerText = modeKey.charAt(0).toUpperCase() + modeKey.slice(1);
      option.on("click", this._setCurrentMode.bind(this, modeKey));

      selector.appendChild(option);
    }
  }

  static _setCurrentMode(mode) {
    if (this._currentMode === mode) return;

    browser.runtime.sendMessage({ type: "set-mode", newMode: mode }).then((_) => {
      this._currentMode = mode;
      for (let option of $$(".extension-mode-option")) {
        option.classList.remove("selected");
        if (option.dataset.value === mode) option.classList.add("selected");
      }
    });
  }
}

// Main execution
(async function () {
  Alert.hideAllAlerts();
  GeneralSettingsForm.init();
  ExtensionDataResetOption.init();
  ExtensionMetricsResetOption.init();
  await QuickSettings.init();
})();
