"""add_role_to_user

Revision ID: 4eb5408a550e
Revises: baa7cc32c3f7
Create Date: 2026-04-29 23:28:00.933283

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4eb5408a550e'
down_revision: Union[str, Sequence[str], None] = 'baa7cc32c3f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
