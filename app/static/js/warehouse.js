function openStockReport(entryId) {
  fetch(`/stockreport/view/${entryId}`)
    .then(res => res.text())
    .then(html => {
      const modal = document.getElementById('modal-body');  // adjust if needed
      modal.innerHTML = html;

      // ✅ Attach editing logic after content is injected
      const script = document.createElement('script');
      script.src = '/static/js/view_stockreport.js';
      script.onload = () => console.log("✅ Stockreport script loaded.");
      document.body.appendChild(script);
    })
    .catch(err => {
      console.error("❌ Could not load stockreport:", err);
      alert("Failed to open stockreport modal.");
    });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".open-stockreport-modal").forEach(button => {
    button.addEventListener("click", () => {
      const entryId = button.getAttribute("data-item-id");
      openStockReport(entryId);
    });
  });
});
