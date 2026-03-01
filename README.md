# Revolut Pay: A Modern Merchant Integration

[![Environment: Sandbox](https://img.shields.io/badge/Environment-Sandbox-orange.svg)](https://sandbox-business.revolut.com)

Welcome! This project is a practical deep-dive into the **Revolut Pay Merchant API**. Rather than a basic "hello world," I've built a failure-resilient checkout experience that reflects the real-world challenges merchants face during payment integration.

---

## 💡 Why This Project?

Payments are often the most sensitive part of a customer's journey. I built this to showcase how an integration can be more than just "functional"—it should be **reliable, transparent, and user-centric.**

This demo focuses on:
*   **Security**: Minimal data exposure and server-side order generation.
*   **Resilience**: Handling network hangs and "zombie" processing states.
*   **Transparency**: Detailed logging for easier debugging and support.

---

## 🏛 The Build

The application follows a clean, decoupled architecture:

*   **The Brain (Python/Flask)**: A secure backend service that handles the heavy lifting—communicating with the Revolut Merchant API and managing order states.
*   **The Experience (Vanilla JS/CSS)**: A lightweight, responsive frontend that mounts the Revolut SDK dynamically. I avoided heavy frameworks to keep the integration logic clear and the performance snappy.
*   **The Service Layer**: An abstraction over the API calls that ensures we have clean, itemized data and robust error handling.

---

## 🛠 Notable Features & Decisions

### 1. The "Stuck in Processing" Guard 🛡️
In real-world scenarios, network issues or API delays can leave a user staring at a loading spinner indefinitely. I implemented a **30-second processing timeout**. 
*   **Result**: If the SDK gets stuck, it definitively closes the modal (`revolutPay.destroy()`), cancels the order on the backend for safety, and invites the user to try again. No more infinite loops.

### 2. Dynamic Order Lifecycles
Many integrations use hardcoded amounts. This implementation generates a fresh Revolut Order including descriptive `lineItems` (metadata, quantities, unit prices) based on user input. This ensures the merchant dashboard always reflects the actual checkout state.

### 3. Fail-Fast Configuration
The app validates its environment variables on startup. If a secret key is missing, it won't just crash silently—it tells you exactly what's missing, following best practices for dev-ops and supportability.

---

## 🚀 Getting Started

### Environment Setup
1. Clone the repo and navigate to the directory.
2. Initialize your config: `cp .env.template .env`
3. Add your **Sandbox** credentials:

| Variable | Importance |
| :--- | :--- |
| `PUBLIC_API_KEY` | Connects the frontend widget to your account. |
| `PRIVATE_SECRET_KEY` | Authorizes the backend to create secure orders. |

### Running Locally
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Fire it up
python3 run.py
```
Open `http://localhost:5000/pay` to test the checkout experience.

---

## 🗺 Future Roadmap
Payment integrations are never truly "done." If I were scaling this for a production environment, I'd prioritize:
*   **Webhooks**: Moving beyond client-side signals to ensure every order is captured, even if the user closes their browser mid-payment.
*   **Idempotency**: Implementing request keys to prevent duplicate charges in high-latency environments.
*   **Extended API**: Adding flows for partial captures and instant refunds directly from the merchant dashboard.

---

*Built with ❤️ to demonstrate the intersection of code, commerce, and user experience.*
