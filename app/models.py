from .database import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

    def is_active(self):
        return True

    def get_id(self):
        return str(self.id)

    def is_authenticated(self):
        return True

    def is_anonymous(self):
        return False

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    order_date = db.Column(db.String(10), nullable=False)
    order_number = db.Column(db.String(50), nullable=False)
    product_name = db.Column(db.String(100), nullable=False)
    buyer = db.Column(db.String(100), nullable=False)
    responsible = db.Column(db.String(100), nullable=False)
    quantity = db.Column(db.Float, nullable=False)  # Already supports decimals
    required_delivery = db.Column(db.String(10), nullable=False)
    terms_of_delivery = db.Column(db.String(100), nullable=False)
    payment_date = db.Column(db.String(10))
    etd = db.Column(db.String(10), nullable=False)
    eta = db.Column(db.String(10), nullable=False)
    ata = db.Column(db.String(10))
    transit_status = db.Column(db.String(20), nullable=False)
    transport = db.Column(db.String(20), nullable=False)