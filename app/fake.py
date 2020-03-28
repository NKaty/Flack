from random import choice, randint, sample

from flask import current_app
from faker import Faker
from sqlalchemy.exc import IntegrityError, DataError

from . import db
from .models import User, Channel, Message


def create_default_channel():
    fake = Faker()
    admin = User(email='admin@test.com',
                 username='admin',
                 password='65432123456',
                 is_connected=False)
    db.session.add(admin)
    channel = Channel(name=current_app.config['DEFAULT_CHANNEL'],
                      description='Default channel',
                      timestamp=fake.date_time_between(start_date='-80d', end_date='-70d'),
                      creator=admin)
    db.session.add(channel)
    db.session.commit()
    admin.current_channel = channel
    db.session.add(admin)
    db.session.commit()


def create_users(count=10):
    fake = Faker()
    i = 0
    current_channel = Channel.query.filter_by(
        name=current_app.config['DEFAULT_CHANNEL']).first()
    while i < count:
        user = User(email=fake.email(),
                    username=fake.user_name(),
                    password='65432123456',
                    is_connected=False,
                    current_channel=current_channel)
        db.session.add(user)
        try:
            db.session.commit()
            i += 1
        except IntegrityError:
            db.session.rollback()


def create_channels(count=10):
    fake = Faker()
    i = 0
    users_count = User.query.count()
    while i < count:
        user = User.query.offset(randint(0, users_count - 1)).first()
        channel = Channel(name='_'.join(fake.words(2)),
                          description=fake.sentence(nb_words=12),
                          timestamp=fake.date_time_between(start_date='-70d', end_date='-60d'),
                          creator=user)
        db.session.add(channel)
        try:
            db.session.commit()
            i += 1
        except (IntegrityError, DataError):
            db.session.rollback()


def create_messages(messages_per_channel_max_count=10, users_per_channel_max_count=10):
    fake = Faker()
    channels = Channel.query.all()
    users_len = User.query.count()
    for channel in channels:
        count_messages = randint(0, messages_per_channel_max_count)
        if count_messages > 0:
            users_count = randint(2, users_per_channel_max_count)
            user_offsets = sample(list(range(0, users_len - 1)), users_count)
            users = [User.query.offset(offset).first() for offset in user_offsets]
            for i in range(count_messages):
                message = Message(text=fake.text(),
                                  timestamp=fake.date_time_between(start_date='-60d',
                                                                   end_date='now'),
                                  author=choice(users),
                                  channel=channel)
                db.session.add(message)
    db.session.commit()


def pin_channels(max_count=10):
    users = User.query.all()
    channels_len = Channel.query.count()
    for user in users:
        count = randint(0, max_count)
        if count > 0:
            channel_offsets = sample(list(range(0, channels_len - 1)), count)
            channels = [Channel.query.offset(offset).first() for offset in channel_offsets]
            user.pinned_channels.extend(channels)
            db.session.add(user)
    db.session.commit()
