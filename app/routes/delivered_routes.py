from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app.models import DeliveredGoods, db
from app.roles import can_view_all, can_edit  # ✅ Import permissions
from datetime import datetime

delivered_bp = Blueprint('delivered', __name__)

@delivered_bp.route('/delivered')
@login_required
def delivered():
    if can_view_all(current_user.role):
        delivered_items = DeliveredGoods.query.order_by(DeliveredGoods.delivery_date.desc()).all()
    else:
        delivered_items = DeliveredGoods.query.filter_by(user_id=current_user.id).order_by(DeliveredGoods.delivery_date.desc()).all()

    # Normalize delivery_date to datetime for rendering
    for item in delivered_items:
        if isinstance(item.delivery_date, str):
            try:
                item.delivery_date = datetime.strptime(item.delivery_date, '%Y-%m-%d')
            except ValueError:
                pass

    return render_template('delivered.html', delivered_items=delivered_items)

@delivered_bp.route('/edit_delivered/<int:item_id>', methods=['GET', 'POST'])
@login_required
def edit_delivered(item_id):
    if not can_edit(current_user.role):
        flash("Access denied: read-only role", "danger")
        return redirect(url_for('delivered.delivered'))

    item = DeliveredGoods.query.get_or_404(item_id)

    if request.method == 'POST':
        try:
            item.quantity = float(request.form['quantity'])
            item.delivery_source = request.form['delivery_source']
            item.delivery_date = request.form['delivery_date']
            item.notes = request.form.get("notes")
            db.session.commit()
            flash('Delivered item updated successfully!', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f"Error updating item: {e}", 'danger')

        return redirect(url_for('delivered.delivered'))

    return render_template('edit_delivered.html', item=item)
