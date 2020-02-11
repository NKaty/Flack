from flask import render_template, request
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
    return render_template('channels.html', user=current_user)


@socketio.on('connect')
def connect():
    current_user.is_connected = True
    db.session.add(current_user._get_current_object())
    db.session.commit()
    if current_user.channel_id is not None:
        emit('set active channel', current_user.current_channel.name)
        emit('members changed', current_user.current_channel.get_all_channel_members(),
             room=current_user.current_channel.name)
    emit('load channels', Channel.get_all_channels())


@socketio.on('disconnect')
def disconnect():
    current_user.is_connected = False
    db.session.add(current_user._get_current_object())
    db.session.commit()
    emit('members changed', current_user.current_channel.get_all_channel_members(),
         room=current_user.current_channel.name)


@socketio.on('left')
def left(channel):
    leave_room(channel)


@socketio.on('joined')
def joined(channel):
    new_channel = Channel.query.filter_by(name=channel).first()
    if new_channel is None:
        return emit('flash', [{'message': 'The channel you have tried to reach does not exist.',
                               'category': 'danger'}])
    join_room(channel)
    previous_channel = current_user.channel_id and current_user.current_channel.name
    if current_user.channel_id is None or current_user.current_channel.name != channel:
        current_user.current_channel = new_channel
        db.session.add(current_user._get_current_object())
        db.session.commit()
    if previous_channel is not None and previous_channel != channel:
        emit('members changed',
             Channel.query.filter_by(name=previous_channel).first().get_all_channel_members(),
             room=previous_channel)
    emit('load messages', current_user.current_channel.get_all_channel_messages())
    emit('members changed', current_user.current_channel.get_all_channel_members(),
         room=current_user.current_channel.name)


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
        emit('load channels', Channel.get_all_channels(), broadcast=True)
        emit('flash',
             [{'message': 'Channel has been successfully created.', 'category': 'success'}])
