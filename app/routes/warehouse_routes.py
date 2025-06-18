from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import db, Order, WarehouseStock, DeliveredGoods
from app.roles import can_edit, can_view_all  # ✅ Import role helpers
from datetime import datetime
from app.models import StockReportEntry

warehouse_bp = Blueprint('warehouse', __name__)

@warehouse_bp.route('/warehouse')
@login_required
def warehouse():
    if can_view_all(current_user.role):
        warehouse_items = WarehouseStock.query.order_by(WarehouseStock.ata.desc()).all()
    else:
        warehouse_items = WarehouseStock.query.filter_by(user_id=current_user.id).order_by(WarehouseStock.ata.desc()).all()
    return render_template('warehouse.html', warehouse_items=warehouse_items)

@warehouse_bp.route('/add_warehouse_manual', methods=['POST'])
@login_required
def add_warehouse_manual():
    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))

    try:
        order_number = request.form['order_number']
        product_name = request.form['product_name']
        quantity = float(request.form['quantity'])
        ata = request.form['ata']
        transport = request.form['transport']
        notes = request.form.get('notes', 'Manual Entry')

        if quantity <= 0:
            flash("Quantity must be greater than 0", "danger")
            return redirect(url_for('warehouse.warehouse'))

        new_item = WarehouseStock(
            user_id=current_user.id,
            order_number=order_number,
            product_name=product_name,
            quantity=quantity,
            ata=ata,
            transport=transport,
            notes=notes,
            is_manual=True
        )
        db.session.add(new_item)
        db.session.commit()
        flash("Manual order successfully added to warehouse.", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Error adding manual order: {e}", "danger")

    return redirect(url_for('warehouse.warehouse'))

@warehouse_bp.route('/stock_order/<int:order_id>', methods=['POST'])
@login_required
def stock_order(order_id):
    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('dashboard.dashboard'))

    order = Order.query.get_or_404(order_id)

    new_stock = WarehouseStock(
        user_id=order.user_id,
        order_number=order.order_number,
        product_name=order.product_name,
        quantity=order.quantity,
        ata=order.ata,
        transport=order.transport,
        notes="Stocked from order"
    )
    db.session.add(new_stock)
    db.session.delete(order)
    db.session.commit()

    flash("Order moved to warehouse.", "success")
    return redirect(url_for('dashboard.dashboard'))

@warehouse_bp.route('/deliver_partial/<int:item_id>', methods=['POST'])
@login_required
def deliver_partial(item_id):
    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))

    item = WarehouseStock.query.get_or_404(item_id)

    try:
        qty_to_deliver = float(request.form['quantity'])
    except ValueError:
        flash('Invalid quantity entered.', 'danger')
        return redirect(url_for('warehouse.warehouse'))

    if qty_to_deliver <= 0 or qty_to_deliver > float(item.quantity):
        flash(f"Invalid quantity. Must be between 1 and {item.quantity}.", 'danger')
        return redirect(url_for('warehouse.warehouse'))

    item.quantity = float(item.quantity) - qty_to_deliver
    if item.quantity <= 0:
        db.session.delete(item)
    else:
        db.session.add(item)

    delivery = DeliveredGoods(
        user_id=current_user.id,
        order_number=item.order_number,
        product_name=item.product_name,
        quantity=qty_to_deliver,
        transport=item.transport,
        delivery_source="From Warehouse",
        notes=item.notes,
        delivery_date=datetime.now().strftime('%d.%m.%y')
    )
    db.session.add(delivery)
    db.session.commit()

    flash(f'Delivered {qty_to_deliver} from warehouse.', 'success')
    return redirect(url_for('warehouse.warehouse'))

@warehouse_bp.route('/edit_warehouse/<int:item_id>', methods=['GET', 'POST'])
@login_required
def edit_warehouse(item_id):
    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))

    item = WarehouseStock.query.get_or_404(item_id)

    if request.method == 'POST':
        item.quantity = float(request.form['quantity'])
        item.ata = request.form['ata']
        item.notes = request.form.get("notes")
        db.session.commit()
        flash('Warehouse item updated successfully!', 'success')
        return redirect(url_for('warehouse.warehouse'))

    return render_template('edit_warehouse.html', item=item)

@warehouse_bp.route('/delete_warehouse/<int:item_id>', methods=['POST'])
@login_required
def delete_warehouse(item_id):
    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))

    item = WarehouseStock.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    flash('Warehouse item deleted successfully.', 'success')
    return redirect(url_for('warehouse.warehouse'))

@warehouse_bp.route('/stockreport/<int:item_id>', methods=['GET', 'POST'])
@login_required
def stockreport_entry_form(item_id):
    if not can_edit(current_user.role):
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))

    item = WarehouseStock.query.get_or_404(item_id)

    if request.method == 'POST':
        try:
            entry = StockReportEntry(
                stage=request.form['stage'],
                entrance_date=datetime.strptime(request.form['entrance_date'], '%Y-%m-%d'),
                article_batch=request.form['article_batch'],
                colli=int(request.form['colli']),
                packing=request.form['packing'],
                pcs=int(request.form['pcs']),
                colli_per_pal=int(request.form['colli_per_pal']),
                pcs_total=int(request.form['pcs_total']),
                pal=int(request.form['pal']),
                product=request.form['product'],
                gross_kg=float(request.form['gross_kg']),
                net_kg=float(request.form['net_kg']),
                sender=request.form['sender'],
                customs_status=request.form['customs_status'],
                stockref=request.form['stockref'],
                warehouse_address=request.form['warehouse_address'],
                client=request.form['client'],
                pos_no=request.form['pos_no'],
                customer_ref=request.form['customer_ref'],
                related_order_id=item.id
            )

            db.session.add(entry)
            db.session.commit()
            flash("Stockreport entry saved successfully.", "success")
            return redirect(url_for('warehouse.warehouse'))

        except Exception as e:
            db.session.rollback()
            flash(f"Error saving stockreport entry: {e}", "danger")

    return render_template('stockreport_form.html', item=item)
