# models.py
from database import db
from flask_login import UserMixin

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    order_date = db.Column(db.String(10))
    order_number = db.Column(db.String(50))
    product_name = db.Column(db.String(100))
    buyer = db.Column(db.String(50))
    responsible = db.Column(db.String(50))
    quantity = db.Column(db.Float)
    required_delivery = db.Column(db.String(10))
    terms_of_delivery = db.Column(db.String(100))
    payment_date = db.Column(db.String(10))
    etd = db.Column(db.String(10))
    eta = db.Column(db.String(10))
    ata = db.Column(db.String(10))
    transit_status = db.Column(db.String(20))