import os

PRODUCTS_FILE = os.path.join(os.path.dirname(__file__), '../../data/products.txt')

def load_products():
    if not os.path.exists(PRODUCTS_FILE):
        return []
    with open(PRODUCTS_FILE, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]

def add_product_if_new(product_name):
    name = product_name.strip()
    if not name:
        return
    products = load_products()
    if name not in products:
        with open(PRODUCTS_FILE, "a", encoding="utf-8") as f:
            f.write(name + "\n")
