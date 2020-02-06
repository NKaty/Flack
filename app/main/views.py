from flask import render_template
from flask_login import login_required, current_user

from . import main
from ..models import User, Channel, Message


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
