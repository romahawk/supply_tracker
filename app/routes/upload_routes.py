from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, send_from_directory, current_app
from flask_login import login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from app.models import db, User, Order, WarehouseStock, DeliveredGoods
from datetime import datetime
import os

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/upload_pod')
def upload_pod():
    pass

@upload_bp.route('/view_pod')
def view_pod():
    pass

@upload_bp.route('/delete_pod')
def delete_pod():
    pass

