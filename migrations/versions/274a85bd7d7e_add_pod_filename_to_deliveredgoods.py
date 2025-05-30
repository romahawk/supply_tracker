"""Add pod_filename to DeliveredGoods

Revision ID: 274a85bd7d7e
Revises: 9e58ff99b494
Create Date: 2025-05-14 16:29:16.089837

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '274a85bd7d7e'
down_revision = '9e58ff99b494'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('delivered_goods', schema=None) as batch_op:
        batch_op.add_column(sa.Column('pod_filename', sa.String(length=120), nullable=True))

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    with op.batch_alter_table('delivered_goods', schema=None) as batch_op:
        batch_op.drop_column('pod_filename')

    # ### end Alembic commands ###
