import os

from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

from flask_migrate import Migrate

from app import create_app, db, socketio
from app.models import User, Channel, Message, File

app = create_app(os.getenv('CONFIG') or 'default')
migrate = Migrate(app, db, render_as_batch=True)


@app.shell_context_processor
def make_shell_context():
    return dict(db=db, User=User, Channel=Channel, Message=Message, File=File)


if __name__ == '__main__':
    socketio.run(app, debug=False)
