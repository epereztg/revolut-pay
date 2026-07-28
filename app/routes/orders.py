"""Orders blueprint — POST /api/orders, GET /api/orders, GET /api/orders/<id>."""
from flask import Blueprint, jsonify, request, render_template, redirect
from ..services.revolut_service import (  # pyrefly: ignore [missing-import]
    create_order as revolut_create_order,
    create_order_with_payload as revolut_create_order_with_payload,
    retrieve_order as revolut_retrieve_order,
)
from .. import store  # pyrefly: ignore [missing-import]
from .. import environment

orders_bp = Blueprint("orders", __name__)


@orders_bp.route("/")
def index():
    return render_template("pay.html")


@orders_bp.route("/pay")
def pay_page():
    return render_template("pay.html", public_api_key=environment.get_public_key())


@orders_bp.route("/environment/toggle", methods=["POST"])
def toggle_environment():
    """Flips the sandbox/production toggle used by the sidebar badge."""
    target = "prod" if environment.get_mode() == "sandbox" else "sandbox"
    try:
        environment.set_mode(target)
    except ValueError:
        # Missing keys for the target environment — leave the mode unchanged.
        pass
    return redirect(request.referrer or "/dashboard")


@orders_bp.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")


@orders_bp.route("/orders")
def orders_page():
    return render_template("orders.html")

@orders_bp.route("/hpp/api")
def hpp_api_page():
    return render_template("hpp_api.html")

@orders_bp.route("/hpp/link", methods=["GET", "POST"])
def hpp_link_page():
    """Render the payment link page. On POST, create an order and return the checkout URL."""
    if request.method == "POST":
        error = None
        checkout_url = None
        order_id = None

        # Validate amount
        raw_amount = request.form.get("amount", "").strip()
        try:
            amount_float = float(raw_amount)
            if amount_float <= 0:
                raise ValueError
            amount = int(round(amount_float * 100))  # Convert to minor units
        except (ValueError, TypeError):
            error = "Please enter a valid amount greater than 0."
            return render_template("hpp_link.html", error=error, amount=raw_amount)

        currency = "GBP"
        line_items = [{
            "name": "Snowboard Jacket Soft Pink",
            "quantity": 1,
            "unit_amount": amount,
        }]

        try:
            revolut_order = revolut_create_order(amount, currency, line_items=line_items)
        except Exception as exc:
            error = f"Revolut API error: {str(exc)}"
            return render_template("hpp_link.html", error=error, amount=raw_amount)

        order_id = revolut_order["id"]
        public_token = revolut_order["token"]
        checkout_url = revolut_order.get("checkout_url", "")

        store.add_order(
            order_id=order_id,
            amount=amount,
            currency=currency,
            public_token=public_token,
        )

        if not checkout_url:
            error = "No checkout URL returned."
            return render_template("hpp_link.html", error=error, amount=raw_amount)

        return render_template(
            "hpp_link.html",
            checkout_url=checkout_url,
            order_id=order_id,
            amount=raw_amount,
        )

    return render_template("hpp_link.html")

@orders_bp.route("/pay/fast-checkout")
def fast_checkout_page():
    return render_template("fast_checkout.html", public_api_key=environment.get_public_key())


@orders_bp.route("/subscriptions")
def subscriptions_page():
    return render_template("subscriptions.html", public_api_key=environment.get_public_key())


@orders_bp.route("/checkout/embedded")
def checkout_embedded_page():
    return render_template("checkout_embedded.html", public_api_key=environment.get_public_key())


