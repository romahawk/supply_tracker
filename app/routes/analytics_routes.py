from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models import User
from app.utils.role_check import is_admin_or_superuser

analytics_bp = Blueprint('analytics', __name__, url_prefix='/analytics')

@analytics_bp.route('/')
@login_required
def view_analytics():
    if not is_admin_or_superuser(current_user):
        return "Access denied", 403
    return render_template('analytics.html', title='Analytics Dashboard')
