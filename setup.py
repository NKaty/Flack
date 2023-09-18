import os

from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

from flask_migrate import Migrate, upgrade

from app import create_app, db
from app.fake import fake_data

app = create_app(os.getenv('CONFIG') or 'default')
migrate = Migrate(app, db, render_as_batch=True)

if __name__ == '__main__':
    with app.app_context():
        upgrade(directory='migrations')
        fake_data('65432123456')
