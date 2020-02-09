from flask import render_template, flash
from flask_login import login_required, current_user
from flask_socketio import emit, join_room, leave_room

from . import main
from .. import db
from ..models import User, Channel, Message
from app import socketio


@main.route('/', methods=['GET'])
def index():
    return render_template('index.html')


@main.route('/channels', methods=['GET'])
@login_required
def channels():
    return render_template('channels.html', user=current_user.username)


@socketio.on('connect')
def connect():
    if current_user.channel_id is not None:
        emit('set active channel', current_user.current_channel.name)
    emit('load channels', Channel.get_all_channels())


@socketio.on('left')
def left(channel):
    # check
    leave_room(channel)


@socketio.on('joined')
def joined(channel):
    join_room(channel)
    if current_user.channel_id is None or current_user.current_channel.name != channel:
        # check
        current_user.current_channel = Channel.query.filter_by(name=channel).first()
        db.session.add(current_user._get_current_object())
        db.session.commit()
    emit('load channel', {'messages': current_user.current_channel.get_all_channel_messages(),
                          'members': current_user.current_channel.get_all_channel_members()})


@socketio.on('send message')
def send_message(text):
    if current_user.channel_id is not None:
        message = Message(text=text,
                          author=current_user._get_current_object(),
                          channel=current_user.current_channel)
        db.session.add(message)
        db.session.commit()
        emit('update message', message.to_json(), room=message.channel.name)


@socketio.on('create channel')
def create_channel(channel):
    if Channel.query.filter_by(name=channel).first():
        emit('flash', [{'message': 'Channel with this name already exists.', 'category': 'danger'}])
    else:
        new_channel = Channel(name=channel)
        db.session.add(new_channel)
        db.session.commit()
        emit('load channels', Channel.get_all_channels())
        emit('flash',
             [{'message': 'Channel has been successfully created.', 'category': 'success'}])
