"""Orders blueprint — POST /api/orders, GET /api/orders, GET /api/orders/<id>."""
from flask import Blueprint, jsonify, request, render_template
from ..services.revolut_service import create_order as revolut_create_order, retrieve_order as revolut_retrieve_order
from .. import store

orders_bp = Blueprint("orders", __name__)


@orders_bp.route("/")
def index():
    return render_template("pay.html")


@orders_bp.route("/pay")
def pay_page():
    from ..config import Config
    return render_template("pay.html", public_api_key=Config.PUBLIC_API_KEY)


@orders_bp.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")


@orders_bp.route("/orders")
def orders_page():
    return render_template("orders.html")


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

    currency = data.get("currency", "EUR").upper()

    try:
        revolut_order = revolut_create_order(amount, currency)
    except Exception as exc:
        return jsonify({"error": f"Revolut API error: {str(exc)}"}), 502

    order_id = revolut_order["id"]
    public_token = revolut_order["public_id"]

    store.add_order(
        order_id=order_id,
        amount=amount,
        currency=currency,
        public_token=public_token
    )

    return jsonify({
        "order_id": order_id,
        "public_token": public_token,
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
