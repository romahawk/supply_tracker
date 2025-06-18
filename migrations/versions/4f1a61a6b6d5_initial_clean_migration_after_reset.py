"""Initial clean migration after reset

Revision ID: 4f1a61a6b6d5
Revises: 
Create Date: 2025-06-18 16:10:09.368551

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4f1a61a6b6d5'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('stock_report_entry', schema=None) as batch_op:
        # 🚫 Cannot drop unnamed constraint in SQLite — skip it
        # batch_op.drop_constraint(None, type_='foreignkey')

        # ✅ Create correct FK
        batch_op.create_foreign_key(
            'fk_stockreport_warehouse',
            'warehouse_stock',
            ['related_order_id'],
            ['id']
        )


def downgrade():
    with op.batch_alter_table('stock_report_entry', schema=None) as batch_op:
        # ✅ Drop the named FK constraint (only if we created it)
        batch_op.drop_constraint('fk_stockreport_warehouse', type_='foreignkey')

        # 🛑 DO NOT re-add a None-named constraint
        # batch_op.create_foreign_key(None, 'order', ['related_order_id'], ['id'])

    # ### end Alembic commands ###
