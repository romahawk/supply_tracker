from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import db, Order, WarehouseStock, DeliveredGoods, StockReportEntry
from app.roles import can_edit, can_view_all
from datetime import datetime
from flask import jsonify, make_response
import os
from weasyprint import HTML

warehouse_bp = Blueprint('warehouse', __name__)

@warehouse_bp.route('/warehouse')
@login_required
def warehouse():
    if can_view_all(current_user.role):
        warehouse_items = WarehouseStock.query.order_by(WarehouseStock.ata.desc()).all()
    else:
        warehouse_items = WarehouseStock.query.filter_by(user_id=current_user.id).order_by(WarehouseStock.ata.desc()).all()

    reported_ids = {
        entry.related_order_id
        for entry in StockReportEntry.query.with_entities(StockReportEntry.related_order_id).distinct()
    }

    return render_template('warehouse.html', warehouse_items=warehouse_items, reported_ids=reported_ids)

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
        current_qty = float(item.quantity)
    except ValueError:
        flash('Invalid quantity entered.', 'danger')
        return redirect(url_for('warehouse.warehouse'))

    if qty_to_deliver <= 0 or qty_to_deliver > current_qty:
        flash(f"Invalid quantity. Must be between 1 and {current_qty}.", 'danger')
        return redirect(url_for('warehouse.warehouse'))

    new_qty = current_qty - qty_to_deliver
    if new_qty <= 0:
        db.session.delete(item)
    else:
        item.quantity = new_qty
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

        # Load existing products (optional legacy support)
    products_path = os.path.join(os.getcwd(), 'products.txt')
    if os.path.exists(products_path):
        with open(products_path, 'r', encoding='utf-8') as f:
            product_options = sorted({line.strip() for line in f if line.strip()})
    else:
        product_options = []

    if request.method == 'POST':
        try:
            form = request.form
            entrance_str = form.get('entrance_date')
            entrance_date = datetime.strptime(entrance_str, '%Y-%m-%d') if entrance_str else None

            # Product name is inherited directly from WarehouseStock item
            product_name = item.product_name

            entry = StockReportEntry(
                stage=form.get('stage'),
                entrance_date=entrance_date,
                article_batch=form.get('article_batch'),
                colli=int(form.get('colli') or 0),
                packing=form.get('packing', ''),
                pcs=int(form.get('pcs') or 0),
                colli_per_pal=int(form.get('colli_per_pal') or 0),
                pcs_total=int(form.get('pcs_total') or 0),
                pal=int(form.get('pal') or 0),
                product=product_name,
                gross_kg=float(form.get('gross_kg') or 0),
                net_kg=float(form.get('net_kg') or 0),
                sender=form.get('sender', ''),
                customs_status=form.get('customs_status', ''),
                stockref=form.get('stockref', ''),
                warehouse_address=form.get('warehouse_address', ''),
                client=form.get('client', ''),
                pos_no=form.get('pos_no', ''),
                customer_ref=form.get('customer_ref', ''),
                related_order_id=item.id
            )

            db.session.add(entry)
            db.session.commit()
            flash("Stockreport entry saved successfully.", "success")
            return redirect(url_for('warehouse.warehouse'))

        except Exception as e:
            db.session.rollback()
            flash(f"Error saving stockreport entry: {e}", "danger")

    return render_template('stockreport_form.html', item=item, product_options=product_options)


@warehouse_bp.route('/stockreport/view/<int:item_id>')
@login_required
def view_stockreport_entries(item_id):
    item = WarehouseStock.query.get_or_404(item_id)
    if not can_view_all(current_user.role) and current_user.id != item.user_id:
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))
    entries = StockReportEntry.query.filter_by(related_order_id=item_id).all()
    return render_template('view_stockreport.html', item=item, entries=entries)

@warehouse_bp.route('/stockreport/download/<int:item_id>')
@login_required
def download_stockreport(item_id):
    item = WarehouseStock.query.get_or_404(item_id)
    if not can_view_all(current_user.role) and current_user.id != item.user_id:
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))
    entries = StockReportEntry.query.filter_by(related_order_id=item_id).all()
    html_content = render_template('view_stockreport.html', item=item, entries=entries)
    pdf_content = HTML(string=html_content, base_url=request.url_root).write_pdf()
    response = make_response(pdf_content)
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=StockReport.pdf'
    return response

@warehouse_bp.route('/stockreport/edit/<int:entry_id>', methods=['GET', 'POST'])
@login_required
def edit_stockreport(entry_id):
    entry = StockReportEntry.query.get_or_404(entry_id)

    if request.method == 'POST':
        try:
            if request.form['entrance_date']:
                entry.entrance_date = datetime.strptime(request.form['entrance_date'], '%Y-%m-%d').date()

            entry.article_batch = request.form['article_batch']
            entry.colli = int(request.form['colli'] or 0)
            entry.packing = request.form.get('packing', '')
            entry.pcs = int(request.form['pcs'] or 0)
            entry.colli_per_pal = int(request.form.get('colli_per_pal', 0))
            entry.pcs_total = int(request.form.get('pcs_total', 0))
            entry.pal = int(request.form['pal'] or 0)
            entry.gross_kg = float(request.form['gross_kg'] or 0)
            entry.net_kg = float(request.form['net_kg'] or 0)
            entry.product = request.form.get('product', '')
            entry.sender = request.form.get('sender', '')
            entry.customs_status = request.form['customs_status']
            entry.customs_ozl = request.form.get('customs_ozl', '')
            entry.stockref = request.form.get('stockref', '')

            if request.form.get('signed_date'):
                entry.signed_date = datetime.strptime(request.form['signed_date'], '%Y-%m-%d').date()

            entry.signature_path = request.form.get('signature_path', '')

            db.session.commit()
            flash("Stockreport updated successfully.", "success")
            return redirect(url_for('warehouse.view_stockreport_entries', item_id=entry.related_order_id))

        except Exception as e:
            db.session.rollback()
            flash(f"Error updating entry: {e}", "danger")

    return render_template('edit_stockreport.html', entry=entry)

@warehouse_bp.route('/stockreport/delete/<int:entry_id>', methods=['POST'])
@login_required
def delete_stockreport(entry_id):
    entry = StockReportEntry.query.get_or_404(entry_id)
    item_id = entry.related_order_id

    try:
        db.session.delete(entry)
        db.session.commit()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({"success": True})
        else:
            flash("Stockreport deleted.", "success")
            return redirect(url_for('warehouse.warehouse'))

    except Exception as e:
        db.session.rollback()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({"success": False, "error": str(e)}), 400
        flash(f"Delete failed: {e}", "danger")
        return redirect(url_for('warehouse.warehouse'))
    
@warehouse_bp.route('/stockreport/view_by_order/<string:order_number>')
@login_required
def view_stockreport_by_order(order_number):
    item = WarehouseStock.query.filter_by(order_number=order_number).first_or_404()
    if not can_view_all(current_user.role) and current_user.id != item.user_id:
        flash("Access denied.", "danger")
        return redirect(url_for('warehouse.warehouse'))
    entries = StockReportEntry.query.filter_by(related_order_id=item.id).all()
    return render_template('view_stockreport.html', item=item, entries=entries)

