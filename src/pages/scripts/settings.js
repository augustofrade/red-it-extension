const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
Element.prototype.on = Element.prototype.addEventListener;

/**
 * Wrapper for displaying alert messages to the user with a chosen alert element.
 */
class Alert {
  timeout = null;

  static ExtensionSettings(message, isError = false) {
    this._showAlert($("#settings-alert-extension"), message, isError);
  }

  static Settings(message, isError = false) {
    this._showAlert($("#settings-alert"), message, isError);
  }

  static OldRedditSettings(message, isError = false) {
    this._showAlert($("#settings-alert--old-reddit"), message, isError);
  }

  static NewRedditSettings(message, isError = false) {
    this._showAlert($("#settings-alert--new-reddit"), message, isError);
  }

  static _showAlert(alertEl, message, isError = false) {
    this._resetAllAlerts();
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

  static _resetAllAlerts() {
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
        $("#general-settings-form").clear();
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
      const logUsage = values.get("log-usage-checkbox") === "on";

      GeneralSettingsForm.saveChanges({
        postBlocklist,
        subredditBlocklist,
        hideNsfw,
        logUsage,
      });
    });
  }

  static saveChanges(data) {
    let { postBlocklist, subredditBlocklist, hideNsfw, logUsage } = data;
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

    StorageManager.set({ postBlocklist, subredditBlocklist, hideNsfw, logUsage })
      .then(() => {
        Alert.Settings("Changes saved.");
      })
      .catch((err) => {
        console.log(err);
        Alert.Settings("Error saving changes.", true);
      });
  }

  static setFormValues(values) {
    $("#post-blocklist").value = values.postBlocklist
      .join("\n")
      .replace(/\\/g, "")
      .replace(".*", "*");
    $("#subreddit-blocklist").value = values.subredditBlocklist.join("\n");
    $("#hide-nsfw-checkbox").checked = values.hideNsfw;
    $("#log-usage-checkbox").checked = values.logUsage;
  }

  static async _load() {
    const data = await StorageManager.get([
      "postBlocklist",
      "hideNsfw",
      "subredditBlocklist",
      "logUsage",
    ]);
    const postBlocklist = data.postBlocklist || [];
    const subredditBlocklist = data.subredditBlocklist || [];
    const hideNsfw = data.hideNsfw ?? false;
    const logUsage = data.logUsage ?? false;
    this.setFormValues({ postBlocklist, subredditBlocklist, hideNsfw, logUsage });
  }
}

class OldRedditSettingsForm {
  static init() {
    this._load();

    $("#submit-btn--old-reddit").on("click", function (e) {
      e.preventDefault();
      const values = new FormData($("#old-reddit-settings-form"));
      const hidePremiumAd = values.get("old-reddit--hide-premium-ad") === "on";

      OldRedditSettingsForm.saveChanges({ hidePremiumAd });
    });
  }

  static saveChanges(data) {
    StorageManager.set({
      oldReddit: {
        hidePremiumAd: data.hidePremiumAd,
      },
    })
      .then(() => {
        Alert.OldRedditSettings("Changes saved.");
      })
      .catch((err) => {
        console.log(err);
        Alert.OldRedditSettings("Error saving changes.", true);
      });
  }

  static setFormValues(values) {
    $("#old-reddit--hide-premium-ad").checked = values.hidePremiumAd;
  }

  static async _load() {
    const result = await StorageManager.get("oldReddit");
    const { oldReddit: data } = result;

    const hidePremiumAd = data.hidePremiumAd ?? false;
    this.setFormValues({ hidePremiumAd });
  }
}

class NewRedditSettingsForm {
  static init() {
    this._load();

    $("#submit-btn--new-reddit").on("click", function (e) {
      e.preventDefault();
      const values = new FormData($("#new-reddit-settings-form"));
      const hidePremiumAd = values.get("new-reddit--hide-premium-ad") === "on";

      NewRedditSettingsForm.saveChanges({ hidePremiumAd });
    });
  }

  static saveChanges(data) {
    StorageManager.set({
      newReddit: {
        hidePremiumAd: data.hidePremiumAd,
      },
    })
      .then(() => {
        Alert.NewRedditSettings("Changes saved.");
      })
      .catch((err) => {
        console.log(err);
        Alert.NewRedditSettings("Error saving changes.", true);
      });
  }

  static setFormValues(values) {
    $("#new-reddit--hide-premium-ad").checked = values.hidePremiumAd;
  }

  static async _load() {
    const result = await StorageManager.get("newReddit");
    const { newReddit: data } = result;

    if (data === undefined) return;

    const hidePremiumAd = data.hidePremiumAd ?? false;
    this.setFormValues({ hidePremiumAd });
  }
}

// Main execution
GeneralSettingsForm.init();
ExtensionDataResetOption.init();
ExtensionMetricsResetOption.init();
OldRedditSettingsForm.init();
NewRedditSettingsForm.init();
