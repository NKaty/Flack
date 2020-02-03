from flask import Flask
from flask_session import Session
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

from config import config

db = SQLAlchemy()
socketio = SocketIO()
session = Session()


def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    session.init_app(app)
    socketio.init_app(app, manage_session=False)

    return app
