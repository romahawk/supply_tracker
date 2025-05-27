from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, send_from_directory, current_app
from flask_login import login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from app.models import db, User, Order, WarehouseStock, DeliveredGoods
from datetime import datetime
import os

restore_bp = Blueprint('restore', __name__)

@restore_bp.route('/restore_to_dashboard')
def restore_to_dashboard():
    pass

@restore_bp.route('/restore_from_delivered')
def restore_from_delivered():
    pass

