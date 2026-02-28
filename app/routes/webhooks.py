"""Webhooks blueprint — POST /webhooks/revolut."""
import hashlib
import hmac
import json
from typing import Optional

from flask import Blueprint, jsonify, request
from ..config import Config
from .. import store

webhooks_bp = Blueprint("webhooks", __name__)


def _verify_signature(payload_bytes: bytes, signature_header: Optional[str]) -> bool:
    """
    Revolut sends: Revolut-Signature: v1=<hex_digest>
    Computed as: HMAC-SHA256(secret_key, payload_bytes)
    """
    if not signature_header:
        return False

    secret = Config.PRIVATE_SECRET_KEY.encode()
    computed = hmac.new(secret, payload_bytes, hashlib.sha256).hexdigest()

    # Header may contain multiple signatures separated by comma: v1=aaa,v1=bbb
    for part in signature_header.split(","):
        part = part.strip()
        if part.startswith("v1="):
            received = part[3:]
            if hmac.compare_digest(computed, received):
                return True
    return False


@webhooks_bp.route("/webhooks/revolut", methods=["POST"])
def revolut_webhook():
    raw_body = request.get_data()
    signature = request.headers.get("Revolut-Signature")

    if not _verify_signature(raw_body, signature):
        return jsonify({"error": "Invalid signature"}), 400

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400

    order_data = event.get("order", {})
    order_id = order_data.get("id")
    new_state = order_data.get("state", "")

    if order_id and new_state:
        store.update_order_status(order_id, new_state)

    return jsonify({"received": True}), 200