@orders_bp.route("/api/orders", methods=["POST"])
def create_order_endpoint():
    data = request.get_json(silent=True) or {}

    # Input validation
    amount = data.get("amount")
    if amount is None:
        return jsonify({"error": "amount is required"}), 400

    try:
        amount = int(amount)
    except (ValueError, TypeError):
        return jsonify({"error": "amount must be an integer (in minor units)"}), 400

    if amount <= 0:
        return jsonify({"error": "amount must be a positive integer"}), 400

    currency = data.get("currency", "GBP").upper()

    # If the payload has fields beyond amount/currency, pass it through directly to Revolut
    SIMPLE_KEYS = {"amount", "currency"}
    if set(data.keys()) - SIMPLE_KEYS:
        try:
            revolut_order = revolut_create_order_with_payload(data)
        except Exception as exc:
            return jsonify({"error": f"Revolut API error: {str(exc)}"}), 502
    else:
        line_items = [{
            "name": "Snowboard Jacket Soft Pink",
            "quantity": 1,
            "unit_amount": amount
        }]
        try:
            revolut_order = revolut_create_order(amount, currency, line_items=line_items)
        except Exception as exc:
            return jsonify({"error": f"Revolut API error: {str(exc)}"}), 502

    order_id = revolut_order["id"]
    public_token = revolut_order["token"]
    checkout_url = revolut_order.get("checkout_url", "")

    store.add_order(
        order_id=order_id,
        amount=amount,
        currency=currency,
        public_token=public_token
    )

    return jsonify({
        "order_id": order_id,
        "public_token": public_token,
        "checkout_url": checkout_url,
        "amount": amount,
        "currency": currency,
    }), 201


@orders_bp.route("/api/orders", methods=["GET"])
def get_orders_endpoint():
    ids_param = request.args.get("ids", "")
    order_ids = [oid.strip() for oid in ids_param.split(",") if oid.strip()]

    if not order_ids:
        return jsonify([]), 200

    orders = store.get_orders_by_ids(order_ids)
    return jsonify(orders), 200


@orders_bp.route("/api/orders/<order_id>", methods=["GET"])
def get_order_detail_endpoint(order_id: str):
    """Retrieve a single order from Revolut and merge with local store data."""
    try:
        revolut_data = revolut_retrieve_order(order_id)
    except Exception as exc:
        return jsonify({"error": f"Revolut API error: {str(exc)}"}), 502

    # Merge with local store data (currency stored locally since Revolut may drop it)
    local = store.get_order(order_id) or {}

    # Update local status to stay in sync
    new_state = revolut_data.get("state") or revolut_data.get("status")
    if new_state:
        store.update_order_status(order_id, new_state)

    return jsonify(revolut_data), 200


@orders_bp.route("/api/orders/<order_id>/cancel", methods=["POST"])
def cancel_order_endpoint(order_id: str):
    """Cancel an order on Revolut."""
    try:
        from ..services.revolut_service import cancel_order as revolut_cancel_order
        revolut_cancel_order(order_id)
        store.update_order_status(order_id, "CANCELLED")
        return jsonify({"status": "cancelled"}), 200
    except Exception as exc:
        return jsonify({"error": f"Failed to cancel: {str(exc)}"}), 502


@orders_bp.route("/api/fast-checkout/webhook", methods=["POST"])
def register_fast_checkout_webhook():
    """Registers this app's address-validation endpoint with Revolut for the
    current environment. `base_url` must be a public HTTPS URL (e.g. an
    ngrok tunnel) since Revolut calls it server-to-server."""
    data = request.get_json(silent=True) or {}
    base_url = (data.get("base_url") or "").strip().rstrip("/")

    if not base_url.startswith("https://"):
        return jsonify({"error": "base_url must be a public HTTPS URL (e.g. an ngrok tunnel)"}), 400

    mode = environment.get_mode()
    webhook_url = f"{base_url}/webhooks/revolut/fast-checkout-address/{mode}"

    try:
        from ..services.revolut_service import register_address_validation_webhook
        result = register_address_validation_webhook(webhook_url)
    except Exception as exc:
        return jsonify({"error": f"Revolut API error: {str(exc)}"}), 502

    environment.set_fast_checkout_webhook(mode, {
        "id": result["id"],
        "url": result["url"],
        "signing_key": result["signing_key"],
    })

    return jsonify({"mode": mode, "url": result["url"], "id": result["id"]}), 200


@orders_bp.route("/api/fast-checkout/webhook", methods=["GET"])
def get_fast_checkout_webhook_status():
    mode = environment.get_mode()
    webhook = environment.get_fast_checkout_webhook(mode)
    return jsonify({
        "mode": mode,
        "registered": bool(webhook),
        "url": webhook.get("url"),
    }), 200
