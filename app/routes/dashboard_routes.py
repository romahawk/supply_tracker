from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_required, current_user
from app.models import Order, WarehouseStock, DeliveredGoods
from app.decorators import role_required
from app.database import db
from datetime import datetime
from app.roles import can_view_all
from app.utils.logging import log_activity
import os


dashboard_bp = Blueprint('dashboard', __name__)

# ✅ Re-added inline load_products()
PRODUCTS_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'products.txt'))

def load_products():
    try:
        with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
            return sorted(set(line.strip() for line in f if line.strip()))
    except FileNotFoundError:
        return []

@dashboard_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.dashboard'))
    return redirect(url_for('auth.login'))

@dashboard_bp.route('/dashboard')
@login_required
def dashboard():
    from app.roles import can_view_all
    from app.models import Order, WarehouseStock, DeliveredGoods

    if can_view_all(current_user.role):
        in_transit_count = Order.query.count()
        warehouse_count = WarehouseStock.query.count()
        delivered_count = DeliveredGoods.query.count()
    else:
        in_transit_count = Order.query.filter_by(user_id=current_user.id).count()
        warehouse_count = WarehouseStock.query.filter_by(user_id=current_user.id).count()
        delivered_count = DeliveredGoods.query.filter_by(user_id=current_user.id).count()

    return render_template(
        'dashboard.html',
        in_transit_count=in_transit_count,
        warehouse_count=warehouse_count,
        delivered_count=delivered_count,
        now=datetime.now()  # ✅ Add this line
    )


@dashboard_bp.route('/delete_order/<int:order_id>', methods=['POST'])
@login_required
@role_required('admin')
def delete_order(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id and current_user.role != 'admin':
        flash("Unauthorized delete attempt.", "error")
        return redirect(url_for('dashboard.dashboard'))
    
    db.session.delete(order)
    db.session.commit()
    log_activity("Delete Order (Admin)", f"#{order.order_number}")
    flash('Order deleted successfully.', 'success')
    return redirect(url_for('dashboard.dashboard'))

