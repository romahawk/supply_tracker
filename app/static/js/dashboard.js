let showOrderDate = true;
let showPaymentDate = true;
const pageSize = 20; // Maximum 20 orders per page
let currentPage = 1; // Track current page
let allOrders = []; // Global to store all orders
let selectedYear = null; // Global to store selected year
let visibleStatuses = ["in process", "en route", "arrived"]; // Global to store visible statuses
let chartInstance = null; // Global to store Chart.js instance
let sortDirection = { order_date: "desc" }; // Global sort direction

// isDarkMode
function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function getChartColors() {
  return {
    text: isDarkMode() ? "#E5E7EB" : "#374151", // light gray / slate
    grid: isDarkMode() ? "#4B5563" : "#D1D5DB",
    title: isDarkMode() ? "#F9FAFB" : "#111827",
  };
}

function initDarkModeToggle() {
  const toggle = document.getElementById("dark-mode-toggle");
  if (!toggle) return;

  // Load saved preference
  if (localStorage.getItem("dark-mode") === "enabled") {
    document.documentElement.classList.add("dark");
  }

  toggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    const enabled = document.documentElement.classList.contains("dark");
    localStorage.setItem("dark-mode", enabled ? "enabled" : "disabled");

    // Optional: Re-render timeline to update chart theme
    const filteredData = filterData(
      allOrders,
      document.getElementById("order-filter")?.value || ""
    );
    const sortedData = sortData(filteredData, "order_date", true);
    renderTimeline(sortedData, currentPage);
  });
}

// Helper functions needed by filterData and renderTimeline
function parseDate(dateStr) {
  try {
    if (!dateStr || typeof dateStr !== "string") {
      console.error(`parseDate: Invalid date string: ${dateStr}`);
      throw new Error("Invalid date string");
    }
    // Handle both dd.mm.yy and yyyy-mm-dd formats
    let day, month, year;
    if (dateStr.includes(".")) {
      [day, month, year] = dateStr.split(".").map(Number);
      year = 2000 + year;
    } else if (dateStr.includes("-")) {
      [year, month, day] = dateStr.split("-").map(Number);
    } else {
      throw new Error("Unsupported date format");
    }
    if (
      !day ||
      !month ||
      !year ||
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12
    ) {
      console.error(`parseDate: Invalid date components: ${dateStr}`);
      throw new Error("Invalid date components");
    }
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) {
      console.error(`parseDate: Invalid date: ${dateStr}`);
      throw new Error("Invalid date");
    }
    console.log(`parseDate: Successfully parsed ${dateStr} to ${date}`);
    return date;
  } catch (error) {
    console.error(`parseDate: Error parsing date: ${dateStr}`, error);
    return null;
  }
}

function getYearFromDate(dateStr) {
  const date = parseDate(dateStr);
  return date ? date.getFullYear() : null;
}

function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function getStartOfWeek(weekNum, year) {
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOfWeek = firstDayOfYear.getDay();
  const firstMonday =
    dayOfWeek === 1
      ? firstDayOfYear
      : new Date(
          firstDayOfYear.setDate(
            firstDayOfYear.getDate() + ((8 - dayOfWeek) % 7)
          )
        );
  const startOfWeek = new Date(firstMonday);
  startOfWeek.setDate(startOfWeek.getDate() + (weekNum - 1) * 7);
  return startOfWeek;
}

