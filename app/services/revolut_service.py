"""Service layer for Revolut Merchant API calls."""
import requests
from .. import environment


def _base_url() -> str:
    """Resolves to the sandbox or production Merchant API host based on the current toggle."""
    return environment.get_base_url()


def _auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {environment.get_secret_key()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Revolut-Api-Version": "2026-04-20"
    }

def _log_api_call(method: str, endpoint: str, payload: dict = None, response: dict = None):
    """Utility to log API interactions for easier debugging/integration support."""
    print(f"\n--- [REVOLUT API] {method} {endpoint} ---")
    if payload:
        print(f"Request Payload: {payload}")
    if response:
        print(f"Response: {response}")
    print("-------------------------------------------\n")


def create_order_with_payload(payload: dict) -> dict:
    """Create an order in Revolut sandbox using a full custom payload."""
    _log_api_call("POST", "/orders", payload)
    response = requests.post(
        f"{_base_url()}orders",
        json=payload,
        headers=_auth_headers(),
        timeout=10,
    )
    res_json = response.json()
    _log_api_call("POST", "/orders", payload, res_json)
    response.raise_for_status()
    return res_json


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
        "redirect_url": "https://www.revolut.com/"
    }
    _log_api_call("POST", "/orders", payload)
    response = requests.post(
        f"{_base_url()}orders",
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
        f"{_base_url()}orders/{order_id}",
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
        f"{_base_url()}orders/{order_id}/cancel",
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


def register_address_validation_webhook(url: str) -> dict:
    """
    Registers (or replaces — Revolut overrides any previous registration for
    this event_type) the Fast checkout shipping-address validation webhook
    for the current environment. Revolut Pay calls `url` synchronously while
    the shopper is picking a shipping address.

    Verified against the live sandbox API: returns
    {"id", "url", "event_type", "signing_key"}.
    """
    payload = {"event_type": "fast_checkout.validate_address", "url": url}
    _log_api_call("POST", "/synchronous-webhooks", payload)
    response = requests.post(
        f"{_base_url()}synchronous-webhooks",
        json=payload,
        headers=_auth_headers(),
        timeout=10,
    )
    res_json = response.json()
    _log_api_call("POST", "/synchronous-webhooks", payload, res_json)
    response.raise_for_status()
    return res_json
