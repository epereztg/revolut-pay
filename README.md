# Revolut Pay & Checkout Integration Demo

This project is a demonstration of integrating the **Revolut Checkout SDK** into a modern web application. 

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.8+
- Node.js & npm (for modern SDK bundling)

### 2. Setup
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install NPM dependencies
npm install

# Build the modern SDK bundle
npm run build
```

### 3. Environment Variables
Generate the `.env` file from the template and fill in your keys:
```bash
cp .env.template .env
```

The file requires:
- `PUBLIC_API_KEY`: Your Revolut Merchant public key.
- `PRIVATE_SECRET_KEY`: Your Revolut Merchant private key.
- `FLASK_SECRET_KEY`: A random string for session security.

### 4. Run the Application
```bash
python3 run.py
```
Access the dashboard at `http://localhost:5000`.

---

## 🛠 Features

### 1. Dual Integration Methods
- **Revolut Pay (CDN)**: Fast, one-click checkout using the standard `embed.js` script.

### 2. Premium Fintech UI
- **Dynamic Dashboard**: Real-time polling to track order statuses (Completed, Pending, Failed).
- **Responsive Checkout**: A clean, centered product view for the "Snowboard Jacket" demo item.

### 3. Backend Architecture
- **Order Management**: Synchronized local storage with Revolut API states.
- **Line Items**: Correct implementation of the Revolut Pay `lineItems` schema (including strings and quantities).
- **Webhook Ready**: Structured to handle asynchronous status updates from Revolut.

## 📁 Project Structure
- `/app/routes/`: Flask blueprints for orders and dashboard logic.
- `/app/services/`: Core logic for Revolut API communication.
- `/app/src/`: Modern JavaScript source files (NPM-based).
- `/app/static/js/`: Bundled and legacy JavaScript files.
- `/app/templates/`: Modular HTML templates using Jinja.
