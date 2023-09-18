from flask import render_template, redirect, url_for
from flask_login import login_required, current_user
from flask_socketio import emit, join_room, leave_room

from . import main
from .socket_decorator import authenticated_only
from .. import db
from ..models import Channel, Message, File
from .forms import MessageForm, CreateChannelForm
from app import socketio


@main.route('/', methods=['GET'])
def index():
    if not current_user.is_authenticated:
        return redirect(url_for('auth.login'))
    return redirect(url_for('main.channels'))


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
    channel_name = None
    if current_user.channel_id is not None:
        channel_name = current_user.current_channel.name
    emit('set initial information', {'channel': channel_name, 'username': current_user.username})


@socketio.on('disconnect')
@authenticated_only
def disconnect():
    current_user.is_connected = False
    db.session.add(current_user._get_current_object())
    db.session.commit()
    if current_user.current_channel is not None:
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
    emit('load channel information', current_user.current_channel.to_json())
    emit('load members',
         {'members': current_user.current_channel.get_all_channel_members(offset=0),
          'isReload': True}, room=current_user.current_channel.name)
    emit('load messages',
         {'messages': current_user.current_channel.get_all_channel_messages(offset=0),
          'fromSendMessage': False, 'fromScrollEvent': False})


@socketio.on('send message')
@authenticated_only
def send_message(data):
    if current_user.channel_id is not None:
        form = MessageForm(text=data['message'], file=bool(data['file']), **data['file'])
        if form.validate():
            message_dict = {
                'text': data['message'] if len(data['message']) else None,
                'author': current_user._get_current_object(),
                'channel': current_user.current_channel,
            }
            if bool(data['file']):
                file = data['file']
                message_dict['file'] = File(name=file['name'],
                                            content=file['content'],
                                            size=file['size'],
                                            type=file['type'] if len(file['type']) else None)
            message = Message(**message_dict)
            db.session.add(message)
            db.session.commit()
            emit('load messages',
                 {'messages': [message.to_json()], 'fromSendMessage': True,
                  'fromScrollEvent': False}, room=message.channel.name)
        else:
            emit('flash', form.get_form_error_messages())


@socketio.on('download file')
def download_file(file_id):
    file = File.query.get(file_id)
    if file:
        return file.to_json()
    emit('flash', [{'message': 'File does not exist.', 'category': 'danger'}])
    return None


@socketio.on('create channel')
def create_channel(data):
    form = CreateChannelForm(name=data['name'], description=data['description'])
    if not form.validate():
        emit('flash', form.get_form_error_messages())
        return False
    elif Channel.query.filter_by(name=data['name']).first():
        emit('flash', [{'message': 'Channel with this name already exists.', 'category': 'danger'}])
        return False
    else:
        new_channel = Channel(name=data['name'], description=data['description'],
                              creator_id=current_user.id)
        db.session.add(new_channel)
        db.session.commit()
        emit('load channels',
             {'channels': current_user.get_all_channels(offset=0), 'isReload': True},
             broadcast=True)
        return True


@socketio.on('toggle channel pin')
@authenticated_only
def toggle_channel_pin(channel_name, action_to_pin):
    channel = Channel.query.filter_by(name=channel_name).first()
    if channel:
        if action_to_pin:
            current_user.pinned_channels.append(channel)
        else:
            current_user.pinned_channels.remove(channel)
        db.session.add(current_user._get_current_object())
        db.session.commit()
        emit('load channels',
             {'channels': current_user.get_all_channels(offset=0), 'isReload': True})
    else:
        emit('flash', [{'message': "Channel with this name doesn't exist.", 'category': 'danger'}])


@socketio.on('get messages')
@authenticated_only
def get_messages(offset, from_scroll_event):
    messages = list()
    if current_user.current_channel:
        messages = current_user.current_channel.get_all_channel_messages(offset=offset)
    emit('load messages',
         {'messages': messages,
          'fromSendMessage': False, 'fromScrollEvent': from_scroll_event})


@socketio.on('get channels')
@authenticated_only
def get_channels(offset):
    emit('load channels',
         {'channels': current_user.get_all_channels(offset=offset), 'isReload': False})


@socketio.on('get members')
@authenticated_only
def get_members(offset):
    if current_user.channel_id is not None:
        emit('load members',
             {'members': current_user.current_channel.get_all_channel_members(offset=offset),
              'isReload': False})
