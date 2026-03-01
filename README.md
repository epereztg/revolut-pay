# Revolut Pay: Merchant Integration Deep-Dive


[![Environment: Sandbox](https://img.shields.io/badge/Environment-Sandbox-orange.svg)](https://sandbox-business.revolut.com)

This repository demonstrates a production-grade integration of the **Revolut Pay** checkout flow. It was built to showcase best practices for an **Integration Specialist** role, focusing on reliability, user experience, and technical clarity.

---

## 🏛 Architecture Overview

The solution follows a **Merchant-First** architecture, prioritizing ease of support and clear audit trails for all API interactions.

- **Backend (Python/Flask)**: Handles secure Order creation, secret key management, and internal state persistence.
- **Frontend (Vanilla JS/CSS)**: Utilizes the Revolut Checkout SDK to provide a native-feeling, high-conversion payment experience.
- **Service Layer**: An abstracted communication layer interfaces with the Revolut Merchant API.

---

## 🚀 Technical Features

### 1. Dynamic Order Lifecycle
Unlike static implementations, this demo generates Revolut Orders on-demand based on user input. This ensures that the **public token** and **order amount** are always synchronized.

### 2. Rich Line-Item Integration
To demonstrate full SDK capabilities, the implementation passes detailed `lineItems` (Metadata, Quantities, Unit Amounts). This is critical for merchants who require itemized reporting in their Revolut Merchant portal.

### 3. Failure-Resilient Design
- **Config Validation**: The app performs a "Health Check" on startup to ensure all API keys are correctly configured.
- **Detailed Error Propagation**: Instead of generic "Payment Failed" messages, the UI surfaces specific SDK error codes and messages to help users troubleshoot.

---

## 🛠 Setup & Deployment

### Environment Configuration
1. Clone the repository.
2. `cp .env.template .env`
3. Populate with your **Sandbox** credentials:

| Variable | Description |
| :--- | :--- |
| `PUBLIC_API_KEY` | Used by the Frontend SDK to initialize the widget. |
| `PRIVATE_SECRET_KEY` | Used by the Backend to authenticate `/orders` requests. |

### Running Locally
```bash
# Install dependencies
pip install -r requirements.txt

# Start the server
python3 run.py
```
Visit `http://localhost:5000/pay` to start a test transaction.

---

## 🧪 Quick-Look: Requirements Mapping

| Assignment Requirement | Implementation Detail |
| :--- | :--- |
| **Visible Widget** | Mounted dynamically in `pay.js` under `#revolut-pay`. |
| **Sandbox Environment** | Full connectivity to Revolut Sandbox verified. |
| **Order Generation** | "Generate Order" button maps to `/api/orders` POST. |
| **Success/Fail Scenarios** | Fully handled via SDK event listeners. |
| **Bonus: Variable Amounts** | Enabled via responsive input field. |
| **Bonus: Line Items** | Itemized list passed in both API and Widget params. |

---

## 📚 Future Roadmap
If this were a production integration for a Tier-1 merchant, the following would be added:
- **Complete Payment Flows**: Such as Capture, Refunds, Void, etc.
- **Webhook Integration**: To ensure order status (e.g., `COMPLETED`) is updated even if the user closes their browser before redirection.
- **Idempotency Keys**: To prevent duplicate charges in high-latency mobile networks.
- **OAuth 2.0 Flow**: For merchants managing multiple business units.

---

