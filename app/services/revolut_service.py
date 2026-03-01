"""Service layer for Revolut Merchant API calls."""
import requests
from ..config import Config


SANDBOX_BASE = Config.REVOLUT_SANDBOX_BASE_URL


def _auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {Config.PRIVATE_SECRET_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Revolut-Api-Version": "2024-09-01"
    }


def _log_api_call(method: str, endpoint: str, payload: dict = None, response: dict = None):
    """Utility to log API interactions for easier debugging/integration support."""
    print(f"\n--- [REVOLUT API] {method} {endpoint} ---")
    if payload:
        print(f"Request Payload: {payload}")
    if response:
        print(f"Response: {response}")
    print("-------------------------------------------\n")


def create_order(amount: int, currency: str = "GBP", line_items: list = None) -> dict:
    """
    Create an order in Revolut sandbox.
    
    Args:
        amount: Total amount in minor units (e.g., 1000 for 10.00 GBP).
        currency: 3-letter ISO currency code.
        line_items: List of product details for the checkout.
    """
    payload = {
        "amount": amount,
        "currency": currency,
        "line_items": line_items
    }
    
    response = requests.post(
        f"{SANDBOX_BASE}/orders",
        json=payload,
        headers=_auth_headers(),
        timeout=10,
    )
    
    res_json = response.json()
    _log_api_call("POST", "/orders", payload, res_json)
    
    response.raise_for_status()
    return res_json


def retrieve_order(order_id: str) -> dict:
    """Retrieve order details from Revolut to sync status."""
    response = requests.get(
        f"{SANDBOX_BASE}/orders/{order_id}",
        headers=_auth_headers(),
        timeout=10,
    )
    
    res_json = response.json()
    _log_api_call("GET", f"/orders/{order_id}", response=res_json)
    
    response.raise_for_status()
    return res_json


def cancel_order(order_id: str) -> dict:
    """Cancel an existing order in Revolut."""
    response = requests.post(
        f"{SANDBOX_BASE}/orders/{order_id}/cancel",
        headers=_auth_headers(),
        timeout=10,
    )
    
    # Some endpoints might return empty on 204 or a JSON on 200/201
    try:
        res_json = response.json()
    except Exception:
        res_json = {"status": "success"}
        
    _log_api_call("POST", f"/orders/{order_id}/cancel", response=res_json)
    
    response.raise_for_status()
    return res_json
