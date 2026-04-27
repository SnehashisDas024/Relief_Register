from flask import Blueprint
from app.extensions import db
from app.models import User

cli_bp = Blueprint('cli', __name__)

@cli_bp.cli.command('seed-admin')
def seed_admin():
    """Seed the database with an admin user for local development."""
    email = 'admin8476#_@dumkey.com'
    password = 'Relief@Admin2024!'
    
    admin = User.query.filter_by(email=email).first()
    if admin:
        print(f"[seed-admin] Admin {email} already exists.")
        return

    new_admin = User(
        name='System Admin',
        email=email,
        role='admin'
    )
    new_admin.set_password(password)
    
    db.session.add(new_admin)
    db.session.commit()
    print(f"[seed-admin] Created admin: {email} / {password}")
    print("IMPORTANT: Remove this account before production deployment!")
