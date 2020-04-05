import os

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SESSION_PERMANENT = False
    SESSION_TYPE = 'filesystem'
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
    DEFAULT_CHANNEL = 'general'
    CHANNELS_LIMIT = 30
    MESSAGES_LIMIT = 50
    MEMBERS_LIMIT = 30
    ASSETS_DEBUG = False
    ASSETS_AUTO_BUILD = True


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or 'sqlite:///' + os.path.join(
        basedir, 'chat-dev.sqlite')


class ProductionConfig(Config):
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
