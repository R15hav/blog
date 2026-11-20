"""case_insensitive_email_uniqueness

Replace the case-sensitive unique index on users.email with a unique index on
lower(email), so the database allows at most one account per email address
regardless of letter case (issue #55). Registration already looks emails up
case-insensitively; this closes the gap where concurrent sign-ups with
differently cased addresses could both be inserted.

Existing accounts that differ only by case
------------------------------------------
The upgrade first checks for them. If any exist it stops with an error and
changes nothing: accounts are never deleted, merged or renamed automatically,
because only an administrator can tell which account is the real one. The error
gives the number of affected addresses (not the addresses themselves, since
deployment logs are often shared) and a query that lists the accounts. Resolve
each group by hand (for example, change the email of the unwanted account or
delete it), then run `alembic upgrade head` again.

Revision ID: e7b2c4d9a1f0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import context, op
import sqlalchemy as sa


revision: str = 'e7b2c4d9a1f0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DUPLICATES_QUERY = (
    "SELECT id, email, is_active, is_superuser FROM users "
    "WHERE lower(email) IN (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) "
    "ORDER BY lower(email), email"
)


def _refuse_if_case_duplicates() -> None:
    if context.is_offline_mode():
        # No data access when generating SQL: tell the operator to check first.
        op.execute(
            "-- Before applying: this must return no rows, or the unique index below will fail.\n"
            f"-- {DUPLICATES_QUERY};"
        )
        return
    groups = op.get_bind().execute(sa.text(
        "SELECT count(*) FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) AS d"
    )).scalar()
    if groups:
        raise RuntimeError(
            f"Cannot enforce case-insensitive email uniqueness: {groups} email address(es) are used by "
            "more than one account, differing only in letter case. No data was changed. Resolve each group "
            "manually (keep one account per address), then run `alembic upgrade head` again. "
            f"List the accounts with: {DUPLICATES_QUERY};"
        )


def upgrade() -> None:
    _refuse_if_case_duplicates()
    op.drop_index('ix_users_email', table_name='users')
    op.create_index('ix_users_email_lower', 'users', [sa.text('lower(email)')], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_email_lower', table_name='users')
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
