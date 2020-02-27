from flask import current_app
from flask_wtf import FlaskForm
from wtforms import StringField, IntegerField, BooleanField
from wtforms import ValidationError


class MessageForm(FlaskForm):
    class Meta:
        csrf = False

    text = StringField('Text')
    file = BooleanField('File')
    name = StringField('File name')
    size = IntegerField('File size')

    def validate_text(self, field):
        if not field.data and not self.file.data:
            raise ValidationError('You must provide a message or file.')

    def validate_name(self, field):
        if self.file.data:
            if len(field.data) < 1:
                raise ValidationError('File must have a name. Upload rejected by server.')
            if len(field.data) > 300:
                raise ValidationError(
                    'File name must be less than 300 characters. Upload rejected by server.')

    def validate_size(self, field):
        if self.file.data:
            if not field.data:
                raise ValidationError('File size is unknown. Upload rejected by server.')
            if field.data > current_app.config['MAX_CONTENT_LENGTH']:
                size = round(current_app.config["MAX_CONTENT_LENGTH"] / pow(1024, 2), 1)
                raise ValidationError(
                    f'File exceeded maximum size {size}MB. Upload rejected by server.')
