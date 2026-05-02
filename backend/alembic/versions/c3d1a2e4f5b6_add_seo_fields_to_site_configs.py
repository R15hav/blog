"""add_seo_fields_to_site_configs

Revision ID: c3d1a2e4f5b6
Revises: 4eb5408a550e
Create Date: 2026-05-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d1a2e4f5b6'
down_revision: Union[str, Sequence[str], None] = '4eb5408a550e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('site_configs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('site_description', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('site_url', sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('site_configs', schema=None) as batch_op:
        batch_op.drop_column('site_url')
        batch_op.drop_column('site_description')
