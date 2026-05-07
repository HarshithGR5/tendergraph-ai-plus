"""add_bidder_role_and_view_password

Revision ID: c0b3f1ab85f2
Revises: 001
Create Date: 2026-05-07 07:52:17.352742

"""
from alembic import op
import sqlalchemy as sa

revision = 'c0b3f1ab85f2'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Add new enum values to existing VARCHAR columns ────────────────────
    # Since the initial schema used plain VARCHAR, we just need to:
    # a) Add new columns (user_id on bidders, uploaded_by on bidder_documents,
    #    view_password_hash on tenders)
    # b) The VARCHAR columns already accept any string value including
    #    "BIDDER", "BIDDER_REGISTERED", "BIDDER_DOC_VIEWED" — no type change needed.

    # tenders: add view_password_hash column
    op.add_column('tenders', sa.Column('view_password_hash', sa.String(255), nullable=True))

    # bidders: add user_id FK column (links to BIDDER user account)
    op.add_column('bidders', sa.Column('user_id', sa.String(36), nullable=True))
    op.create_foreign_key(
        'fk_bidders_user_id', 'bidders', 'users', ['user_id'], ['user_id']
    )

    # bidder_documents: add uploaded_by FK column
    op.add_column('bidder_documents', sa.Column('uploaded_by', sa.String(36), nullable=True))
    op.create_foreign_key(
        'fk_bidder_documents_uploaded_by', 'bidder_documents', 'users', ['uploaded_by'], ['user_id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_bidder_documents_uploaded_by', 'bidder_documents', type_='foreignkey')
    op.drop_column('bidder_documents', 'uploaded_by')
    op.drop_constraint('fk_bidders_user_id', 'bidders', type_='foreignkey')
    op.drop_column('bidders', 'user_id')
    op.drop_column('tenders', 'view_password_hash')
