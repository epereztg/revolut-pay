/**
 * embedded.js — handles order creation and Revolut Embedded Checkout initialization.
 * Loaded only on the /checkout/embedded page.
 */

const generateBtn = document.getElementById('generateBtn');
const amountInput = document.getElementById('amountInput');
const statusMsg = document.getElementById('statusMessage');
const widgetMount = document.getElementById('revolut-embedded-checkout');
const orderInfoCard = document.getElementById('orderInfoCard');

// DOM refs for order detail card
const detailOrderId = document.getElementById('detailOrderId');
const detailAmount = document.getElementById('detailAmount');
const detailCurrency = document.getElementById('detailCurrency');
const detailStatus = document.getElementById('detailStatus');

let currentDestroy = null;

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
    el.className = `status-badge ${status.toLowerCase()}`;
    el.setAttribute('data-status', status.toLowerCase());
}

/**
 * Step 1 — POST /api/orders with amount in minor units (cents).
 * Amount input is in pounds; we multiply by 100.
 * The backend /api/orders route uses revolut_service.create_order internally.
 */
async function createOrderOnBackend(amount) {
    const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(amount * 100), currency: 'GBP' }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
    }

    return resp.json(); // { order_id, public_token, amount, currency, checkout_url }
}

/**
 * Step 2 — Load the Revolut Checkout SDK via embed script.
 */
function loadRevolutSDK() {
    return new Promise((resolve, reject) => {
        if (window.RevolutCheckout) return resolve(window.RevolutCheckout);
        const script = document.createElement('script');
        // Sandbox widget endpoint
        script.src = 'https://sandbox-merchant.revolut.com/embed.js';
        script.onload = () => resolve(window.RevolutCheckout);
        script.onerror = () => reject(new Error('Failed to load Revolut SDK'));
        document.head.appendChild(script);
    });
}

// ─── Main click handler ───────────────────────────────────────────────────────
generateBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
        setStatus('Please enter a valid amount greater than 0.', 'error');
        return;
    }

    generateBtn.disabled = true;
    orderInfoCard.style.display = 'none';

    // Clean up previous instance if exists
    if (currentDestroy) {
        try { currentDestroy(); } catch (e) { }
        currentDestroy = null;
    }

    setStatus('Loading embedded checkout widget...');

    try {
        // Load the SDK first
        const RevolutCheckout = await loadRevolutSDK();

        // Initialize the embedded checkout component
        const { destroy } = await RevolutCheckout.embeddedCheckout({
            target: widgetMount,
            publicToken: window.REVOLUT_PUBLIC_API_KEY,
            mode: 'sandbox', // 'prod' for production, 'sandbox' for testing
            locale: 'en',
            paymentOptions: {
                currency: 'GBP',
                totalAmount: Math.round(amount * 100)
            },

            // The widget calls this function when it needs an order to process the payment.
            // It calls our createOrderOnBackend helper to trigger the backend API.
            createOrder: async () => {
                const order = await createOrderOnBackend(amount);

                // Persist to localStorage so dashboard can fetch it
                if (window.addOrderToStorage) {
                    window.addOrderToStorage(order.order_id);
                }

                showOrderCard(order);

                return { publicId: order.public_token, redirect_url: "http://google.com" };
            },

            onSuccess() {
                setStatus('✅ Payment successful!', 'success');
                updateStatusBadge(detailStatus, 'completed');
                if (window.showToast) {
                    window.showToast('success', 'Payment successful', 'Order completed.');
                }
                document.getElementById('amountSection').style.display = 'none';
            },
            onError(message) {
                setStatus(`❌ Payment failed: ${message}`, 'error');
                updateStatusBadge(detailStatus, 'failed');
                if (window.showToast) window.showToast('error', 'Payment failed', message);
            },
            onCancel() {
                setStatus('Payment cancelled by user.', 'info');
                if (window.showToast) window.showToast('info', 'Payment cancelled');
            }
        });

        currentDestroy = destroy;
        setStatus('Please select a payment method and complete your purchase.');

    } catch (err) {
        setStatus(`Error: ${err.message}`, 'error');
        if (window.showToast) {
            window.showToast('error', 'Checkout error', err.message);
        }
    } finally {
        generateBtn.disabled = false;
    }
});
