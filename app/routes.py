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
    warehouse_items = WarehouseStock.query.filter_by(user_id=current_user.id).all()
    return render_template('warehouse.html', warehouse_items=warehouse_items)

@main.route('/delivered')
@login_required
def delivered():
    delivered_items = DeliveredGoods.query.filter_by(user_id=current_user.id).all()
    return render_template('delivered.html', delivered_items=delivered_items)



@main.route('/stock_order/<int:order_id>', methods=['POST'])
@login_required
def stock_order(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id:
        flash('Unauthorized', 'danger')
        return redirect(url_for('main.dashboard'))

    # Add to WarehouseStock
    stock = WarehouseStock(
        user_id=current_user.id,
        order_number=order.order_number,
        product_name=order.product_name,
        quantity=order.quantity,
        ata=order.ata,
        transit_status='In Stock'
    )
    db.session.add(stock)
    db.session.delete(order)  # Remove from dashboard (Arrived view)
    db.session.commit()
    flash('Order moved to warehouse stock.', 'success')
    return redirect(url_for('main.warehouse'))

@main.route('/deliver_direct/<int:order_id>', methods=['POST'])
@login_required
def deliver_direct(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id:
        flash('Unauthorized', 'danger')
        return redirect(url_for('main.dashboard'))

    delivery = DeliveredGoods(
        user_id=current_user.id,
        order_number=order.order_number,
        product_name=order.product_name,
        quantity=order.quantity,
        delivery_source="Direct from Transit",
        delivery_date=datetime.now().strftime('%Y-%m-%d')
    )
    db.session.add(delivery)
    db.session.delete(order)
    db.session.commit()
    flash('Order marked as delivered to customer.', 'success')
    return redirect(url_for('main.delivered'))

@main.route('/deliver_from_warehouse/<int:item_id>', methods=['POST'])
@login_required
def mark_delivered_from_warehouse(item_id):
    stock_item = WarehouseStock.query.get_or_404(item_id)
    if stock_item.user_id != current_user.id:
        flash('Unauthorized', 'danger')
        return redirect(url_for('main.warehouse'))

    delivery = DeliveredGoods(
        user_id=current_user.id,
        order_number=stock_item.order_number,
        product_name=stock_item.product_name,
        quantity=stock_item.quantity,
        delivery_source="From Warehouse",
        delivery_date=datetime.now().strftime('%Y-%m-%d')
    )
    db.session.add(delivery)
    db.session.delete(stock_item)
    db.session.commit()
    flash('Warehouse item marked as delivered.', 'success')
    return redirect(url_for('main.delivered'))
