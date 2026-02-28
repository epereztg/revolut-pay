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


def create_order(amount: int, currency: str = "EUR") -> dict:
    """Create an order in Revolut sandbox and return the full response."""
    payload = {
        "amount": amount,
        "currency": currency
    }
    print("-----REQUEST PAYLOAD (create_order)-----")
    print(payload)
    print("-----REQUEST HEADERS (create_order)-----")
    print(_auth_headers())
    print("-----------------")
    response = requests.post(
        f"{SANDBOX_BASE}/orders",
        json=payload,
        headers=_auth_headers(),
        timeout=10,
    )
    print("-----RESPONSE (create_order)-----")
    print(response.json())
    print("-----------------")
    response.raise_for_status()
    return response.json()


def retrieve_order(order_id: str) -> dict:
    """Retrieve a single order from Revolut sandbox by ID."""

    response = requests.get(
        f"{SANDBOX_BASE}/orders/{order_id}",
        headers=_auth_headers(),
        timeout=10,
    )
    print("-----RETRIEVE ORDER (retrieve_order)-----:", order_id)
    print(response.json())
    print("-----------------")
    response.raise_for_status()
    return response.json()
