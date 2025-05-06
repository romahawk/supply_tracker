from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from .models import db, User, Order, WarehouseStock, DeliveredGoods
from datetime import datetime

main = Blueprint('main', __name__)

@main.app_context_processor
def inject_user():
    return dict(current_user=current_user)

@main.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return redirect(url_for('main.login'))

@main.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('main.dashboard'))
        else:
            flash('Invalid username or password')

    return render_template('login.html')

@main.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if User.query.filter_by(username=username).first():
            flash('Username already exists')
        else:
            hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
            new_user = User(username=username, password=hashed_password)
            db.session.add(new_user)
            db.session.commit()
            flash('Registration successful! Please log in.')
            return redirect(url_for('main.login'))

    return render_template('login.html')

@main.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.login'))

@main.route('/dashboard')
@login_required
def dashboard():
    orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.order_date.asc()).all()
    return render_template('dashboard.html', orders=orders)

@main.route('/add_order', methods=['POST'])
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
        return jsonify({'success': True, 'message': 'Order added successfully!'})
    except ValueError:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Invalid quantity format. Use a valid number.'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400

@main.route('/edit_order/<int:order_id>', methods=['GET', 'POST'])
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

@main.route('/delete_order/<int:order_id>')
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

@main.route('/api/orders')
@login_required
def get_orders():
    orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.order_date.asc()).all()
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
        'transport': order.transport
    } for order in orders]
    return jsonify(orders_data)


@main.route('/warehouse')
@login_required
def warehouse():
    from .models import WarehouseStock
    warehouse_items = WarehouseStock.query.filter_by(user_id=current_user.id).all()
    return render_template('warehouse.html', warehouse_items=warehouse_items)

@main.route('/delivered')
@login_required
def delivered():
    from .models import DeliveredGoods
    delivered_items = DeliveredGoods.query.filter_by(user_id=current_user.id).all()
    return render_template('delivered.html', delivered_items=delivered_items)


@main.route('/deliver_partial/<int:item_id>', methods=['POST'])
@login_required
def deliver_partial(item_id):
    item = WarehouseStock.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        flash('Unauthorized access.', 'danger')
        return redirect(url_for('main.warehouse'))

    try:
        qty_to_deliver = float(request.form['quantity'])
    except ValueError:
        flash('Invalid quantity entered.', 'danger')
        return redirect(url_for('main.warehouse'))

    if qty_to_deliver <= 0 or qty_to_deliver > item.quantity:
        flash(f"Invalid quantity. Must be between 1 and {item.quantity}.", 'danger')
        return redirect(url_for('main.warehouse'))

    # Create a DeliveredGoods entry
    delivery = DeliveredGoods(
        user_id=current_user.id,
        order_number=item.order_number,
        product_name=item.product_name,
        quantity=qty_to_deliver,
        delivery_source="From Warehouse",
        delivery_date=datetime.now().strftime('%Y-%m-%d')
    )
    db.session.add(delivery)

    # Adjust warehouse quantity or delete if zero
    item.quantity -= qty_to_deliver
    if item.quantity <= 0:
        db.session.delete(item)

    db.session.commit()
    flash(f'Delivered {qty_to_deliver} from warehouse.', 'success')
    return redirect(url_for('main.warehouse'))


@main.route('/edit_warehouse/<int:item_id>', methods=['GET', 'POST'])
@login_required
def edit_warehouse(item_id):
    item = WarehouseStock.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        flash('Unauthorized access.', 'danger')
        return redirect(url_for('main.warehouse'))

    if request.method == 'POST':
        item.quantity = float(request.form['quantity'])
        item.ata = request.form['ata']
        db.session.commit()
        flash('Warehouse item updated successfully!', 'success')
        return redirect(url_for('main.warehouse'))

    return render_template('edit_warehouse.html', item=item)


@main.route('/edit_delivered/<int:item_id>', methods=['GET', 'POST'])
@login_required
def edit_delivered(item_id):
    item = DeliveredGoods.query.get_or_404(item_id)
    if item.user_id != current_user.id:
        flash('Unauthorized access', 'danger')
        return redirect(url_for('main.delivered'))

    if request.method == 'POST':
        item.quantity = float(request.form['quantity'])
        item.delivery_source = request.form['delivery_source']
        item.delivery_date = request.form['delivery_date']
        db.session.commit()
        flash('Delivered item updated successfully!', 'success')
        return redirect(url_for('main.delivered'))

    return render_template('edit_delivered.html', item=item)
