import re

from flask import render_template, request
from flask_login import login_required, current_user
from flask_socketio import emit, join_room, leave_room

from . import main
from .socket_auth_helper import authenticated_only
from .. import db
from ..models import User, Channel, Message, File
from app import socketio


@main.route('/', methods=['GET'])
def index():
    return render_template('index.html')


@main.route('/channels', methods=['GET'])
@login_required
def channels():
    return render_template('channels.html', user=current_user)


@socketio.on('connect')
@authenticated_only
def connect():
    current_user.is_connected = True
    db.session.add(current_user._get_current_object())
    db.session.commit()
    if current_user.channel_id is not None:
        emit('set active channel', current_user.current_channel.name)


@socketio.on('disconnect')
@authenticated_only
def disconnect():
    # doesn't occur if user close the tab
    current_user.is_connected = False
    db.session.add(current_user._get_current_object())
    db.session.commit()
    emit('load members', {'members': current_user.current_channel.get_all_channel_members(offset=0),
                          'isReload': True}, room=current_user.current_channel.name)


@socketio.on('left')
@authenticated_only
def left(channel):
    leave_room(channel)


@socketio.on('joined')
@authenticated_only
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
        emit('load members', {'members': Channel.query.filter_by(
            name=previous_channel).first().get_all_channel_members(offset=0), 'isReload': True},
             room=previous_channel)
    emit('load members',
         {'members': current_user.current_channel.get_all_channel_members(offset=0),
          'isReload': True}, room=current_user.current_channel.name)


@socketio.on('send message')
@authenticated_only
def send_message(data):
    if current_user.channel_id is not None:
        message_dict = {
            'text': data['message'],
            'author': current_user._get_current_object(),
            'channel': current_user.current_channel,
        }
        if data['file'] is not None:
            file = data['file']
            message_dict['file'] = File(name=file['name'], content=file['content'],
                                        type=file['type'] if len(file['type']) else None)
            db.session.add(message_dict['file'])
        message = Message(**message_dict)
        db.session.add(message)
        db.session.commit()
        emit('load messages',
             {'messages': [message.to_json()], 'fromSendMessage': True, 'fromScrollEvent': False},
             room=message.channel.name)


@socketio.on('download file')
@authenticated_only
def download_file(file_id):
    file = File.query.get(file_id)
    if file:
        return file.to_json()
    emit('flash', [{'message': 'File does not exists.', 'category': 'danger'}])
    return None


@socketio.on('create channel')
@authenticated_only
def create_channel(channel):
    if len(channel) < 1 or len(channel) > 64 or not re.fullmatch('^[A-Za-z][A-Za-z0-9_.]*$',
                                                                 channel):
        emit('flash', [{'message': 'Channel name must be between 1 and 64 characters long and '
                                   'have only letters, numbers, dots or underscores.',
                        'category': 'danger'}])
    elif Channel.query.filter_by(name=channel).first():
        emit('flash', [{'message': 'Channel with this name already exists.', 'category': 'danger'}])
    else:
        new_channel = Channel(name=channel)
        db.session.add(new_channel)
        db.session.commit()
        # print('create channel emit')
        emit('load channels', {'channels': Channel.get_all_channels(offset=0), 'isReload': True},
             broadcast=True)
        emit('flash',
             [{'message': 'Channel has been successfully created.', 'category': 'success'}])


@socketio.on('get messages')
@authenticated_only
def get_messages(offset, from_scroll_event):
    messages = current_user.current_channel.get_all_channel_messages(offset=offset)
    # print('get messages', len(messages))
    # print('view offset', offset)
    emit('load messages',
         {'messages': messages, 'fromSendMessage': False, 'fromScrollEvent': from_scroll_event})


@socketio.on('get channels')
@authenticated_only
def get_channels(offset):
    emit('load channels', {'channels': Channel.get_all_channels(offset=offset), 'isReload': False})
    # print('get channels emit', current_user.username, offset)


@socketio.on('get members')
@authenticated_only
def get_members(offset):
    if current_user.channel_id is not None:
        emit('load members',
             {'members': current_user.current_channel.get_all_channel_members(offset=offset),
              'isReload': False})
