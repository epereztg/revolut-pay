/**
 * subscriptions.js — Save payment method for subscriptions via Revolut Pay.
 * Loaded only on the /subscriptions page.
 *
 * Step 1 of Revolut subscription management guide:
 * - Backend order is created with save_payment_method_for: "subscription" + customer object.
 * - savePaymentMethodForMerchant: true is added to paymentOptions so the
 *   Revolut Pay widget surfaces the save-card consent to the shopper.
 */

const generateBtn   = document.getElementById('generateBtn');
const amountInput   = document.getElementById('amountInput');
const emailInput    = document.getElementById('customerEmail');
const nameInput     = document.getElementById('customerName');
const statusMsg     = document.getElementById('statusMessage');
const widgetMount   = document.getElementById('revolut-pay');
const orderInfoCard = document.getElementById('orderInfoCard');

const detailOrderId  = document.getElementById('detailOrderId');
const detailAmount   = document.getElementById('detailAmount');
const detailCurrency = document.getElementById('detailCurrency');
const detailCustomer = document.getElementById('detailCustomer');
const detailStatus   = document.getElementById('detailStatus');

function setStatus(msg, type = 'info') {
    statusMsg.textContent = msg;
    statusMsg.className = type === 'error'   ? 'status-message error'
                        : type === 'success' ? 'status-message success'
                        : 'status-message';
}

function showOrderCard(order, email) {
    detailOrderId.textContent  = order.order_id;
    detailAmount.textContent   = `${(order.amount / 100).toFixed(2)} ${order.currency}`;
    detailCurrency.textContent = order.currency;
    detailCustomer.textContent = email;
    updateStatusBadge(detailStatus, order.status || 'pending');
    orderInfoCard.style.display = 'flex';
}

function updateStatusBadge(el, status) {
    el.textContent = status.toUpperCase();
    el.className   = 'status-badge';
    el.setAttribute('data-status', status.toLowerCase());
}

async function createOrderOnBackend(payload) {
    console.log('[subscriptions] POST /api/orders', payload);
    const resp = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    console.log(`[subscriptions] ${resp.status}`, data);

    if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
    return data;
}

function loadRevolutSDK() {
    return new Promise((resolve, reject) => {
        if (window.RevolutCheckout) return resolve(window.RevolutCheckout);
        const script = document.createElement('script');
        script.src = window.getRevolutSdkUrl();
        script.dataset.revolut = 'checkout';
        script.onload  = () => resolve(window.RevolutCheckout);
        script.onerror = () => reject(new Error('Failed to load Revolut SDK'));
        document.head.appendChild(script);
    });
}

async function initWidget(order, email) {
    const RevolutCheckout = await loadRevolutSDK();

    widgetMount.innerHTML = '';

    const { revolutPay } = await RevolutCheckout.payments({
        locale: 'en',
        mode: window.getRevolutMode(),
        publicToken: window.REVOLUT_PUBLIC_API_KEY,
    });

    let processingTimeoutId = null;

    const paymentOptions = {
        currency: order.currency,
        totalAmount: order.amount,
        savePaymentMethodForMerchant: true,
        lineItems: [
            {
                name: 'Snowboard Jacket Soft Pink',
                totalAmount: order.amount.toString(),
                unitPriceAmount: order.amount.toString(),
                quantity: { value: 1, unit: 'PIECES' },
                type: 'PHYSICAL',
            },
        ],

        createOrder: async () => {
            processingTimeoutId = setTimeout(async () => {
                console.warn('[subscriptions] Processing timed out after 90s.');
                if (revolutPay?.destroy)      try { revolutPay.destroy(); }  catch (e) {}
                else if (revolutPay?.unmount) try { revolutPay.unmount(); }  catch (e) {}
                widgetMount.innerHTML = '';
                orderInfoCard.style.display = 'none';
                setStatus('Payment timed out. Please try again.', 'error');
                if (window.showToast) showToast('error', 'Processing Timeout', 'The payment took too long and was cancelled.');
                generateBtn.disabled = false;
                try { await fetch(`/api/orders/${order.order_id}/cancel`, { method: 'POST' }); } catch (e) {}
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
            setStatus('✅ Payment successful — payment method saved for future use.', 'success');
            updateStatusBadge(detailStatus, 'completed');
            if (window.showToast) showToast('success', 'Payment successful', 'Payment method saved for subscription.');
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
    const amount   = parseFloat(amountInput.value);
    const email    = emailInput.value.trim();
    const fullName = nameInput.value.trim();

    if (!amount || amount <= 0) {
        setStatus('Please enter a valid amount greater than 0.', 'error');
        return;
    }
    if (!email) {
        setStatus('Please enter a customer email.', 'error');
        return;
    }

    generateBtn.disabled = true;
    widgetMount.innerHTML = '';
    orderInfoCard.style.display = 'none';
    setStatus('Creating order…');

    try {
        const order = await createOrderOnBackend({
            amount: Math.round(amount * 100),
            currency: 'GBP',
            customer: {
                full_name: fullName || undefined,
                email: email,
            },
            save_payment_method_for: 'subscription',
        });

        if (window.addOrderToStorage) addOrderToStorage(order.order_id);

        setStatus('Order created! Loading payment widget…');
        showOrderCard(order, email);

        await initWidget(order, email);

        setStatus('Select a payment method below.');
    } catch (err) {
        setStatus(`Error: ${err.message}`, 'error');
        if (window.showToast) showToast('error', 'Order creation failed', err.message);
    } finally {
        generateBtn.disabled = false;
    }
});