// Filter data function
function filterData(data, query) {
  console.log(
    `filterData: Called with query: "${query}", selectedYear: ${selectedYear}, visibleStatuses: ${visibleStatuses}`
  );
  if (!data || !Array.isArray(data)) {
    console.warn("filterData: Invalid or empty data array");
    return [];
  }
  query = query.toLowerCase().trim();
  const filtered = data.filter((order) => {
    // Log order details for debugging
    console.log(
      `filterData: Processing order: ${order.order_number || "unknown"}, ETD: ${
        order.etd
      }, Transit Status: ${order.transit_status}`
    );

    // Check year filter
    const orderYear =
      parseInt(order.delivery_year) || getYearFromDate(order.etd);
    if (!orderYear || (selectedYear && orderYear !== parseInt(selectedYear))) {
      console.log(
        `filterData: Order ${order.order_number} excluded - Year mismatch: ${orderYear} !== ${selectedYear}`
      );
      return false;
    }

    // Check transit status
    if (!visibleStatuses.includes(order.transit_status)) {
      console.log(
        `filterData: Order ${order.order_number} excluded - Status not visible: ${order.transit_status}`
      );
      return false;
    }

    // Filter by query (order_date and order_number)
    let orderDate = order.order_date || "";
    // Normalize order_date to dd.mm.yy if in yyyy-mm-dd
    if (orderDate.includes("-")) {
      const [year, month, day] = orderDate.split("-");
      orderDate = `${day}.${month}.${year.slice(-2)}`;
    }
    const orderNumber = (order.order_number || "").toLowerCase();
    orderDate = orderDate.toLowerCase();
    const matches = query
      ? orderNumber.includes(query) || orderDate.includes(query)
      : true; // Empty query returns all matching year/status

    console.log(
      `filterData: Order ${order.order_number} - Date: ${orderDate}, Number: ${orderNumber}, Query: ${query}, Matches: ${matches}`
    );
    return matches;
  });
  console.log(`filterData: Returned ${filtered.length} orders`);
  return filtered;
}

