from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_migrate import Migrate
from database import db, init_db
from models import User, Order
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'  # Replace with a secure key
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///supply_tracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
init_db(app)

# Initialize Flask-Migrate
migrate = Migrate(app, db)

# Set up Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password')
    
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
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
            return redirect(url_for('login'))
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/dashboard')
@login_required
def dashboard():
    orders = Order.query.filter_by(user_id=current_user.id).all()
    return render_template('dashboard.html', orders=orders)

@app.route('/add_order', methods=['POST'])
@login_required
def add_order():
    try:
        data = request.form
        quantity = float(data['quantity'])  # Already supports decimals
        order_date = data['order_date']
        etd = data['etd']
        eta = data['eta']

        # Validate inputs
        if quantity <= 0:
            return jsonify({'success': False, 'message': 'Quantity must be a positive number (decimals allowed).'}), 400

        # Parse dates for comparison
        from datetime import datetime
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
    except ValueError as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Invalid quantity format. Please enter a valid number (decimals allowed).'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/edit_order/<int:order_id>', methods=['GET', 'POST'])
@login_required
def edit_order(order_id):
    order = Order.query.get_or_404(order_id)
    if order.user_id != current_user.id:
        return jsonify({'success': False, 'message': 'You do not have permission to edit this order.'}), 403

    if request.method == 'POST':
        try:
            data = request.form
            quantity = float(data['quantity'])  # Already supports decimals
            order_date = data['order_date']
            etd = data['etd']
            eta = data['eta']

            # Validate inputs
            if quantity <= 0:
                return jsonify({'success': False, 'message': 'Quantity must be a positive number (decimals allowed).'}), 400

            # Parse dates for comparison
            from datetime import datetime
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
        except ValueError as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': 'Invalid quantity format. Please enter a valid number (decimals allowed).'}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({'success': False, 'message': str(e)}), 400

    return render_template('edit_order.html', order=order)

@app.route('/delete_order/<int:order_id>')
@login_required
def delete_order(order_id):
    try:
        order = Order.query.get_or_404(order_id)
        if order.user_id != current_user.id:
            return jsonify({'success': False, 'message': 'You do not have permission to delete this order.'}), 403
        
        db.session.delete(order)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Order deleted successfully!'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 400

@app.route('/api/orders')
@login_required
def get_orders():
    orders = Order.query.filter_by(user_id=current_user.id).all()
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
        'transport': order.transport  # Add transport field
    } for order in orders]
    return jsonify(orders_data)

if __name__ == '__main__':
    app.run(debug=True)