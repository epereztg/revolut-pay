"""Webhooks blueprint — POST /webhooks/revolut."""
import hashlib
import hmac
import json
from typing import Optional

from flask import Blueprint, jsonify, request
from ..config import Config
from .. import store
from .. import environment

webhooks_bp = Blueprint("webhooks", __name__)


def _verify_signature(payload_bytes: bytes, signature_header: Optional[str], secret: str) -> bool:
    """
    Revolut sends: Revolut-Signature: v1=<hex_digest>
    Computed as: HMAC-SHA256(secret_key, payload_bytes)
    """
    if not signature_header or not secret:
        return False

    computed = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()

    # Header may contain multiple signatures separated by comma: v1=aaa,v1=bbb
    for part in signature_header.split(","):
        part = part.strip()
        if part.startswith("v1="):
            received = part[3:]
            if hmac.compare_digest(computed, received):
                return True
    return False


# The sandbox and production Revolut Business accounts are entirely separate
# (different secret keys), so each needs its own webhook URL configured in
# its own dashboard. /webhooks/revolut keeps working unchanged for whatever
# is already configured against sandbox; /webhooks/revolut/prod is the new
# URL to register against the production account. Mode is baked into the
# URL rather than read from the sidebar toggle, since an async webhook can
# arrive well after the toggle has moved on to something else.
@webhooks_bp.route("/webhooks/revolut", methods=["POST"], defaults={"mode": "sandbox"})
@webhooks_bp.route("/webhooks/revolut/<mode>", methods=["POST"])
def revolut_webhook(mode: str):
    if mode not in ("sandbox", "prod"):
        return jsonify({"error": "Unknown environment"}), 404

    secret = Config.PROD_PRIVATE_SECRET_KEY if mode == "prod" else Config.PRIVATE_SECRET_KEY

    raw_body = request.get_data()
    signature = request.headers.get("Revolut-Signature")

    if not _verify_signature(raw_body, signature, secret):
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


def _verify_payload_signature(payload_bytes: bytes, signature_header: Optional[str], signing_key: str) -> bool:
    """
    HMAC-SHA256(signing_key, payload_bytes), sent in the
    Revolut-Pay-Payload-Signature header — signing_key is the one returned
    when registering the webhook via POST /synchronous-webhooks (verified
    against the live API), not the merchant secret key.

    The header format (bare hex vs "v1=<hex>") isn't specified alongside the
    request/response schema, so this accepts both.
    """
    if not signature_header or not signing_key:
        return False

    computed = hmac.new(signing_key.encode(), payload_bytes, hashlib.sha256).hexdigest()

    for part in signature_header.split(","):
        part = part.strip()
        candidate = part[3:] if part.startswith("v1=") else part
        if hmac.compare_digest(computed, candidate):
            return True
    return False


# Sample delivery methods offered once an address is validated. A real
# integration would fetch these from a database or shipping partner based
# on the validated address.
_DELIVERY_METHODS = [
    {"ref": "standard", "amount": 0, "label": "Standard delivery", "description": "5-7 business days"},
    {"ref": "express", "amount": 500, "label": "Express delivery", "description": "1-2 business days"},
]


@webhooks_bp.route("/webhooks/revolut/fast-checkout-address/<mode>", methods=["POST"])
def fast_checkout_validate_address(mode: str):
    """
    Fast checkout shipping-address validation webhook
    (event_type: fast_checkout.validate_address). Revolut Pay calls this
    synchronously while the shopper picks a shipping address — SLA is a 1s
    connect / 5s socket timeout, so keep this fast and dependency-free.

    <mode> ('sandbox' or 'prod') is baked into the registered URL so this
    endpoint knows which signing key to verify against, independent of
    whatever the sidebar toggle happens to be set to at request time.

    Request body (per Revolut's "Validate the address and get delivery
    methods" spec):
        {
            "order_id": str,
            "shipping_address": {
                "street_line_1": str, "street_line_2": str, "region": str,
                "city": str, "country_code": str, "postcode": str
            },
            "metadata": dict
        }

    Response body:
        {"valid": bool, "delivery_methods": [{"ref", "amount", "label", "description"}]}
    An invalid address (or one with nothing deliverable) must return
    {"valid": false, "delivery_methods": []}.
    """
    raw_body = request.get_data()
    signature = request.headers.get("Revolut-Pay-Payload-Signature")

    # Log everything as soon as it arrives — before any validation — so a
    # rejected request (bad mode, bad signature, bad JSON) is still visible
    # here instead of vanishing silently.
    print(f"\n--- [FAST CHECKOUT] incoming request ({mode}) ---")
    print(f"Headers: {dict(request.headers)}")
    print(f"Body: {raw_body!r}")
    print("-------------------------------------------\n")

    if mode not in ("sandbox", "prod"):
        return jsonify({"error": "Unknown environment"}), 404

    webhook = environment.get_fast_checkout_webhook(mode)
    signing_key = webhook.get("signing_key", "")

    if not _verify_payload_signature(raw_body, signature, signing_key):
        return jsonify({"error": "Invalid signature"}), 400

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON"}), 400

    address = event.get("shipping_address") or {}

    # Minimal deliverability check — a real integration would validate
    # against an address database and/or a shipping partner here.
    #
    # NOTE: the docs say this field is "country_code", but a real production
    # call was observed sending "country" instead (e.g. {"country": "ES"},
    # no "country_code" key at all) — accepting both since docs and the live
    # API disagree here.
    country = address.get("country_code") or address.get("country")
    is_valid = bool(country) and bool(address.get("postcode"))

    if not is_valid:
        return jsonify({"valid": False, "delivery_methods": []}), 200

    return jsonify({"valid": True, "delivery_methods": _DELIVERY_METHODS}), 200
