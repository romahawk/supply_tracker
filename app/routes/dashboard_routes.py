from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_required, current_user
from app.models import Order, WarehouseStock, DeliveredGoods
from app.decorators import role_required
from app.database import db
from datetime import datetime
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
    orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.order_date.asc()).all()

    in_transit_count = Order.query.filter_by(user_id=current_user.id).count()
    warehouse_count = WarehouseStock.query.filter_by(user_id=current_user.id).count()
    delivered_count = DeliveredGoods.query.filter_by(user_id=current_user.id).count()

    return render_template(
        'dashboard.html',
        orders=orders,
        now=datetime.now(),
        product_list=load_products(),
        in_transit_count=in_transit_count,
        warehouse_count=warehouse_count,
        delivered_count=delivered_count
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
    flash('Order deleted successfully.', 'success')
    return redirect(url_for('dashboard.dashboard'))

