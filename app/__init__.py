"""Flask application factory."""
from flask import Flask
from .config import Config
from .routes.orders import orders_bp
from .routes.webhooks import webhooks_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = Config.FLASK_SECRET_KEY

    # Register blueprints
    app.register_blueprint(orders_bp)
    app.register_blueprint(webhooks_bp)

    return app
