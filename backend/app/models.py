from datetime import datetime, timezone
from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user') # admin, volunteer, user
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Volunteer specific fields
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    zone = db.Column(db.String(100))
    skills = db.Column(db.JSON)
    is_available = db.Column(db.Boolean, default=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'phone': self.phone,
            'lat': self.lat,
            'lng': self.lng,
            'zone': self.zone,
            'skills': self.skills,
            'is_available': self.is_available
        }

class Need(db.Model):
    __tablename__ = 'needs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    category = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(200))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    severity = db.Column(db.Integer, default=5)
    status = db.Column(db.String(20), default='open') # open, assigned, completed
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    author = db.relationship('User', foreign_keys=[author_id], backref='reported_needs')
    
    assigned_volunteer_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    assigned_volunteer = db.relationship('User', foreign_keys=[assigned_volunteer_id], backref='assigned_tasks')

    source_id = db.Column(db.String(100), index=True) # Used for tracking batch uploads

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'category': self.category,
            'description': self.description,
            'location': self.location,
            'lat': self.lat,
            'lng': self.lng,
            'severity': self.severity,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'author_id': self.author_id,
            'assigned_volunteer_id': self.assigned_volunteer_id,
            'source_id': self.source_id
        }

class FailedIngestion(db.Model):
    __tablename__ = 'failed_ingestions'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200), nullable=False)
    error_message = db.Column(db.Text, nullable=False)
    raw_data = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'error_message': self.error_message,
            'raw_data': self.raw_data,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
