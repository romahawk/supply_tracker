
console.log("✅ view_stockreport.js loaded");

window.toggleHeaderEdit = function () {
  console.log("🔁 toggleHeaderEdit triggered");

  const editFields = document.querySelectorAll('.edit-header');
  const viewFields = document.querySelectorAll('.view-mode');

  if (editFields.length === 0 || viewFields.length === 0) {
    console.warn("⚠️ No .edit-header or .view-mode elements found");
    return;
  }

  const isEditMode = !editFields[0].classList.contains("hidden");

  editFields.forEach(el => {
    el.classList[isEditMode ? 'add' : 'remove']("hidden");
  });

  viewFields.forEach(el => {
    el.classList[isEditMode ? 'remove' : 'add']("hidden");
  });

  toggleSaveButton(!isEditMode);

  console.log(`🔄 Mode: ${isEditMode ? "VIEW" : "EDIT"}`);
};

function toggleSaveButton(show) {
  const saveBtn = document.getElementById("save-stockreport-btn");
  if (saveBtn) {
    saveBtn.classList.toggle("hidden", !show);
  }
}

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
    const rowInputs = row.querySelectorAll(".edit-header input, .edit-header select");

    const formData = new FormData();

    // Add row-specific data
    rowInputs.forEach(input => formData.append(input.name, input.value));

    // Add shared header fields
    for (let key in headerData) {
      formData.append(key, headerData[key]);
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
        location.reload(); // Reload the page or modal
      } else {
        alert("⚠️ Some entries failed to save");
      }
    })
    .catch(err => {
      console.error("❌ Save error:", err);
      alert("❌ Error saving changes");
    });
}

document.addEventListener("click", function (e) {
  if (e.target && e.target.id === "edit-all-btn") {
    toggleHeaderEdit();
  }

  if (e.target && e.target.id === "save-stockreport-btn") {
    saveAllStockreportFields();
  }
});
