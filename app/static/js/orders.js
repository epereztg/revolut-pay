/**
 * orders.js — lists orders from localStorage and shows Revolut live detail on click.
 */

const orderList = document.getElementById('orderList');
const listEmptyState = document.getElementById('listEmptyState');
const orderCount = document.getElementById('orderCount');
const detailPlaceholder = document.getElementById('detailPlaceholder');
const detailContent = document.getElementById('detailContent');
const detailLoading = document.getElementById('detailLoading');

// ─── Detail field references ──────────────────────────────────────────────────
const detailTitle = document.getElementById('detailTitle');
const detailId = document.getElementById('detailId');
const detailStatus = document.getElementById('detailStatus');
const diAmount = document.getElementById('diAmount');
const diCurrency = document.getElementById('diCurrency');
const diOutstanding = document.getElementById('diOutstanding');
const diCapture = document.getElementById('diCapture');
const diCreated = document.getElementById('diCreated');
const diUpdated = document.getElementById('diUpdated');
const diCheckoutUrl = document.getElementById('diCheckoutUrl');
const lineItemsSection = document.getElementById('lineItemsSection');
const lineItemsList = document.getElementById('lineItemsList');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(minor, currency) {
    if (minor == null) return '—';
    return new Intl.NumberFormat('en-EU', {
        style: 'currency', currency: currency || 'EUR', minimumFractionDigits: 2
    }).format(minor / 100);
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', {
        dateStyle: 'medium', timeStyle: 'short'
    });
}

function statusClass(s) {
    s = (s || '').toLowerCase();
    if (['completed', 'authorised'].includes(s)) return 'completed';
    if (['failed', 'cancelled', 'declined'].includes(s)) return 'failed';
    return 'pending';
}

// ─── Render order list ────────────────────────────────────────────────────────
function renderList() {
    const ids = getStoredOrderIds();
    orderCount.textContent = ids.length;

    orderList.innerHTML = '';

    if (!ids.length) {
        listEmptyState.style.display = 'flex';
        return;
    }
    listEmptyState.style.display = 'none';

    ids.forEach((id, i) => {
        const li = document.createElement('li');
        li.className = 'order-list-item';
        li.dataset.id = id;
        li.innerHTML = `
      <div class="oli-icon">📄</div>
      <div class="oli-body">
        <div class="oli-id">${id.slice(0, 8)}…</div>
        <div class="oli-sub">Order #${ids.length - i}</div>
      </div>
      <svg class="oli-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    `;
        li.addEventListener('click', () => selectOrder(id, li));
        orderList.appendChild(li);
    });
}

// ─── Select & fetch detail ────────────────────────────────────────────────────
let activeItem = null;

async function selectOrder(orderId, liEl) {
    // Highlight selected item
    if (activeItem) activeItem.classList.remove('active');
    liEl.classList.add('active');
    activeItem = liEl;

    // Show content shell + loading overlay
    detailPlaceholder.style.display = 'none';
    detailContent.style.display = 'block';
    detailLoading.style.display = 'flex';

    try {
        const resp = await fetch(`/api/orders/${orderId}`);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${resp.status}`);
        }

        const order = await resp.json();

        console.log("-----order (selectOrder)-----", order);
        console.log(order);
        console.log("-----------------");

        populateDetail(order);
    } catch (err) {
        showToast('error', 'Failed to load order', err.message);
        detailPlaceholder.style.display = 'flex';
        detailContent.style.display = 'none';
        liEl.classList.remove('active');
        activeItem = null;
    } finally {
        detailLoading.style.display = 'none';
    }
}

// ─── Populate detail panel ────────────────────────────────────────────────────
function populateDetail(order) {
    const state = order.state || order.status || 'pending';
    const currency = order.currency || 'EUR';

    detailTitle.textContent = `Order`;
    detailId.textContent = order.id || '—';

    detailStatus.textContent = state.toUpperCase();
    detailStatus.className = `status-badge ${statusClass(state)}`;
    detailStatus.setAttribute('data-status', state.toLowerCase());

    diAmount.textContent = formatAmount(order.order_amount.value, order.order_amount.currency);

    diCurrency.textContent = currency;
    diOutstanding.textContent = formatAmount(order.order_outstanding_amount.value, order.order_outstanding_amount.currency);
    diCapture.textContent = order.capture_mode || '—';
    diCreated.textContent = formatDate(order.created_at);
    diUpdated.textContent = formatDate(order.updated_at);

    if (order.checkout_url) {
        diCheckoutUrl.href = order.checkout_url;
        diCheckoutUrl.textContent = order.checkout_url;
    } else {
        diCheckoutUrl.removeAttribute('href');
        diCheckoutUrl.textContent = '—';
    }

    // Line items (if present)
    const items = order.line_items || [];
    if (items.length) {
        lineItemsList.innerHTML = items.map(item => `
      <li class="line-item">
        <span class="li-name">${item.name || 'Item'}</span>
        <span class="li-qty">×${item.quantity ?? 1}</span>
        <span class="li-amount">${formatAmount(item.unit_price_amount ?? item.unitAmount?.value, currency)}</span>
      </li>
    `).join('');
        lineItemsSection.style.display = 'block';
    } else {
        lineItemsSection.style.display = 'none';
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
renderList();
