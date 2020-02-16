$(function () {
  class Socket {
    constructor (view) {
      this.socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
      this.view = view;
      this.activeChannel = null;
      this.loadedMessagesNumber = 0;
      this.allMessagesLoaded = false;
      this.initialize();
    }

    initialize () {
      this.socket.on('connect', () => this.onConnect());
      this.socket.on('set active channel', channel => this.onSetActiveChanel(channel));
      this.socket.on('load messages', data => this.onLoadMessages(data.messages,
                                                                  data.fromSendMessage,
                                                                  data.fromScrollEvent));
      this.socket.on('channel list changed', channels => this.view.loadChannels(channels,
                                                                                this.activeChannel));
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
      this.allMessagesLoaded = this.allMessagesLoaded || !messages.length;
      const prevLoadedMessagesNumber = this.loadedMessagesNumber;
      this.loadedMessagesNumber += messages.length;
      console.log('loadedMessagesNumber', this.loadedMessagesNumber);
      this.view.loadMessages(messages, !!prevLoadedMessagesNumber, fromSendMessage, fromScrollEvent,
                             () => this.socket.emit('get messages', this.loadedMessagesNumber, false));
    }

    initializeChannelChangeEvent () {
      const self = this;
      this.view.channels.on('click', 'li', function () {
        if (self.view.isChannelActive(this)) return;
        self.resetAtChannelChange();
        self.socket.emit('left', self.activeChannel);
        self.activeChannel = self.view.getDataAttribute(this, 'channel');
        self.socket.emit('joined', self.activeChannel);
        self.socket.emit('get messages', self.loadedMessagesNumber, false);
        self.view.setChannelActive(this);
      });
    }

    resetAtChannelChange () {
      this.loadedMessagesNumber = 0;
      this.allMessagesLoaded = false;
      this.view.displaySpinners();
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
      const intersectionObserver = new IntersectionObserver(entries => {
        console.log('observer', this.view.sectionMessages[0].scrollTop);
        if (this.loadedMessagesNumber && !this.allMessagesLoaded && entries[0].isIntersecting) {
          console.log('emit');
          this.socket.emit('get messages', this.loadedMessagesNumber, true);
        }
      });
      intersectionObserver.observe($('#sentinel')[0]);
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
      this.spinners = $('.spinner-border');
      this.messageSpinner = $('#message-spinner');
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

    displaySpinners () {
      this.spinners.each((index, item) => $(item).removeClass('d-none'));
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

    loadMessages (messages, isOffset, fromSendMessage, fromScrollEvent, cb = null) {
      if (!isOffset) this.messages.html('');
      if (!messages.length) {
        this.messageSpinner.addClass('d-none');
        return;
      }
      const template = Handlebars.compile(this.messagesTemplate.html());
      const html = template(messages);
      if (fromSendMessage) {
        this.messages.append(html);
        this.sectionMessages.scrollTop(this.sectionMessages[0].scrollHeight);
      } else if (fromScrollEvent) {
        const prevScrollTop = this.sectionMessages.scrollTop();
        // variant without spinner
        // const wrappedHtml = $(`<div id="wrapper">${html}</div>`);
        // this.messages.prepend(wrappedHtml);
        // this.sectionMessages.scrollTop(prevScrollTop + wrappedHtml.outerHeight());
        // wrappedHtml.children().unwrap();
        // variant with spinner
        const wrappedHtml = $(`<div id="wrapper" class="invisible">${html}</div>`);
        this.messages.append(wrappedHtml);
        const htmlHeight = wrappedHtml.outerHeight();
        wrappedHtml.remove();
        setTimeout(() => {
          this.messages.prepend(html);
          this.sectionMessages.scrollTop(prevScrollTop + htmlHeight);
        }, 300);
      } else {
        this.messages.prepend(html);
        this.sectionMessages.scrollTop(this.sectionMessages[0].scrollHeight);
      }
      this.sendMessageForm.removeClass('d-none');
      const isMessagesContainerFull = fromSendMessage ||
        (this.sectionMessages[0].scrollHeight > this.sectionMessages[0].clientHeight);
      if (!isMessagesContainerFull && cb) cb();
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
