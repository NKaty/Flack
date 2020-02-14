$(function () {
  class Socket {
    constructor (view) {
      this.socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
      this.view = view;
      this.activeChannel = null;
      this.loadedMessagesNumber = 0;
      this.initialize();
    }

    initialize () {
      this.socket.on('connect', () => this.onConnect());
      this.socket.on('set active channel', channel => this.onSetActiveChanel(channel));
      this.socket.on('load messages', data => this.onLoadMessages(data.messages, data.fromSendMessage, data.fromScrollEvent));
      this.socket.on('channel list changed', channels => this.view.loadChannels(channels, this.activeChannel));
      this.socket.on('member list changed', members => this.view.loadMembers(members));
      this.socket.on('flash', messages => this.view.showFlashMessages(messages));
    }

    onConnect () {
      this.initializeChannelChangeEvent();
      this.initializeMessageSendEvent();
      this.initializeChannelCreateEvent();
      this.initializeChannelCreateValidationEvent();
      this.initializeChannelCreateFormCloseEvent();
      this.initializeLogoutEvent();
      this.initializeScrollEvent();
    }

    onSetActiveChanel (channel) {
      this.activeChannel = channel;
      this.socket.emit('joined', this.activeChannel);
      this.socket.emit('get messages', this.loadedMessagesNumber, false);
    }

    onLoadMessages (messages, fromSendMessage, fromScrollEvent) {
      this.view.isMessagesContainerFull = false;
      console.log(fromSendMessage, fromScrollEvent);
      this.view.loadMessages(messages, this.loadedMessagesNumber, fromSendMessage, fromScrollEvent,
                             () => this.socket.emit('get messages', this.loadedMessagesNumber, false));
      this.loadedMessagesNumber += messages.length;
    }

    initializeChannelChangeEvent () {
      const self = this;
      this.view.channels.on('click', 'li', function () {
        if (self.view.isChannelActive(this)) return;
        self.loadedMessagesNumber = 0;
        self.socket.emit('left', self.activeChannel);
        self.activeChannel = self.view.getDataAttribute(this, 'channel');
        self.socket.emit('joined', self.activeChannel);
        self.socket.emit('get messages', self.loadedMessagesNumber, false);
        self.view.setChannelActive(this);
      });
    }

    initializeMessageSendEvent () {
      this.view.sendMessageButton.on('click', () => {
        const message = this.view.messageInput.val();
        if (message.length > 0) {
          this.socket.emit('send message', message);
          this.view.sendMessageForm[0].reset();
        }
      });
    }

    initializeChannelCreateEvent () {
      this.view.submitNewChannelButton.on('click', () => {
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

    initializeLogoutEvent () {
      this.view.logoutButton.on('click', (e) => {
        e.preventDefault();
        this.socket.disconnect();
        document.location.href = this.view.logoutButton.prop('href');
      });
    }

    initializeScrollEvent () {
      this.view.sectionMessages.scroll(() => {
        console.log(this.view.sectionMessages[0].scrollTop);
        if (this.view.sectionMessages[0].scrollTop <= 15) {
          console.log('emit');
          this.socket.emit('get messages', this.loadedMessagesNumber, true);
        }
      });
    }
  }

  class View {
    constructor () {
      this.flashMessages = $('#flash-messages');
      this.channels = $('#channels');
      this.messages = $('#messages');
      this.members = $('#members');
      this.sectionMessages = this.messages.closest('.chat-section');
      this.createChannelModal = $('#create-channel-modal');
      this.channelInput = this.createChannelModal.find('input[name="channel"]');
      this.submitNewChannelButton = this.createChannelModal.find('#submit');
      this.sendMessageForm = $('#send-message');
      this.messageInput = this.sendMessageForm.find('textarea[name="message"]');
      this.sendMessageButton = this.sendMessageForm.find('button');
      this.flashTemplate = $('#flash-template');
      this.channelsTemplate = $('#channels-template');
      this.membersTemplate = $('#members-template');
      this.messagesTemplate = $('#messages-template');
      this.logoutButton = $('#logout');
      this.fixedHeaders = $('.fixed-header');
      this.navbar = $('#navbar');
      this.chatContainer = $('#chat-container');
      this.isMessagesContainerFull = false;
      this.initialize();
    }

    initialize () {
      this.handlebarsHelpers();
      this.setTopMarginAfterFixedHeaders();
      this.setChatContainerHeight();
    }

    handlebarsHelpers () {
      Handlebars.registerHelper('if_eq', function (a, b, opts) {
        return a === b ? opts.fn(this) : opts.inverse(this);
      });
    }

    setTopMarginAfterFixedHeaders () {
      this.fixedHeaders.each((index, item) => {
        $(item).next().first().css('padding-top', $(item).outerHeight(true));
      });
    }

    setChatContainerHeight () {
      const height = $(window).height() - this.navbar.outerHeight(true) -
        this.flashMessages.outerHeight(true) -
        (parseInt(this.flashMessages.children().last().css('margin-bottom')) || 0);
      this.chatContainer.outerHeight(height);
    }

    onFlashMessageClosed () {
      const self = this;
      const handler = function () {
        self.setChatContainerHeight();
        $(this).off('closed.bs.alert', handler);
      };
      $('.alert').on('closed.bs.alert', handler);
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
      this.createChannelModal.on('shown.bs.modal', () => {
        this.channelInput.focus();
        this.submitNewChannelButton.prop('disabled', true);
        this.channelInput.on('keyup', () => {
          this.submitNewChannelButton.prop('disabled', this.channelInput.val().length < 1);
        });
      });
    }

    channelCreateFormClose () {
      this.createChannelModal.on('hidden.bs.modal', () => {
        this.submitNewChannelButton.prop('disabled', true);
        this.createChannelModal.find('form')[0].reset();
      });
    }

    loadMessages (messages, offset, fromSendMessage, fromScrollEvent, cb = null) {
      if (!messages.length && this.isMessagesContainerFull) return;
      const template = Handlebars.compile(this.messagesTemplate.html());
      const html = template(messages);
      if (!offset) this.messages.html('');
      if (fromSendMessage) this.messages.append(html);
      else this.messages.prepend(html);
      this.sendMessageForm.removeClass('d-none');
      if (!fromScrollEvent) this.sectionMessages.scrollTop(this.sectionMessages[0].scrollHeight);
      console.log(this.sectionMessages[0].scrollHeight, this.sectionMessages[0].clientHeight);
      this.isMessagesContainerFull = fromSendMessage || !messages.length ||
        (this.sectionMessages[0].scrollHeight > this.sectionMessages[0].clientHeight);
      if (!this.isMessagesContainerFull && cb) cb();
    }

    loadMembers (members) {
      const template = Handlebars.compile(this.membersTemplate.html());
      const html = template(members);
      this.members.html('').append(html);
    }

    loadChannels (channels, activeChannel) {
      const template = Handlebars.compile(this.channelsTemplate.html());
      const html = template({ channels: channels, activeChannel: activeChannel });
      this.channels.html('').append(html);
    }

    showFlashMessages (messages) {
      const template = Handlebars.compile(this.flashTemplate.html());
      const html = template(messages);
      this.flashMessages.append(html);
      this.setChatContainerHeight();
      this.onFlashMessageClosed();
    }
  }

  const view = new View();
  const socket = new Socket(view);
});
