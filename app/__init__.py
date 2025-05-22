from flask import Flask
from flask_login import LoginManager
from flask_migrate import Migrate
from .database import db, init_db
from .models import User
from datetime import datetime

login_manager = LoginManager()
login_manager.login_view = 'main.login'

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'your-secret-key'  # Use env var later
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///../instance/supply_tracker.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions
    init_db(app)
    login_manager.init_app(app)
    Migrate(app, db)

    from .routes import main
    app.register_blueprint(main)

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    @app.template_filter('format_date')
    def format_date(value):
        try:
            # Try parsing known formats
            if isinstance(value, str):
                # Convert from string to datetime
                for fmt in ("%Y-%m-%d", "%d.%m.%y", "%d.%m.%Y"):
                    try:
                        value = datetime.strptime(value, fmt)
                        break
                    except ValueError:
                        continue

            # If it's already a datetime object or parsed successfully
            return value.strftime("%d %b %Y")  # Example: 06 May 2025
        except Exception:
            return value  # fallback to raw

    return app
