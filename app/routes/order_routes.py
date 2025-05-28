
from flask import Blueprint, request, jsonify, render_template
from flask_login import login_required, current_user
from app.models import db, Order
from datetime import datetime
from app.roles import can_view_all
import os

order_bp = Blueprint('order', __name__)

PRODUCTS_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'products.txt'))

def load_products():
    try:
        with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
            return sorted(set(line.strip() for line in f if line.strip()))
    except FileNotFoundError:
        return []

@order_bp.route('/add_order', methods=['POST'])
@login_required
def add_order():
    try:
        data = request.form
        quantity = float(data['quantity'])
        order_date = data['order_date']
        etd = data['etd']
        eta = data['eta']

        if quantity <= 0:
            return jsonify({'success': False, 'message': 'Quantity must be a positive number.'}), 400

        order_date_dt = datetime.strptime(order_date, '%d.%m.%y')
        etd_dt = datetime.strptime(etd, '%d.%m.%y')
        eta_dt = datetime.strptime(eta, '%d.%m.%y')

        if order_date_dt > etd_dt:
            return jsonify({'success': False, 'message': 'Order Date cannot be later than ETD.'}), 400
        if etd_dt > eta_dt:
            return jsonify({'success': False, 'message': 'ETD cannot be later than ETA.'}), 400

        new_order = Order(
            user_id=current_user.id,
            order_date=order_date,
            order_number=data['order_number'],
            product_name=data['product_name'],
            buyer=data['buyer'],
            responsible=data['responsible'],
            quantity=quantity,
            required_delivery=data['required_delivery'],
            terms_of_delivery=data['terms_of_delivery'],
            payment_date=data['payment_date'],
            etd=etd,
            eta=eta,
            ata=data['ata'],
            transit_status=data['transit_status'],
            transport=data['transport']
        )
        db.session.add(new_order)
        db.session.commit()

        new_product = data['product_name'].strip()
        existing_products = load_products()
        if new_product and new_product not in existing_products:
            try:
                with open(PRODUCTS_FILE, 'a', encoding='utf-8') as f:
                    f.write(f"{new_product}\n")
                print(f"✅ Product added to products.txt: {new_product}")
            except Exception as file_error:
                print(f"⚠️ Could not write to products.txt – {file_error}")

        return jsonify({'success': True, 'message': 'Order added successfully!'})

    except ValueError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Invalid quantity format. Use a valid number.'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400

@order_bp.route('/edit_order/<int:order_id>', methods=['GET', 'POST'])
@login_required
def edit_order(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id:
        return jsonify({'success': False, 'message': 'You do not have permission to edit this order.'}), 403

    if request.method == 'POST':
        try:
            data = request.form
            quantity = float(data['quantity'])
            order_date = data['order_date']
            etd = data['etd']
            eta = data['eta']

            if quantity <= 0:
                return jsonify({'success': False, 'message': 'Quantity must be positive.'}), 400

            order_date_dt = datetime.strptime(order_date, '%d.%m.%y')
            etd_dt = datetime.strptime(etd, '%d.%m.%y')
            eta_dt = datetime.strptime(eta, '%d.%m.%y')

            if order_date_dt > etd_dt:
                return jsonify({'success': False, 'message': 'Order Date cannot be later than ETD.'}), 400
            if etd_dt > eta_dt:
                return jsonify({'success': False, 'message': 'ETD cannot be later than ETA.'}), 400

            order.order_date = order_date
            order.order_number = data['order_number']
            order.product_name = data['product_name']
            order.buyer = data['buyer']
            order.responsible = data['responsible']
            order.quantity = quantity
            order.required_delivery = data['required_delivery']
            order.terms_of_delivery = data['terms_of_delivery']
            order.payment_date = data['payment_date']
            order.etd = etd
            order.eta = eta
            order.ata = data['ata']
            order.transit_status = data['transit_status']
            order.transport = data['transport']
            db.session.commit()
            return jsonify({'success': True, 'message': 'Order updated successfully!'})
        except ValueError:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Invalid quantity format.'}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 400

    return render_template('edit_order.html', order=order)

@order_bp.route('/delete_order/<int:order_id>')
@login_required
def delete_order(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        if order.user_id != current_user.id:
            return jsonify({'success': False, 'message': 'Permission denied.'}), 403

        db.session.delete(order)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Order deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400


@order_bp.route('/api/orders')
@login_required
def get_orders():
    if can_view_all(current_user.role):
        orders = Order.query.order_by(Order.order_date.asc()).all()
    else:
        orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.order_date.asc()).all()

    def get_delivery_year(order):
        try:
            date_fields = [order.required_delivery, order.eta, order.ata]
            date_objs = [
                datetime.strptime(d, '%d.%m.%y')
                for d in date_fields if d and d.strip()
            ]
            if date_objs:
                return max(date_objs).year
        except Exception:
            pass
        try:
            return datetime.strptime(order.order_date, '%d.%m.%y').year
        except:
            return None

    orders_data = [{
        'id': order.id,
        'order_date': order.order_date,
        'order_number': order.order_number,
        'product_name': order.product_name,
        'buyer': order.buyer,
        'responsible': order.responsible,
        'quantity': order.quantity,
        'required_delivery': order.required_delivery,
        'terms_of_delivery': order.terms_of_delivery,
        'payment_date': order.payment_date,
        'etd': order.etd,
        'eta': order.eta,
        'ata': order.ata,
        'transit_status': order.transit_status,
        'transport': order.transport,
        'delivery_year': get_delivery_year(order)
    } for order in orders]

    return jsonify(orders_data)