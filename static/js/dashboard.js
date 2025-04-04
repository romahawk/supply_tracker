// static/js/dashboard.js
document.addEventListener('DOMContentLoaded', function () {
  // Guard to prevent multiple chart instances
  let chartInstance = null;
  let allOrders = []; // Store all orders for filtering
  let sortDirection = {}; // Track sort direction for each column

  // Function to parse DD.MM.YY dates into JavaScript Date objects
  function parseDate(dateStr) {
      try {
          if (!dateStr || typeof dateStr !== 'string') {
              console.error(`parseDate: Invalid date string: ${dateStr}`);
              throw new Error('Invalid date string');
          }
          const [day, month, year] = dateStr.split('.').map(Number);
          if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12) {
              console.error(`parseDate: Invalid date components: ${dateStr}`);
              throw new Error('Invalid date components');
          }
          const fullYear = 2000 + year; // Assuming 21st century (e.g., 25 -> 2025)
          const date = new Date(fullYear, month - 1, day); // JavaScript months are 0-based
          if (isNaN(date.getTime())) {
              console.error(`parseDate: Invalid date: ${dateStr}`);
              throw new Error('Invalid date');
          }
          console.log(`parseDate: Successfully parsed ${dateStr} to ${date}`);
          return date;
      } catch (error) {
          console.error(`parseDate: Error parsing date: ${dateStr}`, error);
          return null;
      }
  }

  // Function to get the week number of a date (ISO week number)
  function getWeekNumber(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // Function to update the table with filtered and sorted data
  function updateTable(data) {
      const tbody = document.querySelector('table tbody');
      if (!tbody) {
          console.error('updateTable: Table tbody not found');
          return;
      }
      tbody.innerHTML = '';
      data.forEach(order => {
          const row = document.createElement('tr');
          row.innerHTML = `
              <td>${order.order_date}</td>
              <td>${order.order_number}</td>
              <td>${order.product_name}</td>
              <td>${order.buyer}</td>
              <td>${order.responsible}</td>
              <td>${order.quantity}</td>
              <td>${order.required_delivery}</td>
              <td>${order.terms_of_delivery}</td>
              <td>${order.payment_date}</td>
              <td>${order.etd}</td>
              <td>${order.eta}</td>
              <td>${order.ata || ''}</td>
              <td>${order.transit_status}</td>
              <td>
                  <a href="#" class="edit-order" data-id="${order.id}">Edit</a>
                  <a href="#" class="delete-order" data-id="${order.id}">Delete</a>
              </td>
          `;
          tbody.appendChild(row);
      });
      console.log('updateTable: Table updated with data:', data);
  }

  // Function to sort data
  function sortData(data, key) {
      sortDirection[key] = sortDirection[key] === 'asc' ? 'desc' : 'asc';
      return [...data].sort((a, b) => {
          let valA = a[key] || '';
          let valB = b[key] || '';
          // Handle date fields
          if (['order_date', 'required_delivery', 'payment_date', 'etd', 'eta', 'ata'].includes(key)) {
              valA = parseDate(valA) || new Date(0);
              valB = parseDate(valB) || new Date(0);
          }
          // Handle numeric fields
          if (key === 'quantity') {
              valA = parseInt(valA) || 0;
              valB = parseInt(valB) || 0;
          }
          if (sortDirection[key] === 'asc') {
              return valA > valB ? 1 : -1;
          } else {
              return valA < valB ? 1 : -1;
          }
      });
  }

  // Function to filter data
  function filterData(data, query) {
      query = query.toLowerCase();
      return data.filter(order => {
          return (
              order.order_number.toLowerCase().includes(query) ||
              order.product_name.toLowerCase().includes(query) ||
              order.buyer.toLowerCase().includes(query) ||
              order.responsible.toLowerCase().includes(query) ||
              order.transit_status.toLowerCase().includes(query)
          );
      });
  }

  // Function to fetch and render the timeline
  function renderTimeline(data) {
      console.log('renderTimeline: Function called with data:', data);
      const loadingIndicator = document.getElementById('timeline-loading');
      const canvas = document.getElementById('timelineChart');
      console.log('renderTimeline: Loading indicator:', loadingIndicator);
      console.log('renderTimeline: Canvas element:', canvas);

      if (!canvas) {
          console.error('renderTimeline: Canvas element not found');
          return;
      }

      if (loadingIndicator) {
          loadingIndicator.style.display = 'block';
      } else {
          console.warn('renderTimeline: Loading indicator not found, proceeding without it');
      }
      canvas.style.display = 'none';
      console.log('renderTimeline: Set canvas to hidden');

      // Prepare data for the chart
      const chartData = [];
      const labels = data.map(order => `${order.product_name} (${order.order_number})`);
      data.forEach((order, index) => {
          console.log(`renderTimeline: Processing order ${order.order_number} at index ${index}`);
          const startDate = parseDate(order.etd);
          const endDate = order.ata ? parseDate(order.ata) : parseDate(order.eta);

          if (!startDate || !endDate) {
              console.warn(`renderTimeline: Invalid dates for order ${order.order_number}: ETD=${order.etd}, ETA=${order.eta}, ATA=${order.ata}`);
              return; // Skip this order if dates are invalid
          }

          const color = {
              'in process': 'rgba(255, 165, 0, 0.8)', // Orange
              'en route': 'rgba(0, 123, 255, 0.8)',   // Blue
              'arrived': 'rgba(144, 238, 144, 0.8)'   // Light Green
          }[order.transit_status] || 'rgba(128, 128, 128, 0.8)';

          chartData.push({
              x: [startDate, endDate],
              y: index,
              backgroundColor: color,
              borderColor: color.replace('0.8', '1'),
              borderWidth: 1
          });
      });

      console.log('renderTimeline: Prepared chart data:', chartData);

      if (chartData.length === 0) {
          console.warn('renderTimeline: No valid data to display in the timeline.');
          canvas.style.display = 'none';
          if (loadingIndicator) {
              loadingIndicator.style.display = 'none';
          }
          return;
      }

      // Dynamically set the canvas height based on the number of orders
      const heightPerOrder = 50; // 50px per order for clear spacing
      const minHeight = 100; // Minimum height for the canvas
      const calculatedHeight = Math.max(minHeight, data.length * heightPerOrder);
      canvas.style.height = `${calculatedHeight}px`;
      console.log(`renderTimeline: Set canvas height to ${calculatedHeight}px for ${data.length} orders`);

      canvas.style.display = 'block';
      if (loadingIndicator) {
          loadingIndicator.style.display = 'none';
      }
      console.log('renderTimeline: Set canvas to visible, loading indicator to hidden');

      // Determine the date range for the x-axis
      const allDates = chartData.flatMap(item => item.x);
      if (allDates.length === 0) {
          console.warn('renderTimeline: No valid dates found in chart data.');
          canvas.style.display = 'none';
          if (loadingIndicator) {
              loadingIndicator.style.display = 'none';
          }
          return;
      }
      const minDate = new Date(Math.min(...allDates));
      const maxDate = new Date(Math.max(...allDates));
      // Add some padding to the date range (e.g., 1 week before and after)
      minDate.setDate(minDate.getDate() - 7);
      maxDate.setDate(maxDate.getDate() + 7);
      console.log('renderTimeline: Date range:', { minDate, maxDate });

      // Destroy existing chart instance if it exists
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          console.error('renderTimeline: Failed to get canvas context');
          if (loadingIndicator) {
              loadingIndicator.style.display = 'none';
          }
          return;
      }
      if (chartInstance) {
          chartInstance.destroy();
          console.log('renderTimeline: Destroyed existing chart instance');
      }

      // Register the zoom plugin if available
      if (typeof chartjsPluginZoom !== 'undefined') {
          console.log('renderTimeline: Registering chartjs-plugin-zoom');
          Chart.register(chartjsPluginZoom);
      } else {
          console.warn('renderTimeline: chartjs-plugin-zoom not found, zoom functionality will be disabled');
      }

      // Create the chart
      console.log('renderTimeline: Creating new Chart instance');
      chartInstance = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: labels,
              datasets: [{
                  label: 'Orders Timeline',
                  data: chartData,
                  backgroundColor: chartData.map(item => item.backgroundColor),
                  borderColor: chartData.map(item => item.borderColor),
                  borderWidth: 1
              }]
          },
          options: {
              indexAxis: 'y',
              scales: {
                  x: {
                      type: 'time',
                      time: {
                          unit: 'week',
                          displayFormats: {
                              week: 'W'
                          },
                          tooltipFormat: 'dd.MM.yyyy'
                      },
                      min: minDate,
                      max: maxDate,
                      title: {
                          display: true,
                          text: 'Timeline',
                          font: {
                              size: 16,
                              weight: '600'
                          },
                          color: '#1a202c'
                      },
                      ticks: {
                          source: 'auto',
                          autoSkip: true,
                          maxRotation: 45,
                          minRotation: 45,
                          callback: function (value, index, values) {
                              const date = new Date(value);
                              const weekNum = getWeekNumber(date);
                              return `W${weekNum}`;
                          },
                          font: {
                              size: 12
                          },
                          color: '#4a5568'
                      },
                      grid: {
                          display: true,
                          drawBorder: true,
                          drawOnChartArea: true,
                          color: '#e2e8f0'
                      }
                  },
                  y: {
                      title: {
                          display: true,
                          text: 'Orders',
                          font: {
                              size: 16,
                              weight: '600'
                          },
                          color: '#1a202c'
                      },
                      beginAtZero: true,
                      min: 0,
                      max: data.length - 1,
                      ticks: {
                          stepSize: 1,
                          padding: 10,
                          callback: function (value, index, values) {
                              return labels[value] || '';
                          },
                          font: {
                              size: 12
                          },
                          color: '#4a5568'
                      },
                      grid: {
                          display: false
                      },
                      afterFit: function (scale) {
                          scale.height = data.length * 50;
                      }
                  }
              },
              plugins: {
                  legend: {
                      display: false
                  },
                  tooltip: {
                      backgroundColor: '#2d3748',
                      titleFont: {
                          size: 14,
                          weight: '600'
                      },
                      bodyFont: {
                          size: 12
                      },
                      padding: 10,
                      cornerRadius: 6,
                      callbacks: {
                          label: function (context) {
                              const order = data[context.dataIndex];
                              return [
                                  `Product: ${order.product_name}`,
                                  `Order #: ${order.order_number}`,
                                  `Status: ${order.transit_status}`,
                                  `ETD: ${order.etd}`,
                                  `ETA: ${order.eta}`,
                                  `ATA: ${order.ata || 'N/A'}`
                              ];
                          }
                      }
                  },
                  zoom: {
                      zoom: {
                          wheel: {
                              enabled: typeof chartjsPluginZoom !== 'undefined'
                          },
                          pinch: {
                              enabled: typeof chartjsPluginZoom !== 'undefined'
                          },
                          mode: 'x'
                      },
                      pan: {
                          enabled: typeof chartjsPluginZoom !== 'undefined',
                          mode: 'x'
                      }
                  },
                  customMonthLabels: {
                      id: 'customMonthLabels',
                      afterDraw: (chart) => {
                          const ctx = chart.ctx;
                          const xAxis = chart.scales.x;
                          const yAxis = chart.scales.y;

                          // Group ticks by month
                          const monthPositions = {};
                          let currentDate = new Date(minDate);
                          while (currentDate <= maxDate) {
                              const month = currentDate.toLocaleString('default', { month: 'long' });
                              const xPos = xAxis.getPixelForValue(currentDate.getTime());
                              if (!monthPositions[month]) {
                                  monthPositions[month] = { start: xPos, end: xPos };
                              } else {
                                  monthPositions[month].end = xPos;
                              }
                              currentDate = new Date(currentDate);
                              currentDate.setDate(currentDate.getDate() + 7);
                          }

                          // Draw month labels
                          ctx.save();
                          ctx.font = 'bold 12px Inter, sans-serif';
                          ctx.fillStyle = '#4a5568';
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'bottom';

                          for (const month in monthPositions) {
                              const { start, end } = monthPositions[month];
                              const x = (start + end) / 2;
                              const y = yAxis.top - 10;
                              ctx.fillText(month, x, y);
                          }

                          ctx.restore();
                      }
                  }
              },
              barThickness: 20,
              maintainAspectRatio: false,
              responsive: true,
              onHover: (event, chartElement) => {
                  event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
              },
              onClick: (event, elements) => {
                  if (elements.length > 0) {
                      const index = elements[0].index;
                      const orderRow = document.querySelector(`table tbody tr:nth-child(${index + 1})`);
                      if (orderRow) {
                          // Remove highlight from all rows
                          document.querySelectorAll('table tbody tr').forEach(row => {
                              row.classList.remove('highlighted');
                          });
                          // Highlight the clicked row
                          orderRow.classList.add('highlighted');
                          // Scroll the table to bring the row into view
                          orderRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                  }
              }
          },
          plugins: [{
              id: 'customMonthLabels'
          }]
      });
      console.log('renderTimeline: Chart rendered successfully.');
  }

  // Function to fetch and render the dashboard
  function fetchAndRender() {
      console.log('fetchAndRender: Fetching orders from /api/orders...');
      fetch('/api/orders')
          .then(response => {
              console.log('fetchAndRender: Fetch response received:', response);
              if (!response.ok) {
                  throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
              }
              return response.json();
          })
          .then(data => {
              console.log('fetchAndRender: Fetched orders:', data);
              allOrders = data; // Store all orders for filtering
              updateTable(data);
              renderTimeline(data);
          })
          .catch(error => {
              console.error('fetchAndRender: Error fetching or rendering:', error);
              const loadingIndicator = document.getElementById('timeline-loading');
              if (loadingIndicator) {
                  loadingIndicator.style.display = 'none';
              }
              const canvas = document.getElementById('timelineChart');
              if (canvas) {
                  canvas.style.display = 'none';
              }
          });
  }

  // Initial render of the dashboard
  console.log('Initial render of dashboard');
  fetchAndRender();

  // Add sorting functionality
  document.querySelectorAll('table th[data-sort]').forEach(header => {
      header.addEventListener('click', () => {
          const key = header.getAttribute('data-sort');
          const filteredData = filterData(allOrders, document.getElementById('order-filter').value);
          const sortedData = sortData(filteredData, key);
          updateTable(sortedData);
          renderTimeline(sortedData);
      });
  });

  // Add filtering functionality
  document.getElementById('order-filter').addEventListener('input', (e) => {
      const query = e.target.value;
      const filteredData = filterData(allOrders, query);
      updateTable(filteredData);
      renderTimeline(filteredData);
  });

  // Handle form submission via AJAX (Add Order)
  const addForm = document.getElementById('add-order-form');
  if (addForm) {
      addForm.addEventListener('submit', function (event) {
          event.preventDefault();

          const formData = new FormData(addForm);
          fetch('/add_order', {
              method: 'POST',
              body: formData
          })
              .then(response => response.json())
              .then(data => {
                  if (data.success) {
                      alert('Order added successfully!');
                      addForm.reset();
                      console.log('Calling fetchAndRender after adding order');
                      fetchAndRender();
                  } else {
                      alert('Error adding order: ' + (data.message || 'Unknown error'));
                  }
              })
              .catch(error => {
                  console.error('Error adding order:', error);
                  alert('Error adding order. Please try again.');
              });
      });
  } else {
      console.warn('add-order-form not found in the DOM');
  }

  // Handle edit and delete actions
  document.addEventListener('click', function (event) {
      if (event.target.classList.contains('edit-order')) {
          event.preventDefault();
          const orderId = event.target.getAttribute('data-id');
          fetch(`/api/orders`)
              .then(response => response.json())
              .then(data => {
                  const order = data.find(o => o.id == orderId);
                  if (order) {
                      document.getElementById('edit-order-id').value = order.id;
                      document.getElementById('edit-order_date').value = order.order_date;
                      document.getElementById('edit-order_number').value = order.order_number;
                      document.getElementById('edit-product_name').value = order.product_name;
                      document.getElementById('edit-buyer').value = order.buyer;
                      document.getElementById('edit-responsible').value = order.responsible;
                      document.getElementById('edit-quantity').value = order.quantity;
                      document.getElementById('edit-required_delivery').value = order.required_delivery;
                      document.getElementById('edit-terms_of_delivery').value = order.terms_of_delivery;
                      document.getElementById('edit-payment_date').value = order.payment_date;
                      document.getElementById('edit-etd').value = order.etd;
                      document.getElementById('edit-eta').value = order.eta;
                      document.getElementById('edit-ata').value = order.ata || '';
                      document.getElementById('edit-transit_status').value = order.transit_status;
                      document.getElementById('edit-order-modal').style.display = 'block';
                  }
              });
      }

      if (event.target.classList.contains('delete-order')) {
          event.preventDefault();
          if (!confirm('Are you sure you want to delete this order?')) return;

          const orderId = event.target.getAttribute('data-id');
          fetch(`/delete_order/${orderId}`, { method: 'GET' })
              .then(response => response.json())
              .then(data => {
                  if (data.success) {
                      alert('Order deleted successfully!');
                      console.log('Calling fetchAndRender after deleting order');
                      fetchAndRender();
                  } else {
                      alert('Error deleting order: ' + (data.message || 'Unknown error'));
                  }
              })
              .catch(error => {
                  console.error('Error deleting order:', error);
                  alert('Error deleting order. Please try again.');
              });
      }
  });

  // Handle edit form submission via AJAX
  const editForm = document.getElementById('edit-order-form');
  if (editForm) {
      editForm.addEventListener('submit', function (event) {
          event.preventDefault();

          const formData = new FormData(editForm);
          const orderId = formData.get('order_id');
          fetch(`/edit_order/${orderId}`, {
              method: 'POST',
              body: formData
          })
              .then(response => response.json())
              .then(data => {
                  if (data.success) {
                      alert('Order updated successfully!');
                      document.getElementById('edit-order-modal').style.display = 'none';
                      console.log('Calling fetchAndRender after editing order');
                      fetchAndRender();
                  } else {
                      alert('Error updating order: ' + (data.message || 'Unknown error'));
                  }
              })
              .catch(error => {
                  console.error('Error updating order:', error);
                  alert('Error updating order. Please try again.');
              });
      });
  } else {
      console.warn('edit-order-form not found in the DOM');
  }

  // Close the modal
  const closeButton = document.querySelector('.close');
  if (closeButton) {
      closeButton.addEventListener('click', function () {
          document.getElementById('edit-order-modal').style.display = 'none';
      });
  }

  // Close the modal when clicking outside of it
  window.addEventListener('click', function (event) {
      const modal = document.getElementById('edit-order-modal');
      if (event.target === modal) {
          modal.style.display = 'none';
      }
  });
});