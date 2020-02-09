from flask import Flask
from flask_bootstrap import Bootstrap
from flask_login import LoginManager
from flask_session import Session
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import MetaData

from config import config

bootstrap = Bootstrap()

naming_convention = {
    "ix": 'ix_%(column_0_label)s',
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s"
}

db = SQLAlchemy(metadata=MetaData(naming_convention=naming_convention))
socketio = SocketIO()
session = Session()

login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message_category = "danger"


def create_app(config_name):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    bootstrap.init_app(app)
    db.init_app(app)
    login_manager.init_app(app)
    session.init_app(app)
    socketio.init_app(app, manage_session=False)

    from .main import main as main_blueprint
    app.register_blueprint(main_blueprint)

    from .auth import auth as auth_blueprint
    app.register_blueprint(auth_blueprint, url_prefix='/auth')

    return app
