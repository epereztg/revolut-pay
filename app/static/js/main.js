/**
 * main.js — shared UI logic: sidebar, user panel, toasts
 */

// ─── Sidebar & Mobile Nav ────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const overlay = document.getElementById('overlay');

function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
}

hamburger?.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});

overlay?.addEventListener('click', () => {
    closeSidebar();
    closeUserPanel();
});

// ─── User Panel ───────────────────────────────────────────────────────────────
const userBtn = document.getElementById('userBtn');
const userPanel = document.getElementById('userPanel');
const panelClose = document.getElementById('panelClose');

function openUserPanel() { userPanel.classList.add('open'); overlay.classList.add('active'); }
function closeUserPanel() { userPanel.classList.remove('open'); overlay.classList.remove('active'); }

userBtn?.addEventListener('click', openUserPanel);
panelClose?.addEventListener('click', closeUserPanel);

// ─── Toast Notifications ──────────────────────────────────────────────────────
const toastContainer = document.getElementById('toastContainer');

/**
 * Show a toast notification.
 * @param {'success'|'error'|'info'} type
 * @param {string} title
 * @param {string} [body]
 */
function showToast(type, title, body = '') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <div class="toast-icon">${icons[type] ?? 'ℹ️'}</div>
    <div class="toast-text">
      <div class="toast-title">${title}</div>
      ${body ? `<div class="toast-body">${body}</div>` : ''}
    </div>
  `;
    toastContainer.appendChild(toast);

    // Auto-remove after 5 s
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => toast.remove());
    }, 5000);
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const STORAGE_KEY = 'revolut_demo_order_ids';

function getStoredOrderIds() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function addOrderToStorage(id) {
    const ids = getStoredOrderIds();
    if (!ids.includes(id)) {
        ids.unshift(id); // newest first
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    }
}

// Expose to other scripts
window.showToast = showToast;
window.getStoredOrderIds = getStoredOrderIds;
window.addOrderToStorage = addOrderToStorage;
