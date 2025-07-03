from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models import ActivityLog, User
from app.roles import role_required

activity_bp = Blueprint('activity', __name__)

@activity_bp.route('/activity_logs')
@login_required
@role_required('admin')
def activity_logs():
    logs = ActivityLog.query.order_by(ActivityLog.timestamp.desc()).limit(100).all()
    return render_template("activity_logs.html", logs=logs)
