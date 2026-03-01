# Revolut Pay: Merchant Integration Deep-Dive

[![Environment: Sandbox](https://img.shields.io/badge/Environment-Sandbox-orange.svg)](https://sandbox-business.revolut.com)

This repository serves as a focused implementation of the **Revolut Pay Merchant SDK**. The goal is to demonstrate a working payment flow that adheres to best practices for merchant integrations, balancing technical depth with a resilient user experience.

---

## 🎯 The Goal

The core objective of this project is to implement a secure and functional **Revolut Pay web widget** within a sandbox environment. This involves:

*   **SDK Mastery**: Following the official [Revolut Merchant SDK documentation](https://developer.revolut.com/docs/accept-payments) to initialize and mount the payment widget correctly.
*   **Order Lifecycle**: Managing the transition from order generation to payment confirmation.
*   **Operational Resilience**: Handling edge cases like processing timeouts and payment failures gracefully.

---

## 📋 Requirements Mapping

The implementation covers the following core requirements and bonus features:

| Goal | Implementation Detail |
| :--- | :--- |
| **Visible Widget** | Dynamically mounted in `pay.js` using the `#revolut-pay` container. |
| **Sandbox Ready** | Fully connected to the Revolut Sandbox for end-to-end testing. |
| **Order Generation** | A "Generate Order" flow that maps to the `/api/orders` backend endpoint. |
| **Status Feedback** | Real-time success/failure updates via SDK event listeners and UI feedback. |
| **Bonus: Variable Amounts** | Enabled via a responsive amount input field. |
| **Bonus: Detailed Items** | Supports `lineItems` (Metadata, Quantities, Unit Amounts) for itemized reporting. |
| **Bonus: Error Handling** | Surfacing specific SDK errors and messages directly in the UI. |

---

## 🔒 Security & Architecture

This implementation prioritizes the security of the payment flow:

*   **Secret Isolation**: All sensitive operations, including order creation and cancellation, are handled strictly on the backend.
*   **Zero Secret Exposure**: The `PRIVATE_SECRET_KEY` never leaves the server. The frontend only uses the `PUBLIC_API_KEY`, following industry standards for client-side SDK initialization.
*   **Encapsulated Logic**: Merchant-side logic is shielded behind a clean API, preventing client-side manipulation of the payment parameters.

---

## 🛠 Notable Features

### 1. Robust Processing Timeout 🛡️
To prevent "zombie" states where a user is stuck in a loading loop, I implemented a **30-second processing timeout**:
*   If the SDK remains in processing without a resolution, the app definitively calls `revolutPay.destroy()`, notifies the backend to cancel the session, and resets the UI to a clean retry state.

### 2. Itemized Dashboard Reporting
The implementation passes descriptive `lineItems` during the order creation. This ensures that the Revolut Merchant portal provides a rich, itemized view of every transaction, rather than just a flat total.

---

## 🚀 Getting Started

### Environment Setup
1. `cp .env.template .env`
2. Configure your **Sandbox** credentials:

| Variable | Location | Role |
| :--- | :--- | :--- |
| `PUBLIC_API_KEY` | Frontend | Connects the widget to your account. |
| `PRIVATE_SECRET_KEY` | **Backend** | Authorizes secure order creation. |

### Running Locally
```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
python3 run.py
```
Visit `http://localhost:5000/pay` to start a test transaction.

---

*Built with ❤️ to explore the intersection of code, commerce, and user experience.*
