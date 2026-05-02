"""initial schema

Revision ID: baa7cc32c3f7
Revises:
Create Date: 2026-04-29 22:38:31.641414

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'baa7cc32c3f7'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('theme_configs',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('url', sa.String(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('site_configs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('site_name', sa.String(), nullable=False, server_default='My Blog'),
    sa.Column('logo_url', sa.String(), nullable=True),
    sa.Column('allow_registration', sa.Boolean(), nullable=False, server_default='1'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('hashed_password', sa.String(length=1024), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('is_superuser', sa.Boolean(), nullable=False),
    sa.Column('is_verified', sa.Boolean(), nullable=False),
    sa.Column('role', sa.String(), server_default='guest', nullable=False),
    sa.Column('first_name', sa.String(), nullable=True),
    sa.Column('last_name', sa.String(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)

    op.create_table('posts',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('owner_id', sa.Uuid(), nullable=True),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('content', sa.String(), nullable=False),
    sa.Column('published', sa.String(), nullable=True),
    sa.Column('created_date', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('likes',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('post_id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('post_id', 'user_id', name='uq_like_post_user')
    )
    op.create_table('comments',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('post_id', sa.Uuid(), nullable=False),
    sa.Column('author_id', sa.Uuid(), nullable=False),
    sa.Column('body', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('user_profiles',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('bio', sa.String(), nullable=True),
    sa.Column('contact', sa.String(), nullable=True),
    sa.Column('location', sa.String(), nullable=True),
    sa.Column('gender', sa.String(), nullable=True),
    sa.Column('headline', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_table('experiences',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('company_name', sa.String(), nullable=False, server_default=''),
    sa.Column('designation', sa.String(), nullable=False, server_default=''),
    sa.Column('years', sa.Integer(), nullable=False, server_default='0'),
    sa.Column('months', sa.Integer(), nullable=False, server_default='0'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('qualifications',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('institution', sa.String(), nullable=False, server_default=''),
    sa.Column('degree', sa.String(), nullable=False, server_default=''),
    sa.Column('field_of_study', sa.String(), nullable=True),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('school_education',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('grade', sa.String(), nullable=False),
    sa.Column('school_name', sa.String(), nullable=True),
    sa.Column('board', sa.String(), nullable=True),
    sa.Column('percentage', sa.String(), nullable=True),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('school_education')
    op.drop_table('qualifications')
    op.drop_table('experiences')
    op.drop_table('user_profiles')
    op.drop_table('comments')
    op.drop_table('likes')
    op.drop_table('posts')
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_email'))
    op.drop_table('users')
    op.drop_table('site_configs')
    op.drop_table('theme_configs')
