"""Flask application factory."""
from flask import Flask
from .config import Config
from .routes.orders import orders_bp
from .routes.webhooks import webhooks_bp


def create_app() -> Flask:
    Config.validate()
    app = Flask(__name__)
    app.secret_key = Config.FLASK_SECRET_KEY

    # Register blueprints
    app.register_blueprint(orders_bp)
    app.register_blueprint(webhooks_bp)

    @app.errorhandler(404)
    def resource_not_found(e):
        return {"error": "Not Found", "message": str(e)}, 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return {"error": "Method Not Allowed", "message": str(e)}, 405

    @app.errorhandler(500)
    def internal_server_error(e):
        return {"error": "Internal Server Error", "message": str(e)}, 500

    return app
