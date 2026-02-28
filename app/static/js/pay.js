/**
 * pay.js — handles order creation and Revolut Pay widget initialization.
 * Loaded only on the /pay page.
 */

const generateBtn = document.getElementById('generateBtn');
const amountInput = document.getElementById('amountInput');
const statusMsg = document.getElementById('statusMessage');
const widgetMount = document.getElementById('revolut-pay');
const orderInfoCard = document.getElementById('orderInfoCard');

// DOM refs for order detail card
const detailOrderId = document.getElementById('detailOrderId');
const detailAmount = document.getElementById('detailAmount');
const detailCurrency = document.getElementById('detailCurrency');
const detailStatus = document.getElementById('detailStatus');

function setStatus(msg, type = 'info') {
    statusMsg.textContent = msg;
    statusMsg.className = type === 'error' ? 'status-message error'
        : type === 'success' ? 'status-message success'
            : 'status-message';
}

function showOrderCard(order) {
    detailOrderId.textContent = order.order_id;
    detailAmount.textContent = `${(order.amount / 100).toFixed(2)} ${order.currency}`;
    detailCurrency.textContent = order.currency;
    updateStatusBadge(detailStatus, order.status || 'pending');
    orderInfoCard.style.display = 'flex';
}

function updateStatusBadge(el, status) {
    el.textContent = status.toUpperCase();
    el.className = `status-badge`;
    el.setAttribute('data-status', status.toLowerCase());
}

/**
 * Step 1 — POST /api/orders with amount in minor units (cents).
 * Amount input is in euros; we multiply by 100.
 */
async function createOrderOnBackend(amountEuros) {
    const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amountEuros * 100), currency: 'EUR' }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
    }

    return resp.json(); // { order_id, public_token, amount, currency }
}

/**
 * Step 2 — Load the Revolut Checkout SDK via embed script, then
 * initialise and mount the widget.
 */
function loadRevolutSDK() {
    return new Promise((resolve, reject) => {
        if (window.RevolutCheckout) return resolve(window.RevolutCheckout);
        const script = document.createElement('script');
        // Sandbox widget endpoint
        script.src = 'https://sandbox-merchant.revolut.com/embed.js';
        script.dataset.revolut = 'checkout';
        script.onload = () => resolve(window.RevolutCheckout);
        script.onerror = () => reject(new Error('Failed to load Revolut SDK'));
        document.head.appendChild(script);
    });
}

async function initWidget(order) {
    const publicToken = window.REVOLUT_PUBLIC_API_KEY;

    const RC = await loadRevolutSDK();

    // Clear previous widget if any
    widgetMount.innerHTML = '';

    const { revolutPay } = await RC.payments({
        locale: 'en',
        publicToken: publicToken,
        mode: 'sandbox',
    });

    const paymentOptions = {
        currency: order.currency,
        totalAmount: order.amount,  // already in minor units from backend
        // Line items (matches user's jacket product)
        lineItems: [
            {
                name: 'Snowboard Jacket Soft Pink',
                totalAmount: order.amount.toString(),
                unitPriceAmount: order.amount.toString(),
                quantity: {
                    value: 1,
                    unit: 'PIECES',
                },
                type: 'PHYSICAL',
            },
        ],

        // createOrder is called by the widget when the user clicks Pay
        createOrder: async () => {
            return { publicId: order.public_token };
        },

        // Style the button for the light theme (guidelines: black on light background)
        buttonStyle: {
            variant: 'dark',
            radius: 'small',
        },
    };

    revolutPay.mount(widgetMount, paymentOptions);

    revolutPay.on('payment', (payload) => {
        if (payload.type === 'success') {
            setStatus('✅ Payment successful!', 'success');
            updateStatusBadge(detailStatus, 'completed');
            showToast('success', 'Payment successful', `Order ${order.order_id.slice(0, 8)}… was completed.`);
        } else if (payload.type === 'error') {
            setStatus(`❌ Payment failed: ${payload.error?.message || 'Unknown error'}`, 'error');
            updateStatusBadge(detailStatus, 'failed');
            showToast('error', 'Payment failed', payload.error?.message || 'Please try again.');
        } else if (payload.type === 'cancel') {
            setStatus('Payment cancelled.', 'info');
            showToast('info', 'Payment cancelled');
        }
    });
}

// ─── Main click handler ───────────────────────────────────────────────────────
generateBtn.addEventListener('click', async () => {
    const amountEuros = parseFloat(amountInput.value);

    if (!amountEuros || amountEuros <= 0) {
        setStatus('Please enter a valid amount greater than 0.', 'error');
        return;
    }

    generateBtn.disabled = true;
    widgetMount.innerHTML = '';
    orderInfoCard.style.display = 'none';
    setStatus('Creating order…');

    try {
        const order = await createOrderOnBackend(amountEuros);

        // Persist to localStorage so dashboard can fetch it
        addOrderToStorage(order.order_id);

        setStatus('Order created! Loading payment widget…');
        showOrderCard(order);

        await initWidget(order);

        setStatus('Select a payment method below.');
    } catch (err) {
        setStatus(`Error: ${err.message}`, 'error');
        showToast('error', 'Order creation failed', err.message);
    } finally {
        generateBtn.disabled = false;
    }
});
