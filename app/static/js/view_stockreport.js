console.log("✅ view_stockreport.js loaded");

// Ensure buttons are bound when they appear
function tryBindButtons() {
  const editBtn = document.getElementById("edit-all-btn");
  const saveBtn = document.getElementById("save-stockreport-btn");

  if (editBtn && !editBtn.dataset.bound) {
    editBtn.addEventListener("click", toggleHeaderEdit);
    editBtn.dataset.bound = "true";
    console.log("✅ Edit All button bound");
  }

  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.addEventListener("click", saveAllStockreportFields);
    saveBtn.dataset.bound = "true";
    console.log("✅ Save button bound");
  }
}

// Initial check
tryBindButtons();

// Observe for dynamic content (modals, etc.)
const observer = new MutationObserver(() => {
  tryBindButtons();
});

observer.observe(document.body, { childList: true, subtree: true });


// ----- Toggle Edit Mode -----
function toggleHeaderEdit() {
  console.log("🔁 toggleHeaderEdit triggered");

  const editFields = document.querySelectorAll(".edit-header");
  const viewFields = document.querySelectorAll(".view-mode");

  console.log("🔍 editFields found:", editFields.length);
  console.log("🔍 viewFields found:", viewFields.length);

  if (editFields.length === 0 || viewFields.length === 0) {
    console.warn("⚠️ No editable fields found — check .edit-header and .view-mode");
    return;
  }

  const isEditMode = editFields[0].classList.contains("hidden") === false;
  console.log("🔄 Current mode:", isEditMode ? "EDIT" : "VIEW");

  editFields.forEach(el => el.classList.toggle("hidden", isEditMode));
  viewFields.forEach(el => el.classList.toggle("hidden", !isEditMode));
  toggleSaveButton(!isEditMode);
}


// ----- Show/Hide Save Button -----
function toggleSaveButton(show) {
  const saveBtn = document.getElementById("save-stockreport-btn");
  if (saveBtn) {
    saveBtn.classList.toggle("hidden", !show);
  }
}


// ----- Save All Edited Fields -----
function saveAllStockreportFields() {
  const rows = document.querySelectorAll("[data-entry-id]");
  const headerInputs = document.querySelectorAll(".edit-header input, .edit-header select");

  const headerData = {};
  headerInputs.forEach(input => {
    headerData[input.name] = input.value;
  });

  const promises = [];

  rows.forEach(row => {
    const entryId = row.dataset.entryId;
    const rowInputs = row.querySelectorAll("input, select");

    const formData = new FormData();

    // Add row-specific data
    rowInputs.forEach(input => {
      if (input.name && input.value != null) {
        formData.append(input.name, input.value);
      }
    });

    // Add shared header fields
    for (let key in headerData) {
      if (headerData[key] != null) {
        formData.append(key, headerData[key]);
      }
    }

    promises.push(
      fetch(`/stockreport/edit/${entryId}`, {
        method: "POST",
        body: formData
      })
    );
  });

  Promise.all(promises)
    .then(responses => {
      if (responses.every(res => res.ok)) {
        alert("✅ All changes saved");
        location.reload();
      } else {
        alert("⚠️ Some entries failed to save");
      }
    })
    .catch(err => {
      console.error("❌ Save error:", err);
      alert("❌ Error saving changes");
    });
}
