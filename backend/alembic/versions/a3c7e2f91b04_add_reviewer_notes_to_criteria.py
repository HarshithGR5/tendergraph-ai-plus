"""add_reviewer_notes_to_criteria

Revision ID: a3c7e2f91b04
Revises: f18ed3fac32f
Create Date: 2026-05-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a3c7e2f91b04'
down_revision = 'f18ed3fac32f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tender_criteria', sa.Column('reviewer_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('tender_criteria', 'reviewer_notes')
