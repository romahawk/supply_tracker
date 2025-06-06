
from flask import Blueprint, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import db, Order, WarehouseStock, DeliveredGoods
from datetime import datetime


restore_bp = Blueprint('restore', __name__)

@restore_bp.route('/restore_to_dashboard', methods=['POST'])
@login_required
def restore_to_dashboard():
    item_id = request.args.get("item_id")
    item = WarehouseStock.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        flash("Unauthorized access", "danger")
        return redirect(url_for("warehouse.warehouse"))

    restored_order = Order(
        user_id=current_user.id,
        order_date=datetime.now().strftime('%d.%m.%y'),
        order_number=item.order_number,
        product_name=item.product_name,
        buyer="Restored",
        responsible="Restored",
        quantity=item.quantity,
        required_delivery="",
        terms_of_delivery="Restored",
        payment_date="",
        etd="",
        eta="",
        ata=item.ata,
        transit_status="in process",
        transport=item.transport,
    )

    db.session.add(restored_order)
    db.session.delete(item)
    db.session.commit()
    flash("Order restored to dashboard.", "success")
    return redirect(url_for("dashboard.dashboard"))


@restore_bp.route('/restore_from_delivered', methods=['POST'])
@login_required
def restore_from_delivered():
    item_id = request.args.get("item_id")
    item = DeliveredGoods.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        flash("Unauthorized access", "danger")
        return redirect(url_for("delivered.delivered"))

    restored_order = Order(
        user_id=current_user.id,
        order_date=datetime.now().strftime('%d.%m.%y'),
        order_number=item.order_number,
        product_name=item.product_name,
        buyer="Restored",
        responsible="Restored",
        quantity=item.quantity,
        required_delivery="",
        terms_of_delivery="Restored",
        payment_date="",
        etd="",
        eta="",
        # ata=item.ata,
        transit_status="in process",
        transport=item.transport,
    )

    db.session.add(restored_order)
    db.session.delete(item)
    db.session.commit()
    flash("Order restored to dashboard.", "success")
    return redirect(url_for("dashboard.dashboard"))
