from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.models import User, db
from app.roles import can_view_all

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/admin/user_management')
@login_required
def user_management():
    if current_user.role != 'admin':
        flash("Access denied: Admins only.", "danger")
        return redirect(url_for('dashboard.dashboard'))

    users = User.query.all()
    return render_template('admin_users.html', users=users)

@admin_bp.route('/admin/change-role/<int:user_id>', methods=['POST'])
@login_required
def change_role(user_id):
    if current_user.role != 'admin':
        flash("Access denied: Admins only.", "danger")
        return redirect(url_for('dashboard.dashboard'))

    user = User.query.get_or_404(user_id)
    new_role = request.form.get('new_role')
    if new_role:
        user.role = new_role
        db.session.commit()
        flash(f"Role for {user.username} updated to {new_role}.", "success")

    return redirect(url_for('admin.user_management'))
