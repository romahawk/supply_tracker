// Fetch orders data
let allOrders = [];
let timelineChart = null;

document.addEventListener('DOMContentLoaded', () => {
    fetch('/api/orders')
        .then(response => response.json())
        .then(data => {
            allOrders = data;
            updateTable(allOrders);
            renderTimeline(allOrders);
        })
        .catch(error => console.error('Error fetching orders:', error));

    // Add filtering functionality
    document.getElementById('order-filter').addEventListener('input', (e) => {
        const query = e.target.value;
        const filteredData = filterData(allOrders, query);
        updateTable(filteredData);
        renderTimeline(filteredData);
    });

    // Toggle Add Order Form
    const toggleFormBtn = document.querySelector('.toggle-form-btn');
    const addOrderSection = document.getElementById('add-order-section');

    if (toggleFormBtn && addOrderSection) {
        toggleFormBtn.addEventListener('click', () => {
            const isHidden = addOrderSection.style.display === 'none' || addOrderSection.style.display === '';
            addOrderSection.style.display = isHidden ? 'block' : 'none';
            toggleFormBtn.textContent = isHidden ? 'Hide Add Order Form' : 'Add New Order';
        });
    }

    // Add Order Form Submission
    const addOrderForm = document.getElementById('add-order-form');
    if (addOrderForm) {
        addOrderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(addOrderForm);
            const orderData = Object.fromEntries(formData);

            fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            })
            .then(response => response.json())
            .then(newOrder => {
                allOrders.push(newOrder);
                updateTable(allOrders);
                renderTimeline(allOrders);
                addOrderForm.reset();
                addOrderSection.style.display = 'none';
                toggleFormBtn.textContent = 'Add New Order';
            })
            .catch(error => console.error('Error adding order:', error));
        });
    }

    // Edit Order Modal
    const editOrderModal = document.getElementById('edit-order-modal');
    const editOrderForm = document.getElementById('edit-order-form');
    const closeModal = document.querySelector('.close');

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-order')) {
            const orderId = e.target.dataset.id;
            const order = allOrders.find(o => o.id == orderId);

            document.getElementById('edit-order_id').value = order.id;
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

            editOrderModal.style.display = 'block';
        }
    });

    closeModal.addEventListener('click', () => {
        editOrderModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target == editOrderModal) {
            editOrderModal.style.display = 'none';
        }
    });

    editOrderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(editOrderForm);
        const orderData = Object.fromEntries(formData);

        fetch(`/api/orders/${orderData.order_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        })
        .then(response => response.json())
        .then(updatedOrder => {
            const index = allOrders.findIndex(o => o.id == updatedOrder.id);
            allOrders[index] = updatedOrder;
            updateTable(allOrders);
            renderTimeline(allOrders);
            editOrderModal.style.display = 'none';
        })
        .catch(error => console.error('Error updating order:', error));
    });
});

// Filter Data
function filterData(orders, query) {
    query = query.toLowerCase();
    return orders.filter(order =>
        Object.values(order).some(value =>
            String(value).toLowerCase().includes(query)
        )
    );
}

// Update Table
function updateTable(orders) {
    const tbody = document.querySelector('table tbody');
    tbody.innerHTML = '';

    orders.forEach(order => {
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
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Helper function to get the week number of a date
function getWeekNumber(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - startOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

// Render Timeline
function renderTimeline(orders) {
    console.log('Orders received for timeline:', orders); // Debug: Check the orders array

    const ctx = document.getElementById('timelineChart').getContext('2d');
    const loading = document.getElementById('timeline-loading');
    loading.style.display = 'block';

    if (timelineChart) {
        timelineChart.destroy();
    }

    // Prepare datasets for the timeline
    const today = new Date();
    const datasets = orders.map((order, index) => {
        const etdDate = new Date(order.etd.split('.').reverse().join('-'));
        const etaDate = new Date(order.eta.split('.').reverse().join('-'));

        console.log(`Order ${order.order_number}: ETD=${order.etd}, ETA=${order.eta}, ETD Date=${etdDate}, ETA Date=${etaDate}`); // Debug: Check date parsing

        // Fallback to a default date if parsing fails
        const validEtdDate = isNaN(etdDate) ? new Date(today.getFullYear(), 0, 1) : etdDate;
        const validEtaDate = isNaN(etaDate) ? new Date(today.getFullYear(), 0, 1) : etaDate;

        // Convert dates to week numbers
        const etdWeek = getWeekNumber(validEtdDate);
        const etaWeek = getWeekNumber(validEtaDate);

        // Ensure week numbers are within the valid range (1 to 27)
        const boundedEtdWeek = Math.min(Math.max(etdWeek, 1), 27);
        const boundedEtaWeek = Math.min(Math.max(etaWeek, 1), 27);

        console.log(`Order ${order.order_number}: ETD Week=${boundedEtdWeek}, ETA Week=${boundedEtaWeek}`); // Debug: Check week numbers

        let color;
        switch (order.transit_status) {
            case 'in process':
                color = 'rgba(255, 165, 0, 0.8)';
                break;
            case 'en route':
                color = 'rgba(0, 123, 255, 0.8)';
                break;
            case 'arrived':
                color = 'rgba(144, 238, 144, 0.8)';
                break;
            default:
                color = 'rgba(150, 150, 150, 0.8)';
        }

        return {
            label: `${order.product_name} ${order.order_number} (${order.quantity})`,
            data: [{
                x: [boundedEtdWeek - 1, boundedEtaWeek - 1], // Adjust for zero-based index
                y: index
            }],
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            barThickness: 20
        };
    });

    console.log('Datasets for timeline:', datasets); // Debug: Check the final datasets

    // Calculate the current week
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const pastDaysOfYear = (today - startOfYear) / 86400000;
    const currentWeek = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

    // Create custom ticks for the x-axis (weeks)
    const weeks = Array.from({ length: 27 }, (_, i) => `W${i + 1}`);

    // Define month ranges for grouping
    const monthRanges = [
        { month: 'January', startWeek: 1, endWeek: 4 },
        { month: 'February', startWeek: 5, endWeek: 8 },
        { month: 'March', startWeek: 9, endWeek: 13 },
        { month: 'April', startWeek: 14, endWeek: 17 },
        { month: 'May', startWeek: 18, endWeek: 22 },
        { month: 'June', startWeek: 23, endWeek: 27 }
    ];

    timelineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: datasets
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    type: 'linear', // Use linear scale to handle week numbers
                    min: 0,
                    max: 26, // W1 to W27 (zero-based: 0 to 26)
                    title: {
                        display: true,
                        text: 'Timeline'
                    },
                    grid: {
                        drawBorder: true,
                        drawOnChartArea: true
                    },
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return `W${value + 1}`; // Display as W1, W2, ..., W27
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            const order = orders[value];
                            return order ? `${order.product_name} ${order.order_number} (${order.quantity})` : '';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Orders'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                annotation: {
                    annotations: {
                        currentWeekLine: {
                            type: 'line',
                            xMin: currentWeek - 1, // Adjust for zero-based index
                            xMax: currentWeek - 1,
                            borderColor: 'rgba(255, 0, 0, 0.5)', // Red line
                            borderWidth: 2
                        },
                        // Add month labels as annotations
                        ...monthRanges.reduce((acc, range) => {
                            const startIndex = range.startWeek - 1;
                            const endIndex = range.endWeek - 1;
                            const midIndex = startIndex + (endIndex - startIndex) / 2;
                            acc[range.month] = {
                                type: 'label',
                                xValue: midIndex,
                                yValue: -1, // Position above the chart
                                content: range.month,
                                backgroundColor: 'rgba(200, 200, 200, 0.2)',
                                color: '#000',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                }
                            };
                            return acc;
                        }, {})
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            }
        }
    });

    loading.style.display = 'none';
}