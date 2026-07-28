/**
 * fast_checkout.js — Revolut Pay Fast Checkout for web.
 * Loaded only on the /pay/fast-checkout page.
 *
 * Fast checkout lets returning Revolut customers skip manual address entry:
 * the standalone revolutPay widget is mounted with `requestShipping: true`
 * and Revolut Pay collects the shipping address / delivery method from the
 * shopper's Revolut account itself — there's no client-side shipping
 * callback for it (that only exists on the separate paymentRequest/wallet
 * button API, not on revolutPay.mount()).
 *
 * In production this also requires registering a server-side address
 * validation webhook (POST /synchronous-webhooks, event_type
 * "fast_checkout.validate_address") so Revolut can confirm you deliver to
 * the selected address before it's offered to the shopper. The "Register"
 * form on this page calls POST /api/fast-checkout/webhook to do that; the
 * receiving endpoint lives at
 * /webhooks/revolut/fast-checkout-address/<sandbox|prod> in webhooks.py —
 * see that file's docstring for caveats on the unverified payload schema.
 *
 * There's no real Revolut app/account in sandbox to source a shipping
 * address from (confirmed: the sandbox order API silently accepts a
 * shipping_address field but never persists or echoes it back), so this
 * demo displays a fixed sample address once the order is created, purely
 * to illustrate what the widget would otherwise surface automatically.
 */
const FAKE_SHIPPING_ADDRESS = {
    street_line_1: '30 South Colonnade',
    street_line_2: '',
    region: 'Greater London',
    city: 'London',
    country_code: 'GB',
    postcode: 'E14 5HX',
};

const generateBtn   = document.getElementById('generateBtn');
const amountInput   = document.getElementById('amountInput');
const statusMsg     = document.getElementById('statusMessage');
const widgetMount   = document.getElementById('revolut-pay');
const orderInfoCard = document.getElementById('orderInfoCard');
const shippingInfoCard = document.getElementById('shippingInfoCard');

const detailOrderId  = document.getElementById('detailOrderId');
const detailAmount   = document.getElementById('detailAmount');
const detailCurrency = document.getElementById('detailCurrency');
const detailStatus   = document.getElementById('detailStatus');

const detailShippingAddress = document.getElementById('detailShippingAddress');
const detailShippingOption  = document.getElementById('detailShippingOption');

const webhookBaseUrlInput = document.getElementById('webhookBaseUrlInput');
const registerWebhookBtn  = document.getElementById('registerWebhookBtn');
const webhookStatus       = document.getElementById('webhookStatus');

async function refreshWebhookStatus() {
    try {
        const resp = await fetch('/api/fast-checkout/webhook');
        const data = await resp.json();
        webhookStatus.textContent = data.registered
            ? `Registered for ${data.mode}: ${data.url}`
            : `Not registered for ${data.mode} yet.`;
    } catch (err) {
        console.warn('[fast_checkout] Could not load webhook status', err);
    }
}

registerWebhookBtn?.addEventListener('click', async () => {
    const baseUrl = webhookBaseUrlInput.value.trim();
    if (!baseUrl) {
        webhookStatus.textContent = 'Enter a public HTTPS base URL first.';
        return;
    }

    registerWebhookBtn.disabled = true;
    webhookStatus.textContent = 'Registering…';

    try {
        const resp = await fetch('/api/fast-checkout/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base_url: baseUrl }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);

        webhookStatus.textContent = `Registered for ${data.mode}: ${data.url}`;
        if (window.showToast) showToast('success', 'Webhook registered', data.url);
    } catch (err) {
        webhookStatus.textContent = `Error: ${err.message}`;
        if (window.showToast) showToast('error', 'Registration failed', err.message);
    } finally {
        registerWebhookBtn.disabled = false;
    }
});

refreshWebhookStatus();

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
    el.className = 'status-badge';
    el.setAttribute('data-status', status.toLowerCase());
}

function formatAddress(address) {
    if (!address) return '—';
    return [address.street_line_1, address.city, address.postcode, address.country_code]
        .filter(Boolean)
        .join(', ');
}

/**
 * Sandbox stand-in for the address Revolut Pay would normally surface once
 * the shopper picks one from their Revolut account.
 */
function showShippingCard() {
    detailShippingAddress.textContent = formatAddress(FAKE_SHIPPING_ADDRESS);
    detailShippingOption.textContent = 'Standard delivery (sample)';
    shippingInfoCard.style.display = 'flex';
}

/**
 * Step 1 — POST /api/orders with amount in minor units (cents).
 */
async function createOrderOnBackend(payload) {
    console.log('[fast_checkout] POST /api/orders', payload);
    const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    console.log(`[fast_checkout] ${resp.status}`, data);

    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
}

