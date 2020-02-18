$(function () {
  class ScrollComponent {
    constructor (options) {
      this.name = options.name;
      this.listElem = options.listElem;
      this.component = options.component;
      this.loadCallback = options.loadCallback;
      this.sentinel = options.sentinel;
      this.spinner = $(options.spinnerSelector);
      this.renderer = options.renderer;
      this.loadedNumber = 0;
      this.allLoaded = false;
      this.initializeScroll();
    }

    onLoad (list, isReload, ...args) {
      if (isReload) {
        this.allLoaded = false;
        this.loadedNumber = list.length;
      } else {
        this.allLoaded = this.allLoaded || !list.length;
        this.loadedNumber += list.length;
      }
      console.log(`load ${this.name}`, this.loadedNumber);
      const cb = list.length ? this.loadCallback : null;
      this.loadList(list, isReload, cb, ...args);
    }

    loadList (list, isReload, cb, ...args) {
      if (isReload) this.listElem.html('');
      if (!list.length) {
        if (this.spinner) this.spinner.addClass('d-none');
        return;
      }
      this.renderer(list, ...args);
      console.log(this.component[0].scrollHeight, this.component[0].clientHeight);
      const isContainerFull = this.component[0].scrollHeight > this.component[0].clientHeight;
      if (!isContainerFull && cb) cb();
    }

    initializeScroll () {
      const intersectionObserver = new IntersectionObserver(entries => {
        if (this.loadedNumber && !this.allLoaded && entries[0].isIntersecting) {
          this.loadCallback();
          console.log(`emit ${this.name}`);
        }
      });
      intersectionObserver.observe(this.sentinel[0]);
    }
  }

  class Socket {
    constructor (view) {
      this.socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
      this.view = view;
      this.activeChannel = null;
      this.loadedMessagesNumber = 0;
      this.allMessagesLoaded = false;
      // this.loadedChannelsNumber = 0;
      // this.allChannelsLoaded = false;
      // this.loadedMembersNumber = 0;
      // this.allMembersLoaded = false;
      this.initialize();
    }

    initialize () {
      this.socket.on('connect', () => this.onConnect());
      this.socket.on('set active channel', channel => this.onSetActiveChanel(channel));
      this.socket.on('load messages', data => this.onLoadMessages(data.messages,
                                                                  !!this.loadedMessagesNumber,
                                                                  data.fromSendMessage,
                                                                  data.fromScrollEvent));
      // this.socket.on('load channels', data => this.onLoadChannels(data.channels, data.isReload));
      this.socket.on('load channels', data => this.channels.onLoad(data.channels, data.isReload, this.activeChannel));
      // this.socket.on('load members', data => this.onLoadMembers(data.members, data.isReload));
      this.socket.on('load members', data => this.members.onLoad(data.members, data.isReload));
      this.socket.on('flash', messages => this.view.showFlashMessages(messages));
    }

    onConnect () {
      this.initializeScrollComponents();
      this.initializeChannelChangeEvent();
      this.initializeMessageSendEvent();
      this.initializeChannelCreateEvent();
      this.initializeChannelCreateValidationEvent();
      this.initializeChannelCreateFormCloseEvent();
      this.initializeLogoutEvent();
      this.initializeScrollEvent();
    }

    initializeScrollComponents () {
      const channelsOptions = {
        name: 'channels',
        listElem: this.view.channels,
        component: this.view.channelsSection,
        sentinel: this.view.channelsSentinel,
        loadCallback: (...args) => this.socket.emit('get channels', this.channels.loadedNumber, ...args),
        renderer: this.view.renderChannels
      };
      this.channels = new ScrollComponent(channelsOptions);
      const membersOptions = {
        name: 'members',
        listElem: this.view.members,
        component: this.view.membersSection,
        sentinel: this.view.membersSentinel,
        loadCallback: (...args) => this.socket.emit('get members', this.members.loadedNumber, ...args),
        renderer: this.view.renderMembers
      };
      this.members = new ScrollComponent(membersOptions);
    }

    onSetActiveChanel (channel) {
      this.activeChannel = channel;
      this.socket.emit('joined', this.activeChannel);
      this.socket.emit('get messages', this.loadedMessagesNumber, false);
      this.socket.emit('get channels', this.channels.allLoaded);
      // this.socket.emit('get channels', this.loadedChannelsNumber);
    }

    onLoadMessages (messages, isReload, fromSendMessage, fromScrollEvent) {
      this.allMessagesLoaded = this.allMessagesLoaded || !messages.length;
      this.loadedMessagesNumber += messages.length;
      console.log('loadedMessagesNumber', this.loadedMessagesNumber);
      this.view.loadMessages(messages, isReload, fromSendMessage, fromScrollEvent,
                             () => this.socket.emit('get messages', this.loadedMessagesNumber, false));
    }

    // onLoadChannels (channels, isReload) {
    //   if (isReload) {
    //     this.allChannelsLoaded = false;
    //     this.loadedChannelsNumber = channels.length;
    //     // this.view.displaySpinner(this.view.channelsSpinner);
    //   } else {
    //     this.allChannelsLoaded = this.allChannelsLoaded || !channels.length;
    //     this.loadedChannelsNumber += channels.length;
    //   }
    //   console.log('load channels', this.loadedChannelsNumber);
    //   this.view.loadChannels(channels, isReload, () => this.socket.emit('get channels', this.loadedChannelsNumber),
    //                          this.activeChannel);
    // }

    // onLoadMembers (members, isReload) {
    //   if (isReload) {
    //     this.allMembersLoaded = false;
    //     this.loadedMembersNumber = members.length;
    //   } else {
    //     this.allMembersLoaded = this.allMembersLoaded || !members.length;
    //     this.loadedMembersNumber += members.length;
    //   }
    //   console.log('load members', this.loadedMembersNumber);
    //   this.view.loadMembers(members, isReload,
    //                         () => this.socket.emit('get members', this.loadedMembersNumber));
    // }

    initializeChannelChangeEvent () {
      const self = this;
      this.view.channels.on('click', 'li', function () {
        if (self.view.isChannelActive(this)) return;
        self.resetAtChannelChanged();
        self.socket.emit('left', self.activeChannel);
        self.activeChannel = self.view.getDataAttribute(this, 'channel');
        self.socket.emit('joined', self.activeChannel);
        self.socket.emit('get messages', self.loadedMessagesNumber, true);
        self.view.setChannelActive(this);
      });
    }

    resetAtChannelChanged () {
      this.loadedMessagesNumber = 0;
      this.allMessagesLoaded = false;
      this.view.displaySpinner(this.view.messagesSpinner);
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
        entries.forEach(entry => {
          if (entry.target.id === 'messages-sentinel' && this.loadedMessagesNumber &&
            !this.allMessagesLoaded && entry.isIntersecting) {
            console.log('emit messages');
            this.socket.emit('get messages', this.loadedMessagesNumber, true);
          }
            // } else if (entry.target.id === 'channels-sentinel' && this.loadedChannelsNumber &&
            //   !this.allChannelsLoaded && entry.isIntersecting) {
            //   console.log('emit channels');
            //   this.socket.emit('get channels', this.loadedChannelsNumber);
          // }
          // else if (entry.target.id === 'members-sentinel' && this.loadedMembersNumber &&
          //   !this.allMembersLoaded && entry.isIntersecting) {
          //   console.log('emit members');
          //   this.socket.emit('get members', this.loadedMembersNumber);
          // }
        });

        // if (this.loadedMessagesNumber && !this.allMessagesLoaded && entries[0].isIntersecting) {
        //   console.log('emit');
        //   this.socket.emit('get messages', this.loadedMessagesNumber, true);
        // }
      });
      // $('.sentinel').each((index, item) => intersectionObserver.observe(item));
      intersectionObserver.observe($('#messages-sentinel')[0]);
    }
  }

  class View {
    constructor () {
      this.flashMessages = $('#flash-messages');
      this.channels = $('#channels');
      this.messages = $('#messages');
      this.members = $('#members');
      this.sectionMessages = this.messages.closest('.chat-section');
      this.channelsSection = this.channels.closest('.chat-section');
      this.membersSection = this.members.closest('.chat-section');
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
      this.messagesSpinner = $('#messages-spinner');
      this.channelsSpinner = $('#channels-spinner');
      this.membersSpinner = $('#members-spinner');
      this.channelsSentinel = $('#channels-sentinel');
      this.membersSentinel = $('#members-sentinel');
      this.renderChannels = this.renderChannels.bind(this);
      this.renderMembers = this.renderMembers.bind(this);
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

    displaySpinner (spinner) {
      spinner.removeClass('d-none');
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

    loadMessages (messages, isReload, fromSendMessage, fromScrollEvent, cb = null) {
      if (!isReload) this.messages.html('');
      if (!messages.length) return this.messagesSpinner.addClass('d-none');
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
      console.log(this.sectionMessages[0].scrollHeight, this.sectionMessages[0].clientHeight);
      const isMessagesContainerFull = fromSendMessage ||
        (this.sectionMessages[0].scrollHeight > this.sectionMessages[0].clientHeight);
      if (!isMessagesContainerFull && cb) cb();
    }

    renderMembers (members) {
      const template = Handlebars.compile(this.membersTemplate.html());
      const html = template(members);
      this.members.append(html);
    }

    // loadMembers (members, isReload, cb) {
    //   if (isReload) this.members.html('');
    //   if (!members.length) return;
    //   const template = Handlebars.compile(this.membersTemplate.html());
    //   const html = template(members);
    //   this.members.append(html);
    //   const isMembersContainerFull = this.sectionMembers[0].scrollHeight > this.sectionMembers[0].clientHeight;
    //   if (!isMembersContainerFull && cb) cb();
    // }

    renderChannels (channels, activeChannel) {
      const template = Handlebars.compile(this.channelsTemplate.html());
      const html = template({ channels: channels, activeChannel: activeChannel });
      this.channels.append(html);
    }

    // loadChannels (channels, isReload, cb, activeChannel) {
    //   if (isReload) this.channels.html('');
    //   if (!channels.length) return; // this.channelsSpinner.addClass('d-none');
    //   const template = Handlebars.compile(this.channelsTemplate.html());
    //   const html = template({ channels: channels, activeChannel: activeChannel });
    //   this.channels.append(html);
    //   const isChannelsContainerFull = this.sectionChannels[0].scrollHeight > this.sectionChannels[0].clientHeight;
    //   if (!isChannelsContainerFull && cb) cb();
    // }

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
