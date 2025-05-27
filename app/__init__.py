from flask import Flask
from flask_login import LoginManager
from flask_migrate import Migrate
from .database import db, init_db
from .models import User
from app.routes import register_routes
from datetime import datetime

login_manager = LoginManager()
login_manager.login_view = 'auth.login'

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'your-secret-key'  # Replace with env var in production
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../instance/supply_tracker.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    init_db(app)
    login_manager.init_app(app)
    Migrate(app, db)

    register_routes(app)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    @app.template_filter('format_date')
    def format_date(value):
        try:
            if isinstance(value, str):
                for fmt in ("%Y-%m-%d", "%d.%m.%y", "%d.%m.%Y"):
                    try:
                        value = datetime.strptime(value, fmt)
                        break
                    except ValueError:
                        continue
            return value.strftime("%d %b %Y")
        except Exception:
            return value

    return app
