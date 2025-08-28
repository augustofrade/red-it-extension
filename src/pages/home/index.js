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
        $("#settings-form").reset();
        Alert.ExtensionSettings("All extension data cleared.");
      })
      .catch((err) => {
        console.log(err);
        Alert.ExtensionSettings("Error clearing extension data.", true);
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
}

/**
 * Manages the user interaction with the extension settings form,
 * including loading existing settings into it.
 */
class ExtensionSettingsForm {
  static init() {
    this.load();

    $("#submit-btn").on("click", function (e) {
      e.preventDefault();
      const values = new FormData($("#settings-form"));
      const postBlocklist = values.get("post-blocklist") ?? "";
      const hideNsfw = values.get("hide-nsfw-checkbox") === "on";
      const subredditBlocklist = values.get("subreddit-blocklist") ?? "";

      ExtensionSettingsForm.saveChanges({
        postBlocklist,
        subredditBlocklist,
        hideNsfw,
      });
    });
  }

  static saveChanges(data) {
    let { postBlocklist, subredditBlocklist, hideNsfw } = data;
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

    StorageManager.set({ postBlocklist, subredditBlocklist, hideNsfw })
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
  }

  static async load() {
    const datta = await StorageManager.get(["postBlocklist", "hideNsfw", "subredditBlocklist"]);
    const postBlocklist = datta.postBlocklist || [];
    const subredditBlocklist = datta.subredditBlocklist || [];
    const hideNsfw = datta.hideNsfw || false;
    this.setFormValues({ postBlocklist, subredditBlocklist, hideNsfw });
  }
}

// Main execution
ExtensionSettingsForm.init();
ExtensionDataResetOption.init();
