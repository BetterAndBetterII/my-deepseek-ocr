"""init tables users and usage_events

Revision ID: 20241030_0001
Revises: 
Create Date: 2025-10-30 14:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20241030_0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column('password_hash', sa.String(length=256), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    op.create_table(
        'usage_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('kind', sa.String(length=16), nullable=False),
        sa.Column('prompt_chars', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completion_chars', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('prompt_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completion_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('input_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('meta', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_usage_events_user_id', 'usage_events', ['user_id'])
    op.create_index('ix_usage_events_id', 'usage_events', ['id'])


def downgrade() -> None:
    op.drop_index('ix_usage_events_id', table_name='usage_events')
    op.drop_index('ix_usage_events_user_id', table_name='usage_events')
    op.drop_table('usage_events')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')

