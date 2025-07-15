from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import db, DeliveredGoods, WarehouseStock, Order, StockReportEntry
from datetime import datetime
from app.roles import can_edit, can_view_all
from app.utils.logging import log_activity
from sqlalchemy import or_, func, extract
from app.roles import can_view_all

delivered_bp = Blueprint('delivered', __name__)

@delivered_bp.route('/delivered')
@login_required
def delivered():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)

    # Apply filters
    transport = request.args.get('transport')
    month = request.args.get('month')
    year = request.args.get('year')
    search = request.args.get('search', '')

    # ✅ Apply role-based visibility
    if can_view_all(current_user.role):
        query = DeliveredGoods.query
    else:
        query = DeliveredGoods.query.filter_by(user_id=current_user.id)

    # Continue with filters
    if transport:
        query = query.filter_by(transport=transport)
    if month:
        query = query.filter(extract('month', DeliveredGoods.delivery_date) == int(month))
    if year:
        query = query.filter(extract('year', DeliveredGoods.delivery_date) == int(year))
    if search:
        like_term = f"%{search.lower()}%"
        query = query.filter(or_(
            func.lower(DeliveredGoods.order_number).like(like_term),
            func.lower(DeliveredGoods.product_name).like(like_term),
            func.lower(DeliveredGoods.notes).like(like_term)
        ))

    delivered_items = query.order_by(DeliveredGoods.delivery_date.desc()).paginate(page=page, per_page=per_page)

    reported_order_numbers = set()
    all_entries = StockReportEntry.query.all()

    for entry in all_entries:
        order_number = None

        # Try resolving from WarehouseStock
        warehouse_order = WarehouseStock.query.get(entry.related_order_id)
        if warehouse_order:
            order_number = warehouse_order.order_number
        else:
            # Fallback: Try DeliveredGoods
            delivered_order = DeliveredGoods.query.get(entry.related_order_id)
            if delivered_order:
                order_number = delivered_order.order_number

        if order_number:
            reported_order_numbers.add(order_number)



    return render_template(
        'delivered.html',
        delivered_items=delivered_items.items,
        pagination=delivered_items,
        per_page=per_page,
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
        log_activity("Edit Delivered Item", f"#{item.order_number}")
        flash("Delivered item updated successfully.", "success")
        return redirect(url_for('delivered.delivered'))

    return render_template('edit_delivered.html', item=item)
