/**
 * dashboard.js — fetches orders by IDs stored in localStorage,
 * renders summaries/table, and polls every 3 seconds.
 */

const statTotal = document.getElementById('statTotal');
const statSuccess = document.getElementById('statSuccess');
const statFailed = document.getElementById('statFailed');
const tableBody = document.getElementById('ordersTableBody');
const tableWrapper = document.getElementById('tableWrapper');
const emptyState = document.getElementById('emptyState');

/** Map Revolut order states to display labels */
const SUCCESS_STATES = new Set(['completed', 'authorised']);
const FAILED_STATES = new Set(['failed', 'cancelled', 'declined']);

function statusClass(status) {
    const s = (status || '').toLowerCase();
    if (SUCCESS_STATES.has(s)) return 'completed';
    if (FAILED_STATES.has(s)) return 'failed';
    return 'pending';
}

function renderRows(orders) {
    tableBody.innerHTML = '';

    if (!orders.length) {
        tableWrapper.style.display = 'none';
        emptyState.style.display = 'flex';
        statTotal.textContent = '0';
        statSuccess.textContent = '0';
        statFailed.textContent = '0';
        return;
    }

    tableWrapper.style.display = 'block';
    emptyState.style.display = 'none';

    let successCount = 0;
    let failedCount = 0;

    orders.forEach(order => {
        const s = (order.status || 'pending').toLowerCase();
        if (SUCCESS_STATES.has(s)) successCount++;
        if (FAILED_STATES.has(s)) failedCount++;

        const amountDisplay = order.amount != null
            ? `${(order.amount / 100).toFixed(2)} ${order.currency || 'EUR'}`
            : '—';

        const sc = statusClass(order.status);

        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${order.order_id}</td>
      <td>${amountDisplay}</td>
      <td>${order.currency || '—'}</td>
      <td><span class="status-badge ${sc}" data-status="${s}">${s.toUpperCase()}</span></td>
    `;
        tableBody.appendChild(tr);
    });

    statTotal.textContent = orders.length;
    statSuccess.textContent = successCount;
    statFailed.textContent = failedCount;
}

async function fetchOrders() {
    const ids = getStoredOrderIds();

    if (!ids.length) {
        renderRows([]);
        return;
    }

    try {
        const resp = await fetch(`/api/orders?ids=${ids.join(',')}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const orders = await resp.json();
        renderRows(orders);
    } catch (err) {
        console.error('[Dashboard] Failed to fetch orders:', err);
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
fetchOrders(); // immediate on page load

// Poll every 3 seconds
setInterval(fetchOrders, 3000);
