const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
Element.prototype.on = Element.prototype.addEventListener;

function showStatus(message, isError = false) {
  const statusEl = $("#status");
  statusEl.innerText = message;
  statusEl.classList.remove("d-none");
  const styleClass = isError ? "alert-danger" : "alert-success";
  statusEl.classList.add("alert-" + styleClass);
}

function saveChanges(rawList) {
  rawList = rawList.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const list = rawList.split("\n").map((item) => item.trim());

  browser.storage.sync
    .set({ blocklist: list })
    .then(() => {
      showStatus("Changes saved.");
    })
    .catch((err) => {
      console.log(err);
      showStatus("Error saving changes.", true);
    });
}

$("#submit-btn").on("click", function (e) {
  e.preventDefault();
  const rawList = $("#blocklist").value;
  saveChanges(rawList);
});
