$(function () {
  class Socket {
    constructor (view) {
      this.socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
      this.view = view;
      this.activeChannel = null;
      this.initialize();
    }

    initialize () {
      this.socket.on('connect', () => this.onConnect());
      this.socket.on('set active channel', channel => this.setActiveChanel(channel));
      this.socket.on('update message', message => this.view.updateMessage(message));
      this.socket.on('load messages', messages => this.view.loadMessages(messages));
      this.socket.on('load channels', channels => this.view.loadChannels(channels, this.activeChannel));
      this.socket.on('members changed', members => this.view.loadMembers(members));
      this.socket.on('flash', messages => this.view.showFlashMessages(messages));
    }

    onConnect () {
      this.initializeChannelChangeEvent();
      this.initializeMessageSendEvent();
      this.initializeChannelCreateEvent();
      this.initializeChannelCreateValidationEvent();
      this.initializeChannelCreateFormCloseEvent();
    }

    setActiveChanel (channel) {
      this.activeChannel = channel;
      this.socket.emit('joined', this.activeChannel);
    }

    initializeChannelChangeEvent () {
      const self = this;
      this.view.channels.on('click', 'li', function () {
        if (self.view.isChannelActive(this)) return;
        self.socket.emit('left', self.activeChannel);
        self.activeChannel = self.view.getDataAttribute(this, 'channel');
        self.socket.emit('joined', self.activeChannel);
        self.view.setChannelActive(this);
      });
    }

    initializeMessageSendEvent () {
      this.view.messages.on('click', this.view.send, () => {
        const message = $(this.view.messageInput).val();
        if (message.length > 0) {
          this.socket.emit('send message', message);
          $(this.view.messageInput).val('');
        }
      });
    }

    initializeChannelCreateEvent () {
      this.view.createChannel.on('click', this.view.submit, () => {
        const channel = this.view.channelInput.val();
        if (channel.length > 0) {
          this.socket.emit('create channel', channel);
        }
      });
    }

    initializeChannelCreateValidationEvent () {
      this.view.channelCreateValidation();
    }

    initializeChannelCreateFormCloseEvent () {
      this.view.channelCreateFormClose();
    }
  }

  class View {
    constructor () {
      this.channels = $('#channels');
      this.messages = $('#messages');
      this.members = $('#members');
      this.createChannel = $('#create-channel-modal');
      this.channelInput = $('input[name="channel"]');
      this.messageInput = '#message';
      this.send = '#send';
      this.submit = '#submit';
    }

    isChannelActive (channel) {
      return $(channel).hasClass('active');
    }

    setChannelActive (channel) {
      $(channel).addClass('active').siblings().removeClass('active');
    }

    getDataAttribute (elem, attr) {
      return $(elem).data(attr);
    }

    channelCreateValidation () {
      this.createChannel.on('shown.bs.modal', function () {
        const form = $(this).find('form[name="create-channel"]');
        const channelName = $(form).find('input[name="channel"]');
        const btn = $(form).find('#submit');
        channelName.focus();
        $(btn).prop('disabled', true);
        channelName.on('keyup', function () {
          $(btn).prop('disabled', channelName.val().length < 1);
        });
      });
    }

    channelCreateFormClose () {
      this.createChannel.on('hidden.bs.modal', function () {
        $(this).find('#submit').prop('disabled', true);
        $(this).find('form')[0].reset();
      });
    }

    updateMessage (message) {
      $('#msg').append($(`
      <div>
      <span>${message.author}</span>
      <span>${message.timestamp}</span>
      <div>${message.text}</div>
      </div>
      `));
    }

    loadMessages (messages) {
      this.messages.html('').append(messages.reduce((acc, item) => {
        acc.append($(`
      <div>
      <span>${item.author}</span>
      <span>${item.timestamp}</span>
      <div>${item.text}</div>
      </div>
      `));
        return acc;
      }, $('<div id="msg"></div>')));
      this.messages.append($(`
    <input id="message" type="text">
    <button id="send">Send</button>
    `));
    }

    loadMembers (members) {
      this.members.html('').append(members.reduce((acc, item) => {
        acc.append($(`
      <li>${item}</li>
      `));
        return acc;
      }, $('<ul></ul>')));
    }

    loadChannels (channels, activeChannel) {
      this.channels.html('').append(channels.reduce((acc, item) => {
        acc.append($(`
      <li${item === activeChannel
          ? ' class=active'
          : ''} data-channel=${item}>${item}</li>
      `));
        return acc;
      }, $('<ul></ul>')));
      this.channels.append($(`
    <button id='create-channel' data-toggle='modal' data-target='#create-channel-modal'>Create channel</button>
    `));
    }

    showFlashMessages (messages) {
      messages.forEach(item => {
        $('main').prepend($(`
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
          ${item.message}
          <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      `));
      });
    }
  }

  const view = new View();
  const socket = new Socket(view);
});
