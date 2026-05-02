"""add_og_fields_to_site_configs

Revision ID: d4e5f6a7b8c9
Revises: c3d1a2e4f5b6
Create Date: 2026-05-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d1a2e4f5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('site_configs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('og_title', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('og_description', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('og_image_url', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('site_configs', schema=None) as batch_op:
        batch_op.drop_column('og_image_url')
        batch_op.drop_column('og_description')
        batch_op.drop_column('og_title')
