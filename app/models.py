from datetime import datetime
import hashlib

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from . import db, login_manager


class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(64), nullable=False, unique=True, index=True)
    username = db.Column(db.String(64), nullable=False, unique=True)
    password_hash = db.Column(db.String(128), nullable=False)
    avatar_hash = db.Column(db.String(32))
    is_connected = db.Column(db.Boolean, default=False, nullable=False)
    channel_id = db.Column(db.Integer, db.ForeignKey('channels.id'))
    messages = db.relationship('Message', backref='author', lazy='dynamic')

    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        if self.email is not None and self.avatar_hash is None:
            self.avatar_hash = self.gravatar_hash()

    @property
    def password(self):
        raise AttributeError('password is not a readable attribute')

    @password.setter
    def password(self, password):
        self.password_hash = generate_password_hash(password)

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)

    def gravatar_hash(self):
        return hashlib.md5(self.email.lower().encode('utf-8')).hexdigest()

    def gravatar(self, size=30, default='identicon', rating='g'):
        url = 'https://secure.gravatar.com/avatar'
        avatar_hash = self.avatar_hash or self.gravatar_hash()
        return f'{url}/{avatar_hash}?s={size}&d={default}&r={rating}'

    def __repr__(self):
        return f'<User {self.username}>'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class Channel(db.Model):
    __tablename__ = 'channels'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(20), nullable=False, unique=True)
    description = db.Column(db.String(255), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    users = db.relationship('User', foreign_keys=[User.channel_id], backref='current_channel',
                            lazy='dynamic')
    messages = db.relationship('Message', backref='channel', lazy='dynamic')
    creator = db.relationship('User', foreign_keys=[creator_id], backref='created_channels')

    def get_all_channel_messages(self, offset):
        messages = self.messages.order_by(Message.timestamp.desc()).offset(offset).limit(20).all()
        return [message.to_json() for message in messages[::-1]]

    def get_all_channel_members(self, offset):
        members = self.users.filter_by(is_connected=True).order_by(User.username.asc()).offset(
            offset).limit(1).all()
        return [member.username for member in members]

    @staticmethod
    def get_all_channels(offset):
        channels = Channel.query.order_by(Channel.name.asc()).offset(offset).limit(10).all()
        return [channel.name for channel in channels]

    def __repr__(self):
        return f'<Channel {self.name}>'


class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    channel_id = db.Column(db.Integer, db.ForeignKey('channels.id'), nullable=False)
    file_id = db.Column(db.Integer, db.ForeignKey('files.id'))
    file = db.relationship('File', backref=db.backref('message', uselist=False), lazy='joined')

    def to_json(self):
        return {
            'text': self.text,
            'file': {'id': self.file_id, 'name': self.file.name} if self.file_id else None,
            'author': self.author.username,
            'avatar': self.author.avatar_hash or self.author.gravatar(),
            'timestamp': self.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        }

    def __repr__(self):
        return f'<Message {self.text} channel {self.channel.name} author {self.author.username}>'


class File(db.Model):
    __tablename__ = 'files'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(300), nullable=False)
    type = db.Column(db.String(128))
    size = db.Column(db.Integer)
    content = db.Column(db.LargeBinary)

    def to_json(self):
        return {
            'name': self.name,
            'type': self.type,
            'content': self.content
        }

    def __repr__(self):
        return f'<File {self.name}>'
