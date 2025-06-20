from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import db, DeliveredGoods, WarehouseStock, Order, StockReportEntry
from datetime import datetime
from app.roles import can_edit, can_view_all


delivered_bp = Blueprint('delivered', __name__)

@delivered_bp.route('/delivered')
@login_required
def delivered():
    if can_view_all(current_user.role):
        delivered_items = DeliveredGoods.query.order_by(DeliveredGoods.delivery_date.desc()).all()
    else:
        delivered_items = DeliveredGoods.query.filter_by(user_id=current_user.id).order_by(DeliveredGoods.delivery_date.desc()).all()

    reported_order_numbers = {
    ws.order_number
    for ws in WarehouseStock.query.join(StockReportEntry, WarehouseStock.id == StockReportEntry.related_order_id)
}


    return render_template(
        'delivered.html',
        delivered_items=delivered_items,
        reported_order_numbers=reported_order_numbers
    )


@delivered_bp.route('/restore_to_dashboard', methods=['POST'])
@login_required
def restore_to_dashboard():
    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('delivered.delivered'))

    item_id = request.args.get('item_id', type=int)
    item = DeliveredGoods.query.get_or_404(item_id)

    new_order = Order(
        user_id=item.user_id,
        order_number=item.order_number,
        product_name=item.product_name,
        quantity=item.quantity,
        etd=datetime.now().strftime('%Y-%m-%d'),
        eta=datetime.now().strftime('%Y-%m-%d'),
        ata=datetime.now().strftime('%Y-%m-%d'),
        transit_status="Restored",
        transport=item.transport
    )

    db.session.add(new_order)
    db.session.delete(item)
    db.session.commit()
    flash("Item restored to dashboard.", "success")
    return redirect(url_for('delivered.delivered'))

@delivered_bp.route('/delivered/edit/<int:item_id>', methods=['GET', 'POST'])
@login_required
def edit_delivered(item_id):
    item = DeliveredGoods.query.get_or_404(item_id)

    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('delivered.delivered'))

    if request.method == 'POST':
        item.order_number = request.form.get('order_number')
        item.product_name = request.form.get('product_name')
        item.quantity = request.form.get('quantity')
        item.delivery_date = request.form.get('delivery_date')
        item.transport = request.form.get('transport')
        item.notes = request.form.get('notes')
        db.session.commit()
        flash("Delivered item updated successfully.", "success")
        return redirect(url_for('delivered.delivered'))

    return render_template('edit_delivered.html', item=item)
