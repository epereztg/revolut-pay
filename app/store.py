"""In-memory order store — no database required."""
import threading
from typing import Any, Dict, List, Optional

# Thread-safe lock for concurrent access
_lock = threading.Lock()

# Structure: { order_id: { amount, currency, status, public_token } }
orders_store: Dict[str, Dict[str, Any]] = {}


def add_order(order_id: str, amount: int, currency: str, public_token: str) -> None:
    with _lock:
        orders_store[order_id] = {
            "order_id": order_id,
            "amount": amount,
            "currency": currency,
            "status": "pending",
            "public_token": public_token,
        }


def get_order(order_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        return orders_store.get(order_id)


def update_order_status(order_id: str, status: str) -> bool:
    with _lock:
        if order_id in orders_store:
            orders_store[order_id]["status"] = status
            return True
        return False


def get_orders_by_ids(order_ids: List[str]) -> List[Dict[str, Any]]:
    with _lock:
        return [
            {k: v for k, v in orders_store[oid].items() if k != "public_token"}
            for oid in order_ids
            if oid in orders_store
        ]
