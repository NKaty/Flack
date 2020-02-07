from flask import render_template
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
    chats = {
        'channels': Channel.query.order_by(Channel.name.asc()).all(),
        'messages': None,
        'members': None,
        'user': current_user
    }
    if current_user.channel_id is not None:
        chats['messages'] = Channel.query.get(current_user.channel_id).messages.order_by(
            Message.timestamp.asc()).all()
        chats['members'] = Channel.query.get(current_user.channel_id).users.order_by(
            User.username.asc()).all()
    return render_template('channels.html', chats=chats)


@socketio.on('connect')
def connect():
    # maybe load channels, members and messages instead of channels route
    if current_user.channel_id is not None:
        join_room(current_user.current_channel.name)
        emit('set active channel', current_user.current_channel.name)


@socketio.on('left')
def left(channel):
    leave_room(channel)
    current_user.channel_id = None
    db.session.add(current_user._get_current_object())
    db.session.commit()


@socketio.on('joined')
def joined(channel):
    join_room(channel)
    new_channel = Channel.query.filter_by(name=channel).first()
    # may be error
    current_user.current_channel = new_channel
    db.session.add(current_user._get_current_object())
    db.session.commit()


@socketio.on('send message')
def send_message(msg):
    message = Message(text=msg,
                      author=current_user._get_current_object(),
                      channel=current_user.current_channel)
    db.session.add(message)
    db.session.commit()
    emit('update message',
         {'msg': message.text,
          'author': message.author.username,
          'timestamp': message.timestamp.strftime('%Y-%m-%d %H:%M:%S')},
         room=message.channel.name)
