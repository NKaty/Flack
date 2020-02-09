from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from . import db, login_manager


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(64), nullable=False, unique=True, index=True)
    username = db.Column(db.String(64), nullable=False, unique=True)
    password_hash = db.Column(db.String(128), nullable=False)
    last_seen = db.Column(db.DateTime(), nullable=False, default=datetime.utcnow)
    channel_id = db.Column(db.Integer, db.ForeignKey('channels.id'))
    is_connected = db.Column(db.Boolean, default=False, nullable=False)
    messages = db.relationship('Message', backref='author', lazy='dynamic')

    @property
    def password(self):
        raise AttributeError('password is not a readable attribute')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class Channel(db.Model):
    __tablename__ = 'channels'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False, unique=True)
    users = db.relationship('User', backref='current_channel', lazy='dynamic')
    messages = db.relationship('Message', backref='channel', lazy='dynamic')

    def get_all_channel_messages(self):
        messages = self.messages.order_by(Message.timestamp.asc()).all()
        return [message.to_json() for message in messages]

    def get_all_channel_members(self):
        members = self.users.filter_by(is_connected=True).order_by(User.username.asc()).all()
        return [member.username for member in members]

    @staticmethod
    def get_all_channels():
        channels = Channel.query.order_by(Channel.name.asc()).all()
        return [channel.name for channel in channels]

    def __repr__(self):
        return f'<Channel {self.name}>'


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, index=True, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    channel_id = db.Column(db.Integer, db.ForeignKey('channels.id'), nullable=False)

    def to_json(self):
        return {
            'text': self.text,
            'author': self.author.username,
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }

    def __repr__(self):
        return f'<Message {self.text} channel {self.channel.name} author {self.author.username}>'