function loadRevolutSDK() {
    return new Promise((resolve, reject) => {
        if (window.RevolutCheckout) return resolve(window.RevolutCheckout);
        const script = document.createElement('script');
        script.src = window.getRevolutSdkUrl();
        script.dataset.revolut = 'checkout';
        script.onload = () => resolve(window.RevolutCheckout);
        script.onerror = () => reject(new Error('Failed to load Revolut SDK'));
        document.head.appendChild(script);
    });
}

async function initWidget(order) {
    const RevolutCheckout = await loadRevolutSDK();

    widgetMount.innerHTML = '';
    shippingInfoCard.style.display = 'none';

    const { revolutPay } = await RevolutCheckout.payments({
        locale: 'en',
        publicToken: window.REVOLUT_PUBLIC_API_KEY,
        mode: window.getRevolutMode(),
    });

    let processingTimeoutId = null;

    const paymentOptions = {
        currency: order.currency,
        totalAmount: order.amount,
        lineItems: [
            {
                name: 'Snowboard Jacket Soft Pink',
                totalAmount: order.amount.toString(),
                unitPriceAmount: order.amount.toString(),
                quantity: { value: 1, unit: 'PIECES' },
                type: 'PHYSICAL',
            },
        ],

        // Enables Fast checkout: Revolut Pay collects the shipping address
        // and delivery method from the shopper's Revolut account directly —
        // this is the only shipping-related option revolutPay.mount() takes.
        requestShipping: true,

        createOrder: async () => {
            processingTimeoutId = setTimeout(async () => {
                console.warn('[fast_checkout] Processing timed out after 90s.');
                if (revolutPay?.destroy) try { revolutPay.destroy(); } catch (e) { }
                else if (revolutPay?.unmount) try { revolutPay.unmount(); } catch (e) { }
                widgetMount.innerHTML = '';
                orderInfoCard.style.display = 'none';
                setStatus('Payment timed out. Please try again.', 'error');
                if (window.showToast) showToast('error', 'Processing Timeout', 'The payment took too long and was cancelled.');
                generateBtn.disabled = false;
                try { await fetch(`/api/orders/${order.order_id}/cancel`, { method: 'POST' }); } catch (e) { }
            }, 90000);

            return { publicId: order.public_token };
        },

        buttonStyle: { variant: 'dark', radius: 'small' },
    };

    revolutPay.mount(widgetMount, paymentOptions);

    revolutPay.on('payment', (payload) => {
        if (processingTimeoutId) {
            clearTimeout(processingTimeoutId);
            processingTimeoutId = null;
        }

        if (payload.type === 'success') {
            setStatus('✅ Payment successful!', 'success');
            updateStatusBadge(detailStatus, 'completed');
            if (window.showToast) showToast('success', 'Payment successful', `Order ${order.order_id.slice(0, 8)}… was completed.`);
        } else if (payload.type === 'error') {
            setStatus(`❌ Payment failed: ${payload.error?.message || 'Unknown error'}`, 'error');
            updateStatusBadge(detailStatus, 'failed');
            if (window.showToast) showToast('error', 'Payment failed', payload.error?.message || 'Please try again.');
        } else if (payload.type === 'cancel') {
            setStatus('Payment cancelled.', 'info');
            if (window.showToast) showToast('info', 'Payment cancelled');
        }
    });
}

generateBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);

    if (!amount || amount <= 0) {
        setStatus('Please enter a valid amount greater than 0.', 'error');
        return;
    }

    generateBtn.disabled = true;
    widgetMount.innerHTML = '';
    orderInfoCard.style.display = 'none';
    shippingInfoCard.style.display = 'none';
    setStatus('Creating order…');

    // In production, requestShipping collects the real address from the
    // shopper's Revolut account — the sandbox stand-in address only applies
    // when there's no real Revolut Pay session to source one from.
    const isSandbox = window.getRevolutMode() !== 'prod';

    try {
        const order = await createOrderOnBackend({
            amount: Math.round(amount * 100),
            currency: 'GBP',
            ...(isSandbox ? { shipping_address: FAKE_SHIPPING_ADDRESS } : {}),
        });

        if (window.addOrderToStorage) addOrderToStorage(order.order_id);

        setStatus('Order created! Loading Fast Checkout…');
        showOrderCard(order);
        if (isSandbox) showShippingCard();

        await initWidget(order);

        setStatus('Select a saved payment method to complete Fast Checkout.');
    } catch (err) {
        setStatus(`Error: ${err.message}`, 'error');
        if (window.showToast) showToast('error', 'Order creation failed', err.message);
    } finally {
        generateBtn.disabled = false;
    }
});
