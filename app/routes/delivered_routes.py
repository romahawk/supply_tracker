from flask import Blueprint, render_template
from flask_login import login_required, current_user
from app.models import DeliveredGoods
from datetime import datetime

delivered_bp = Blueprint('delivered', __name__)

@delivered_bp.route('/delivered')
@login_required
def delivered():
    delivered_items = DeliveredGoods.query.filter_by(user_id=current_user.id).all()

    for item in delivered_items:
        if isinstance(item.delivery_date, str):
            try:
                item.delivery_date = datetime.strptime(item.delivery_date, '%Y-%m-%d')
            except ValueError:
                pass

    return render_template('delivered.html', delivered_items=delivered_items)


from flask import request, redirect, url_for, flash
from app.models import db

@delivered_bp.route('/edit_delivered/<int:item_id>', methods=['GET', 'POST'])
@login_required
def edit_delivered(item_id):
    item = DeliveredGoods.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        flash('Unauthorized access', 'danger')
        return redirect(url_for('delivered.delivered'))

    if request.method == 'POST':
        item.quantity = float(request.form['quantity'])
        item.delivery_source = request.form['delivery_source']
        item.delivery_date = request.form['delivery_date']
        item.notes = request.form.get("notes")
        db.session.commit()
        flash('Delivered item updated successfully!', 'success')
        return redirect(url_for('delivered.delivered'))

    return render_template('edit_delivered.html', item=item)
