// static/js/dashboard.js
document.addEventListener('DOMContentLoaded', function () {
    let chartInstance = null;
    let allOrders = [];
    let sortDirection = {};
    let visibleStatuses = ['in process', 'en route', 'arrived'];

    Chart.register(window['chartjs-plugin-annotation']);

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
            const fullYear = 2000 + year;
            const date = new Date(fullYear, month - 1, day);
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

    function getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function getStartOfWeek(weekNum, year) {
        const firstDayOfYear = new Date(year, 0, 1);
        const dayOfWeek = firstDayOfYear.getDay();
        const firstMonday = dayOfWeek === 1 ? firstDayOfYear : new Date(firstDayOfYear.setDate(firstDayOfYear.getDate() + (8 - dayOfWeek) % 7));
        const startOfWeek = new Date(firstMonday);
        startOfWeek.setDate(startOfWeek.getDate() + (weekNum - 1) * 7);
        return startOfWeek;
    }

    function updateTable(data) {
        const tbody = document.querySelector('table tbody');
        if (!tbody) {
            console.error('updateTable: Table tbody not found');
            return;
        }
        tbody.innerHTML = '';
        data.forEach(order => {
            const row = document.createElement('tr');
            row.classList.add('bg-gray-100', 'dark:bg-gray-900', 'hover:bg-gray-200', 'dark:hover:bg-gray-700');
            row.innerHTML = `
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.order_date}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.order_number}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.product_name}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.buyer}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.responsible}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.quantity}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.required_delivery}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.terms_of_delivery}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.payment_date}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.etd}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.eta}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.ata || ''}</td>
                <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${order.transit_status}</td>
                <td class="px-4 py-2">
                    <a href="#" class="edit-order text-blue-600 hover:underline dark:text-blue-400" data-id="${order.id}">Edit</a>
                    <a href="#" class="delete-order text-red-600 hover:underline dark:text-red-400 ml-2" data-id="${order.id}">Delete</a>
                </td>
            `;
            tbody.appendChild(row);
        });
        console.log('updateTable: Table updated with data:', data);
    }

    function sortData(data, key) {
        sortDirection[key] = sortDirection[key] === 'asc' ? 'desc' : 'asc';
        document.querySelectorAll('th[data-sort]').forEach(th => {
            const thKey = th.getAttribute('data-sort');
            const indicator = th.querySelector('.sort-indicator');
            if (thKey === key) {
                indicator.textContent = sortDirection[key] === 'asc' ? '↑' : '↓';
            } else {
                indicator.textContent = '';
            }
        });
        return [...data].sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            if (['order_date', 'required_delivery', 'payment_date', 'etd', 'eta', 'ata'].includes(key)) {
                valA = parseDate(valA) || new Date(0);
                valB = parseDate(valB) || new Date(0);
            }
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

    function filterData(data, query) {
        query = query.toLowerCase();
        return data.filter(order => {
            return (
                visibleStatuses.includes(order.transit_status) &&
                (
                    order.order_number.toLowerCase().includes(query) ||
                    order.product_name.toLowerCase().includes(query) ||
                    order.buyer.toLowerCase().includes(query) ||
                    order.responsible.toLowerCase().includes(query) ||
                    order.transit_status.toLowerCase().includes(query)
                )
            );
        });
    }

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

        const filteredData = data.filter(order => visibleStatuses.includes(order.transit_status));

        const chartData = [];
        const labels = filteredData.map(order => `${order.product_name} (${order.order_number})`);
        filteredData.forEach((order, index) => {
            console.log(`renderTimeline: Processing order ${order.order_number} at index ${index}`);
            const startDate = parseDate(order.etd);
            const endDate = order.ata ? parseDate(order.ata) : parseDate(order.eta);

            if (!startDate || !endDate) {
                console.warn(`renderTimeline: Invalid dates for order ${order.order_number}: ETD=${order.etd}, ETA=${order.eta}, ATA=${order.ata}`);
                return;
            }

            const color = {
                'in process': 'rgba(255, 165, 0, 0.8)',
                'en route': 'rgba(0, 123, 255, 0.8)',
                'arrived': 'rgba(144, 238, 144, 0.8)'
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

        const heightPerOrder = 50;
        const minHeight = 100;
        const calculatedHeight = Math.max(minHeight, filteredData.length * heightPerOrder);
        canvas.style.height = `${calculatedHeight}px`;
        console.log(`renderTimeline: Set canvas height to ${calculatedHeight}px for ${filteredData.length} orders`);

        canvas.style.display = 'block';
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        console.log('renderTimeline: Set canvas to visible, loading indicator to hidden');

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
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 7);
        console.log('renderTimeline: Date range:', { minDate, maxDate });

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentWeek = getWeekNumber(today);
        const startOfCurrentWeek = getStartOfWeek(currentWeek, currentYear);
        console.log(`renderTimeline: Current week: W${currentWeek}, Start date: ${startOfCurrentWeek}`);

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
                            color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'
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
                            color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'
                        },
                        grid: {
                            display: true,
                            drawBorder: true,
                            drawOnChartArea: true,
                            color: document.documentElement.classList.contains('dark') ? '#6b7280' : '#d1d5db'
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
                            color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'
                        },
                        beginAtZero: true,
                        min: 0,
                        max: filteredData.length - 1,
                        ticks: {
                            stepSize: 1,
                            padding: 10,
                            callback: function (value, index, values) {
                                return labels[value] || '';
                            },
                            font: {
                                size: 12
                            },
                            color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'
                        },
                        grid: {
                            display: false
                        },
                        afterFit: function (scale) {
                            scale.height = filteredData.length * 50;
                        }
                    }
                },
                plugins: {
                    chartArea: {
                        backgroundColor: 'transparent'
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#2d3748',
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
                                const order = filteredData[context.dataIndex];
                                return [
                                    `Product: ${order.product_name}`,
                                    `Order #: ${order.order_number}`,
                                    `Buyer: ${order.buyer}`,
                                    `Responsible: ${order.responsible}`,
                                    `Status: ${order.transit_status}`,
                                    `ETD: ${order.etd}`,
                                    `ETA: ${order.eta}`,
                                    `ATA: ${order.ata || 'N/A'}`
                                ];
                            }
                        }
                    },
                    customMonthLabels: {
                        id: 'customMonthLabels',
                        afterDraw: (chart) => {
                            const ctx = chart.ctx;
                            const xAxis = chart.scales.x;
                            const yAxis = chart.scales.y;

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

                            ctx.save();
                            ctx.font = 'bold 12px Inter, sans-serif';
                            ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000';
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
                    },
                    annotation: {
                        annotations: {
                            currentWeekLine: {
                                type: 'line',
                                xMin: startOfCurrentWeek,
                                xMax: startOfCurrentWeek,
                                borderColor: 'rgba(255, 0, 0, 0.5)',
                                borderWidth: 2,
                                label: {
                                    enabled: true,
                                    content: `W${currentWeek}`,
                                    position: 'top',
                                    backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(255, 0, 0, 0.6)' : 'rgba(255, 0, 0, 0.8)',
                                    color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#ffffff',
                                    font: {
                                        size: 12,
                                        weight: 'bold'
                                    },
                                    padding: 6,
                                    cornerRadius: 4
                                }
                            }
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
                            document.querySelectorAll('table tbody tr').forEach(row => {
                                row.classList.remove('highlighted');
                            });
                            row.classList.add('highlighted', 'bg-blue-100', 'dark:bg-blue-900');
                            orderRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }
                }
            },
            plugins: [{
                id: 'customMonthLabels'
            }, {
                id: 'chartAreaBackground',
                beforeDraw(chart) {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.fillStyle = 'transparent';
                    ctx.fillRect(0, 0, chart.width, chart.height);
                    ctx.restore();
                }
            }]
        });
        console.log('renderTimeline: Chart rendered successfully.');
    }

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
                allOrders = data;
                const filteredData = filterData(data, document.getElementById('order-filter').value);
                updateTable(filteredData);
                renderTimeline(filteredData);
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

    console.log('Initial render of dashboard');
    fetchAndRender();

    document.querySelectorAll('table th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const key = header.getAttribute('data-sort');
            const filteredData = filterData(allOrders, document.getElementById('order-filter').value);
            const sortedData = sortData(filteredData, key);
            updateTable(sortedData);
            renderTimeline(sortedData);
        });
    });

    document.getElementById('order-filter').addEventListener('input', (e) => {
        const query = e.target.value;
        const filteredData = filterData(allOrders, query);
        updateTable(filteredData);
        renderTimeline(filteredData);
    });

    document.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', () => {
            const status = item.getAttribute('data-status');
            if (visibleStatuses.includes(status)) {
                visibleStatuses = visibleStatuses.filter(s => s !== status);
                item.classList.add('opacity-50');
            } else {
                visibleStatuses.push(status);
                item.classList.remove('opacity-50');
            }
            const filteredData = filterData(allOrders, document.getElementById('order-filter').value);
            updateTable(filteredData);
            renderTimeline(filteredData);
        });
    });

    const addForm = document.getElementById('add-order-form');
    if (addForm) {
        addForm.addEventListener('submit', function (event) {
            event.preventDefault();

            const formData = new FormData(addForm);
            const dateFields = ['order_date', 'required_delivery', 'payment_date', 'etd', 'eta', 'ata'];
            const convertedFormData = new FormData();
            for (let [key, value] of formData.entries()) {
                if (dateFields.includes(key) && value) {
                    const date = new Date(value);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = String(date.getFullYear()).slice(-2);
                    value = `${day}.${month}.${year}`;
                }
                convertedFormData.append(key, value);
            }

            fetch('/add_order', {
                method: 'POST',
                body: convertedFormData
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
                        const dateFields = ['order_date', 'required_delivery', 'payment_date', 'etd', 'eta', 'ata'];
                        dateFields.forEach(field => {
                            const value = order[field];
                            if (value) {
                                const date = parseDate(value);
                                const formattedDate = date.toISOString().split('T')[0];
                                document.getElementById(`edit-${field}`).value = formattedDate;
                            } else {
                                document.getElementById(`edit-${field}`).value = '';
                            }
                        });
                        document.getElementById('edit-order_number').value = order.order_number;
                        document.getElementById('edit-product_name').value = order.product_name;
                        document.getElementById('edit-buyer').value = order.buyer;
                        document.getElementById('edit-responsible').value = order.responsible;
                        document.getElementById('edit-quantity').value = order.quantity;
                        document.getElementById('edit-terms_of_delivery').value = order.terms_of_delivery;
                        document.getElementById('edit-transit_status').value = order.transit_status;
                        document.getElementById('edit-order-modal').style.display = 'flex';
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

    const editForm = document.getElementById('edit-order-form');
    if (editForm) {
        editForm.addEventListener('submit', function (event) {
            event.preventDefault();

            const formData = new FormData(editForm);
            const dateFields = ['order_date', 'required_delivery', 'payment_date', 'etd', 'eta', 'ata'];
            const convertedFormData = new FormData();
            for (let [key, value] of formData.entries()) {
                if (dateFields.includes(key) && value) {
                    const date = new Date(value);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = String(date.getFullYear()).slice(-2);
                    value = `${day}.${month}.${year}`;
                }
                convertedFormData.append(key, value);
            }

            const orderId = convertedFormData.get('order_id');
            fetch(`/edit_order/${orderId}`, {
                method: 'POST',
                body: convertedFormData
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

    const closeButton = document.querySelector('.close');
    if (closeButton) {
        closeButton.addEventListener('click', function () {
            document.getElementById('edit-order-modal').style.display = 'none';
        });
    }

    window.addEventListener('click', function (event) {
        const modal = document.getElementById('edit-order-modal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Dark mode toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const darkModeIcon = document.getElementById('dark-mode-icon');

    if (darkModeToggle && darkModeIcon) {
        // Function to update the toggle button's appearance
        function updateDarkModeToggle(isDarkMode) {
            if (isDarkMode) {
                darkModeIcon.textContent = '☀️'; // Sun icon to switch to light mode
            } else {
                darkModeIcon.textContent = '🌙'; // Moon icon to switch to dark mode
            }
        }

        // Check for saved preference
        if (localStorage.getItem('dark-mode') === 'enabled') {
            document.documentElement.classList.add('dark');
            updateDarkModeToggle(true);
        } else {
            updateDarkModeToggle(false);
        }

        darkModeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDarkMode = document.documentElement.classList.contains('dark');
            localStorage.setItem('dark-mode', isDarkMode ? 'enabled' : 'disabled');
            updateDarkModeToggle(isDarkMode);
            // Re-render the timeline to update colors
            const filteredData = filterData(allOrders, document.getElementById('order-filter').value);
            renderTimeline(filteredData);
        });
    }
});

const toggleFormBtn = document.querySelector('.toggle-form-btn');
const addOrderSection = document.getElementById('add-order-section');

if (toggleFormBtn && addOrderSection) {
    toggleFormBtn.addEventListener('click', () => {
        const isHidden = addOrderSection.style.display === 'none' || addOrderSection.style.display === '';
        addOrderSection.style.display = isHidden ? 'block' : 'none';
        toggleFormBtn.textContent = isHidden ? 'Hide Add Order Form' : 'Add New Order';
    });
}