// Render timeline function
function renderTimeline(data, page = 1) {
  console.log(
    "renderTimeline: Function called with data:",
    data,
    "Page:",
    page
  );
  const loadingIndicator = document.getElementById("timeline-loading");
  const canvas = document.getElementById("timelineChart");

  if (!canvas) {
    console.error("renderTimeline: Canvas element not found");
    return;
  }

  if (loadingIndicator) loadingIndicator.style.display = "block";
  canvas.style.display = "none";

  if (!Array.isArray(data) || data.length === 0) {
    console.warn("renderTimeline: No data provided");
    if (loadingIndicator) {
      loadingIndicator.textContent =
        data.length === 0
          ? `No orders found for ${selectedYear || "selected year"}`
          : `Loading...`;
      loadingIndicator.style.display = "block";
    }
    canvas.style.display = "none";
    return;
  }

  // Paginate data
  const start = (page - 1) * pageSize;
  const paginatedData = data.slice(start, start + pageSize);
  console.log("renderTimeline: Paginated data:", paginatedData);

  const year = parseInt(selectedYear) || new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const chartData = [];
  const labels = [];
  let displayIndex = 0;

  paginatedData.forEach((order) => {
    const startDate = parseDate(order.etd);
    const endDate = order.ata ? parseDate(order.ata) : parseDate(order.eta);

    if (!startDate || !endDate) return;

    const orderYear = parseInt(order.delivery_year) || getYearFromDate(order.etd);
    if (orderYear !== year) return;


    const clippedStartDate = startDate < yearStart ? yearStart : startDate;
    const clippedEndDate = endDate > yearEnd ? yearEnd : endDate;

    const status = (order.transit_status || '').toLowerCase().trim();

    const color =
      {
        "in process": "rgba(255, 165, 0, 0.8)",
        "en route": "rgba(0, 123, 255, 0.8)",
        "arrived": "rgba(144, 238, 144, 0.8)",
      }[status] || "rgba(128, 128, 128, 0.8)";


    chartData.push({
      x: [clippedStartDate, clippedEndDate],
      y: displayIndex,
      backgroundColor: color,
      borderColor: color.replace("0.8", "1"),
      borderWidth: 1,
    });

    const transportIcon =
      {
        sea: "🚢",
        air: "✈️",
        truck: "🚚",
      }[order.transport] || order.transport;

    labels.push(
      `${transportIcon} ${order.product_name} (${order.order_number})`
    );
    displayIndex += 1;
  });

  if (chartData.length === 0) {
    console.warn("renderTimeline: No valid orders to display");
    if (loadingIndicator) {
      loadingIndicator.textContent = `No valid orders for ${
        selectedYear || "selected year"
      }`;
      loadingIndicator.style.display = "block";
    }
    canvas.style.display = "none";
    return;
  }

  // Dynamic canvas height
  const heightPerOrder = 50;
  const headerHeight = 50;
  const canvasHeight = Math.max(
    100,
    chartData.length * heightPerOrder + headerHeight
  );
  canvas.style.height = `${canvasHeight}px`;

  // Show/hide Load More and Back buttons
  const loadMoreBtn = document.getElementById("load-more-btn");
  const backBtn = document.getElementById("back-btn");
  if (loadMoreBtn) {
    loadMoreBtn.style.display =
      data.length > page * pageSize ? "block" : "none";
  } else {
    console.warn("renderTimeline: Load More button not found");
  }
  if (backBtn) {
    backBtn.style.display = page > 1 ? "block" : "none";
  } else {
    console.warn("renderTimeline: Back button not found");
  }

  if (loadingIndicator) loadingIndicator.style.display = "none";
  canvas.style.display = "block";

  const today = new Date();
  const currentWeek = getWeekNumber(today);
  const startOfWeek = getStartOfWeek(currentWeek, today.getFullYear());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const ctx = canvas.getContext("2d");
  if (chartInstance) chartInstance.destroy();

  const colors = getChartColors();

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Orders Timeline",
          data: chartData,
          backgroundColor: chartData.map((item) => item.backgroundColor),
          borderColor: chartData.map((item) => item.borderColor),
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",

      scales: {
        x: {
          type: "time",
          time: {
            unit: "week",
            tooltipFormat: "dd.MM.yyyy",
          },
          min: yearStart,
          max: yearEnd,
          title: {
            display: true,
            text: "Timeline",
            font: { size: 16, weight: "600" },
            color: colors.title,
          },
          ticks: {
            callback: (value) => `W${getWeekNumber(new Date(value))}`,
            color: colors.text,
            font: { size: 12, weight: "500" },
            autoSkip: true,
            maxRotation: 0,
          },
          grid: {
            color: colors.grid,
            borderColor: colors.grid,
            tickColor: colors.grid,
            lineWidth: 1,
          },
        },
        y: {
          min: 0,
          max: chartData.length - 1,
          ticks: {
            callback: (_, i) => labels[i],
            color: colors.text,
            font: { size: 12, weight: "500" },
            autoSkip: false,
          },
          grid: {
            display: false,
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (context) {
              const [start, end] = context.raw.x;
              const startDate = new Date(start).toLocaleDateString();
              const endDate = new Date(end).toLocaleDateString();
              return `Delivery: ${startDate} → ${endDate}`;
            },
          },
        },
        annotation: {
          annotations: {
            currentWeek: {
              type: "box",
              xMin: startOfWeek,
              xMax: endOfWeek,
              yMin: 0,
              yMax: chartData.length - 1,
              backgroundColor: "rgba(255,255,0,0.3)",
              borderColor: "rgba(255,255,0,0.6)",
              label: {
                enabled: true,
                content: `W${currentWeek}`,
                position: "top",
              },
            },
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  console.log("renderTimeline: Chart rendered successfully");
}

// Load more orders function
function loadMoreOrders() {
  currentPage++;
  const filteredData = filterData(
    allOrders,
    document.getElementById("order-filter")?.value || ""
  );
  const sortedData = sortData(filteredData, "order_date", true); // Force descending
  renderTimeline(sortedData, currentPage);
}

// Load previous orders function
function loadPreviousOrders() {
  if (currentPage > 1) {
    currentPage--;
    const filteredData = filterData(
      allOrders,
      document.getElementById("order-filter")?.value || ""
    );
    const sortedData = sortData(filteredData, "order_date", true); // Force descending
    renderTimeline(sortedData, currentPage);
  }
}

// Modified sortData to support forced direction
function sortData(data, key, forceDescending = false) {
  // Initialize sortDirection for the key if not set
  if (!sortDirection[key]) {
    sortDirection[key] = "desc"; // Default to descending
  }
  // Toggle direction for user-initiated sorting (e.g., header clicks)
  if (!forceDescending) {
    sortDirection[key] = sortDirection[key] === "asc" ? "desc" : "asc";
  }
  const direction = forceDescending ? "desc" : sortDirection[key];

  // Update sort indicators
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const thKey = th.getAttribute("data-sort");
    const indicator = th.querySelector(".sort-indicator");
    if (indicator) {
      if (thKey === key) {
        indicator.textContent = direction === "asc" ? "↑" : "↓";
      } else {
        indicator.textContent = "";
      }
    }
  });

  return [...data].sort((a, b) => {
    let valA = a[key] || "";
    let valB = b[key] || "";
    if (
      [
        "order_date",
        "required_delivery",
        "payment_date",
        "etd",
        "eta",
        "ata",
      ].includes(key)
    ) {
      valA = parseDate(valA) || new Date(0);
      valB = parseDate(valB) || new Date(0);
    } else if (key === "quantity") {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else {
      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();
    }
    if (direction === "asc") {
      return valA > valB ? 1 : -1;
    } else {
      return valA < valB ? 1 : -1;
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  // Set initial sort indicator for order_date
  const orderDateHeader = document.querySelector('th[data-sort="order_date"]');
  if (orderDateHeader) {
    const indicator = orderDateHeader.querySelector(".sort-indicator");
    if (indicator) indicator.textContent = "↓";
  }

  Chart.register(window["chartjs-plugin-annotation"]);

  function populateYearDropdown(orders) {
    const yearFilter = document.getElementById("year-filter");
    if (!yearFilter) {
      console.error("populateYearDropdown: Year filter dropdown not found");
      return;
    }

    const years = [
      ...new Set(
        orders
          .map((order) => parseInt(order.delivery_year))
          .filter((year) => year)
      ),
    ].sort((a, b) => b - a);
    console.log("populateYearDropdown: Unique years found:", years);

    if (years.length === 0) {
      yearFilter.innerHTML =
        '<option value="" disabled selected>No orders available</option>';
      selectedYear = null;
      return;
    }

    yearFilter.innerHTML = years
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");

    if (!selectedYear || !years.includes(parseInt(selectedYear))) {
      selectedYear = years[0].toString();
      yearFilter.value = selectedYear;
    } else {
      yearFilter.value = selectedYear;
    }
    console.log("populateYearDropdown: Selected year set to:", selectedYear);
  }

  function updateTable(data) {
    const tbody = document.querySelector("table tbody");
    if (!tbody) {
      console.error("updateTable: Table tbody not found");
      return;
    }
    tbody.innerHTML = "";
    if (data.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="15" class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200 text-center">No orders found</td>`;
      tbody.appendChild(row);
    } else {
      data.forEach((order) => {
        const transportIcon =
          {
            sea: "🚢",
            air: "✈️",
            truck: "🚚",
          }[order.transport] || order.transport;
        const row = document.createElement("tr");
        row.classList.add(
          "bg-gray-100",
          "dark:bg-gray-900",
          "hover:bg-gray-200",
          "dark:hover:bg-gray-700"
        );
        row.innerHTML = `
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200" title="Delivery Year: ${
                      order.delivery_year
                    }">${order.order_date}</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.order_number || '—'
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.product_name
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.buyer
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.responsible
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.quantity
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.required_delivery || '—'
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.terms_of_delivery || '—'
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.payment_date || '—'
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.etd || '—'
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.eta || '—'
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.ata || ""
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${
                      order.transit_status
                    }</td>
                    <td class="px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200">${transportIcon}</td>
                    <td class="px-2 py-2 text-center text-xs sm:text-sm">
                       <div class="flex flex-col sm:flex-row sm:justify-center gap-1 sm:gap-2">
                            <form class="w-full sm:w-auto">
                                <button type="button" class="edit-order bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs w-full sm:w-auto" data-id="${
                                  order.id
                                }">Edit</button>
                            </form>
                            <form class="w-full sm:w-auto">
                                <button type="button" class="delete-order bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs w-full sm:w-auto" data-id="${
                                  order.id
                                }">Delete</button>
                            </form>
                            ${
                              order.transit_status === "arrived"
                                ? `
                            <form method="POST" action="/stock_order/${order.id}" class="w-full sm:w-auto">
                                <button type="submit" class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs w-full sm:w-auto">Stock</button>
                            </form>
                            <form method="POST" action="/deliver_direct/${order.id}" class="w-full sm:w-auto">
                                <button type="submit" class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs w-full sm:w-auto">Deliver</button>
                            </form>
                            `
                                : ""
                            }
                        </div>

                    </td>

                `;
        tbody.appendChild(row);
      });
    }
    console.log("updateTable: Table updated with data:", data);
  }

  // Add a setupDashboardSearch() function
  function setupDashboardSearch() {
    const searchInput = document.getElementById("search-dashboard");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase();
      const rows = document.querySelectorAll("table tbody tr");

      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? "" : "none";
      });
    });

    initDarkModeToggle();
  }

  setupDashboardSearch(); // 🔁 Rebinds search to updated DOM

  function fetchAndRender() {
    console.log("fetchAndRender: Fetching orders from /api/orders...");
    fetch("/api/orders")
      .then((response) => {
        console.log("fetchAndRender: Fetch response received:", response);
        if (!response.ok) {
          throw new Error(
            `Network response was not ok: ${response.status} ${response.statusText}`
          );
        }
        return response.json();
      })
      .then((data) => {
        console.log("fetchAndRender: Fetched orders:", data.slice(0, 5)); // Log first 5 for brevity
        // Normalize date formats
        allOrders = data.map((order) => ({
          ...order,
          order_date: order.order_date.includes("-")
            ? order.order_date.split("-").reverse().join(".")
            : order.order_date,
          etd: order.etd.includes("-")
            ? order.etd.split("-").reverse().join(".")
            : order.etd,
          eta: order.eta.includes("-")
            ? order.eta.split("-").reverse().join(".")
            : order.eta,
          ata:
            order.ata && order.ata.includes("-")
              ? order.ata.split("-").reverse().join(".")
              : order.ata,
          required_delivery:
            order.required_delivery && order.required_delivery.includes("-")
              ? order.required_delivery.split("-").reverse().join(".")
              : order.required_delivery,
          payment_date:
            order.payment_date && order.payment_date.includes("-")
              ? order.payment_date.split("-").reverse().join(".")
              : order.payment_date,
          delivery_year: parseInt(order.delivery_year) || null, // ✅ normalized here
        }));

        populateYearDropdown(allOrders);
        if (!selectedYear) {
          console.warn(
            "fetchAndRender: No orders available to set a selected year"
          );
          updateTable([]);
          renderTimeline([]);
          return;
        }
        currentPage = 1; // Reset page on new fetch
        const filteredData = filterData(
          allOrders,
          document.getElementById("order-filter")?.value || ""
        );
        const sortedData = sortData(filteredData, "order_date", true); // Force descending
        updateTable(sortedData);
        renderTimeline(sortedData, currentPage);
      })
      .catch((error) => {
        console.error("fetchAndRender: Error fetching or rendering:", error);
        const loadingIndicator = document.getElementById("timeline-loading");
        if (loadingIndicator) {
          loadingIndicator.style.display = "none";
        }
        const canvas = document.getElementById("timelineChart");
        if (canvas) {
          canvas.style.display = "none";
        }
      });
  }

  console.log("Initial render of dashboard");
  fetchAndRender();

  document.querySelectorAll("table th[data-sort]").forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.getAttribute("data-sort");
      console.log(`Sorting by ${key}`);
      const filteredData = filterData(
        allOrders,
        document.getElementById("order-filter")?.value || ""
      );
      const sortedData = sortData(filteredData, key); // User-initiated sort toggles direction
      updateTable(sortedData);
      renderTimeline(sortedData, currentPage);
    });
  });

  const orderFilterInput = document.getElementById("order-filter");
  if (orderFilterInput) {
    orderFilterInput.addEventListener("input", (e) => {
      console.log(
        "order-filter: Input event triggered, query:",
        e.target.value
      );
      currentPage = 1; // Reset page on filter change
      const query = e.target.value;
      const filteredData = filterData(allOrders, query);
      console.log("order-filter: Filtered data length:", filteredData.length);
      const sortedData = sortData(filteredData, "order_date", true); // Force descending
      updateTable(sortedData);
      renderTimeline(sortedData, currentPage);
    });
  } else {
    console.error("order-filter: Input element not found in DOM");
  }

  document.getElementById("year-filter").addEventListener("change", (e) => {
    currentPage = 1; // Reset page on year change
    selectedYear = e.target.value;
    sortDirection = { order_date: "desc" }; // Reset sortDirection
    // Reset sort indicator
    const orderDateHeader = document.querySelector(
      'th[data-sort="order_date"]'
    );
    if (orderDateHeader) {
      const indicator = orderDateHeader.querySelector(".sort-indicator");
      if (indicator) indicator.textContent = "↓";
    }
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      if (th.getAttribute("data-sort") !== "order_date") {
        const indicator = th.querySelector(".sort-indicator");
        if (indicator) indicator.textContent = "";
      }
    });
    console.log(`Year filter changed to: ${selectedYear}`);
    const filteredData = filterData(
      allOrders,
      document.getElementById("order-filter")?.value || ""
    );
    const sortedData = sortData(filteredData, "order_date", true); // Force descending
    updateTable(sortedData);
    renderTimeline(sortedData, currentPage);
  });

  document.querySelectorAll(".legend-item").forEach((item) => {
    item.addEventListener("click", () => {
      currentPage = 1; // Reset page on status change
      const status = item.getAttribute("data-status");
      if (visibleStatuses.includes(status)) {
        visibleStatuses = visibleStatuses.filter((s) => s !== status);
        item.classList.add("opacity-50");
      } else {
        visibleStatuses.push(status);
        item.classList.remove("opacity-50");
      }
      console.log(`Legend toggled, visibleStatuses: ${visibleStatuses}`);
      const filteredData = filterData(
        allOrders,
        document.getElementById("order-filter")?.value || ""
      );
      const sortedData = sortData(filteredData, "order_date", true); // Force descending
      updateTable(sortedData);
      renderTimeline(sortedData, currentPage);
    });
  });

  const addForm = document.getElementById("add-order-form");
  if (addForm) {
    addForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const quantity = parseFloat(document.getElementById("quantity").value);
      const orderDate = document.getElementById("order_date").value;
      const etd = document.getElementById("etd").value;
      const eta = document.getElementById("eta").value;
      const requiredDelivery = document.getElementById('required_delivery').value;
        if (!requiredDelivery.trim()) {
            alert('Required Delivery cannot be empty.');
            return;
        }


      if (isNaN(quantity) || quantity <= 0) {
        alert("Quantity must be a positive number (decimals allowed).");
        return;
      }
      if (new Date(orderDate) > new Date(etd)) {
        alert("Order Date cannot be later than ETD.");
        return;
      }
      if (new Date(etd) > new Date(eta)) {
        alert("ETD cannot be later than ETA.");
        return;
      }

      const formData = new FormData(addForm);
      const dateFields = [
        "order_date",
        "required_delivery",
        "payment_date",
        "etd",
        "eta",
        "ata",
      ];
      const convertedFormData = new FormData();
      for (let [key, value] of formData.entries()) {
        if (dateFields.includes(key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const date = new Date(value);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = String(date.getFullYear()).slice(-2);
            value = `${day}.${month}.${year}`;
        }

        convertedFormData.append(key, value);
      }

      fetch("/add_order", {
        method: "POST",
        body: convertedFormData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("Order added successfully!");
            addForm.reset();
            console.log("Calling fetchAndRender after adding order");
            fetchAndRender();
          } else {
            alert("Error adding order: " + (data.message || "Unknown error"));
          }
        })
        .catch((error) => {
          console.error("Error adding order:", error);
          alert("Error adding order. Please try again.");
        });
    });
  } else {
    console.warn("add-order-form not found in the DOM");
  }

  document.addEventListener("click", function (event) {
    if (event.target.classList.contains("edit-order")) {
      event.preventDefault();
      const orderId = event.target.getAttribute("data-id");
      fetch(`/api/orders`)
        .then((response) => response.json())
        .then((data) => {
          const order = data.find((o) => o.id == orderId);
          if (order) {
            document.getElementById("edit-order-id").value = order.id;
            const dateFields = [
              "order_date",
              "required_delivery",
              "payment_date",
              "etd",
              "eta",
              "ata",
            ];
            dateFields.forEach((field) => {
              const value = order[field];
              if (value) {
                const date = parseDate(value);
                const formattedDate = date.toISOString().split("T")[0];
                document.getElementById(`edit-${field}`).value = formattedDate;
              } else {
                document.getElementById(`edit-${field}`).value = "";
              }
            });
            document.getElementById("edit-order_number").value =
              order.order_number;
            document.getElementById("edit-product_name").value =
              order.product_name;
            document.getElementById("edit-buyer").value = order.buyer;
            document.getElementById("edit-responsible").value =
              order.responsible;
            document.getElementById("edit-quantity").value = order.quantity;
            document.getElementById("edit-terms_of_delivery").value =
              order.terms_of_delivery;
            document.getElementById("edit-transit_status").value =
              order.transit_status;
            document.getElementById("edit-transport").value = order.transport;
            document.getElementById("edit-order-modal").style.display = "flex";
          }
        });
    }

    if (event.target.classList.contains("delete-order")) {
      event.preventDefault();
      if (!confirm("Are you sure you want to delete this order?")) return;

      const orderId = event.target.getAttribute("data-id");
      fetch(`/delete_order/${orderId}`, { method: "GET" })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("Order deleted successfully!");
            console.log("Calling fetchAndRender after deleting order");
            fetchAndRender();
          } else {
            alert("Error deleting order: " + (data.message || "Unknown error"));
          }
        })
        .catch((error) => {
          console.error("Error deleting order:", error);
          alert("Error deleting order. Please try again.");
        });
    }
  });

  const editForm = document.getElementById("edit-order-form");
  if (editForm) {
    editForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const quantity = parseFloat(
        document.getElementById("edit-quantity").value
      );
      const orderDate = document.getElementById("edit-order_date").value;
      const etd = document.getElementById("edit-etd").value;
      const eta = document.getElementById("edit-eta").value;

      if (isNaN(quantity) || quantity <= 0) {
        alert("Quantity must be a positive number (decimals allowed).");
        return;
      }
      if (new Date(orderDate) > new Date(etd)) {
        alert("Order Date cannot be later than ETD.");
        return;
      }
      if (new Date(etd) > new Date(eta)) {
        alert("ETD cannot be later than ETA.");
        return;
      }

      const formData = new FormData(editForm);
      const dateFields = [
        "order_date",
        "required_delivery",
        "payment_date",
        "etd",
        "eta",
        "ata",
      ];
      const convertedFormData = new FormData();
      for (let [key, value] of formData.entries()) {
        if (dateFields.includes(key) && value) {
          const date = new Date(value);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = String(date.getFullYear()).slice(-2);
          value = `${day}.${month}.${year}`;
        }
        convertedFormData.append(key, value);
      }

      const orderId = convertedFormData.get("order_id");
      fetch(`/edit_order/${orderId}`, {
        method: "POST",
        body: convertedFormData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            alert("Order updated successfully!");
            document.getElementById("edit-order-modal").style.display = "none";
            console.log("Calling fetchAndRender after editing order");
            fetchAndRender();
          } else {
            alert("Error updating order: " + (data.message || "Unknown error"));
          }
        })
        .catch((error) => {
          console.error("Error updating order:", error);
          alert("Error updating order. Please try again.");
        });
    });
  } else {
    console.warn("edit-order-form not found in the DOM");
  }

  const closeButton = document.querySelector(".close");
  if (closeButton) {
    closeButton.addEventListener("click", function () {
      document.getElementById("edit-order-modal").style.display = "none";
    });
  }

  window.addEventListener("click", function (event) {
    const modal = document.getElementById("edit-order-modal");
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
});

const toggleFormBtn = document.querySelector(".toggle-form-btn");
const addOrderSection = document.getElementById("add-order-section");

if (toggleFormBtn && addOrderSection) {
  toggleFormBtn.addEventListener("click", () => {
    const isHidden =
      addOrderSection.style.display === "none" ||
      addOrderSection.style.display === "";
    addOrderSection.style.display = isHidden ? "block" : "none";
    toggleFormBtn.textContent = isHidden
      ? "Hide Add Order Form"
      : "Add New Order";
  });
}
