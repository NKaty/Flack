$(function () {
  class ScrollComponent {
    constructor (options) {
      this.name = options.name;
      this.listElem = options.listElem;
      this.component = options.component;
      this.wrapperComponent = options.wrapperComponent || $(document.body);
      this.loadCallback = options.loadCallback;
      this.scrollCallback = options.scrollCallback || options.loadCallback;
      this.sentinel = options.sentinel;
      this.spinner = options.spinner;
      this.renderer = options.renderer;
      this.loadedNumber = 0;
      this.allLoaded = false;
      this.isContainerFull = false;
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
      this.isContainerFull = this.component[0].scrollHeight > this.component[0].clientHeight ||
        this.component.outerHeight(true) > this.wrapperComponent.height();
      if (!this.isContainerFull && cb) cb();
    }

    initializeScroll () {
      const intersectionObserver = new IntersectionObserver(entries => {
        if (this.isContainerFull && !this.allLoaded &&
          entries[0].isIntersecting && this.scrollCallback) {
          this.scrollCallback();
        }
      });
      intersectionObserver.observe(this.sentinel[0]);
    }
  }

  class Socket {
    constructor (view) {
      this.socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);
      this.view = view;
      this.username = null;
      this.activeChannel = null;
      this.isFirstConnect = true;
      this.initialize();
    }

    initialize () {
      this.socket.on('connect', () => this.onConnect());
      this.socket.on('set initial information', data => this.onSetActiveChanel(data.channel, data.username));
      this.socket.on('load messages', data => this.messages.onLoad(data.messages,
                                                                   !this.messages.loadedNumber,
                                                                   data.fromSendMessage,
                                                                   data.fromScrollEvent,
                                                                   this.username));
      this.socket.on('load channels', data => this.channels.onLoad(data.channels, data.isReload,
                                                                   this.activeChannel));
      this.socket.on('load members', data => this.members.onLoad(data.members, data.isReload,
                                                                 this.username));
      this.socket.on('load channel information', info => this.onLoadChannelInformation(info));
      this.socket.on('flash', messages => this.view.showFlashMessages(messages));
    }

    onConnect () {
      if (this.isFirstConnect) {
        this.initializeScrollComponents();
        this.initializeChannelChangeEvent();
        this.initializeToggleChannelPinEvent();
        this.initializeMessageSendEvent();
        this.initializeDownloadFileEvent();
        this.initializeChannelCreateEvent();
        this.initializeChannelCreateFormOpenEvent();
        this.initializeChannelCreateFormCloseEvent();
        this.initializeLogoutEvent();
      }
    }

    initializeScrollComponents () {
      const channelsOptions = {
        name: 'channels',
        listElem: this.view.channels,
        component: this.view.channelsSection,
        wrapperComponent: this.view.chatContainer,
        sentinel: this.view.channelsSentinel,
        loadCallback: () => this.socket.emit('get channels', this.channels.loadedNumber),
        renderer: this.view.renderChannels
      };
      this.channels = new ScrollComponent(channelsOptions);
      const membersOptions = {
        name: 'members',
        listElem: this.view.members,
        component: this.view.channelInfoSection,
        wrapperComponent: this.view.chatContainer,
        sentinel: this.view.channelInfoSentinel,
        loadCallback: () => this.socket.emit('get members', this.members.loadedNumber),
        renderer: this.view.renderMembers
      };
      this.members = new ScrollComponent(membersOptions);
      const messagesOptions = {
        name: 'messages',
        listElem: this.view.messages,
        component: this.view.messagesSection,
        wrapperComponent: this.view.chatContainer,
        sentinel: this.view.messagesSentinel,
        spinner: this.view.messagesSpinner,
        loadCallback: () => this.socket.emit('get messages', this.messages.loadedNumber, false),
        scrollCallback: () => this.socket.emit('get messages', this.messages.loadedNumber, true),
        renderer: this.view.renderMessages
      };
      this.messages = new ScrollComponent(messagesOptions);
    }

    onSetActiveChanel (channel, username) {
      if (this.isFirstConnect) {
        this.username = username;
        this.activeChannel = channel;
        this.socket.emit('get channels', this.channels.loadedNumber);
        this.isFirstConnect = false;
      }
      if (this.activeChannel) {
        this.socket.emit('joined', this.activeChannel);
      } else {
        this.messages.onLoad([], true);
      }
    }

    onLoadChannelInformation (info) {
      this.view.renderChannelDetails(info);
    }

    initializeChannelChangeEvent () {
      const self = this;
      this.view.channels.on('click', this.view.channelNameClass, function () {
        const newActiveChannel = self.view.setChannelActive(this);
        if (newActiveChannel) {
          self.onChannelChangeEvent(newActiveChannel);
        }
      });
    }

    resetAtChannelChanged () {
      this.messages.loadedNumber = 0;
      this.messages.allLoaded = false;
    }

    onChannelChangeEvent (newActiveChannel) {
      this.resetAtChannelChanged();
      this.socket.emit('left', this.activeChannel);
      this.activeChannel = newActiveChannel;
      this.socket.emit('joined', this.activeChannel);
    }

    initializeToggleChannelPinEvent () {
      const self = this;
      this.view.channels.on('click', this.view.channelPinIconClass, function () {
        const { channel, actionToPin } = self.view.getChannelPinData(this);
        self.socket.emit('toggle channel pin', channel, actionToPin);
      });
    }

    initializeMessageSendEvent () {
      this.view.sendMessageButton.on('click', () => {
        const message = this.view.messageInput.val();
        const file = this.view.fileInput.prop('files');
        if (this.view.checkSendMessageForm(message, file).isValid) {
          if (file.length) {
            let fileData = { size: file[0].size, name: file[0].name, type: file[0].type };
            let fileReader = new FileReader();
            fileReader.onload = (event) => {
              fileData.content = fileReader.result;
              this.socket.emit('send message', { message: message, file: fileData });
              this.view.resetSendMessageForm();
              this.view.displaySpinner(this.view.newMessageSpinner);
            };
            fileReader.onerror = () => {
              this.view.showFormFieldErrorMessage(this.view.fileInfoGroup,
                                                  'Error occurred while uploading the file.',
                                                  this.view.scrollToChatBottom);
            };
            fileReader.readAsArrayBuffer(file[0]);
          } else {
            this.socket.emit('send message', { message: message, file: {} });
            this.view.resetSendMessageForm();
          }
        }
      });
    }

    initializeDownloadFileEvent () {
      const self = this;
      this.view.messages.on('click', this.view.downloadButtonClass, function () {
        self.socket.emit('download file', self.view.getDataAttributeFile(this), data => {
          if (data) {
            const options = {};
            if (data.type) options.type = data.type;
            const blob = new Blob([data.content], options);
            saveAs(blob, data.name);
          }
        });
      });
    }

    initializeChannelCreateEvent () {
      this.view.submitNewChannelButton.on('click', () => {
        const channelName = this.view.channelNameInput.val();
        const channelDescription = this.view.channelDescriptionInput.val();
        if (this.view.checkChannelCreateForm(channelName, channelDescription).isValid) {
          this.socket.emit('create channel', {
            name: channelName,
            description: channelDescription
          }, isCreated => {
            if (isCreated) {
              this.view.setChannelActive(channelName);
              this.onChannelChangeEvent(channelName);
            }
          });
          this.view.createChannelModal.modal('hide');
        }
      });
    }

    initializeChannelCreateFormOpenEvent () {
      this.view.channelCreateFormOpen();
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
  }

  class View {
    constructor () {
      this.flashMessages = $('#flash-messages');
      this.tooltipSelector = '[data-tooltip="tooltip"]';
      this.channels = $('#channels');
      this.messages = $('#messages');
      this.channelDetails = $('#channel-details');
      this.members = $('#members');
      this.messagesArea = $('#messages-area');
      this.messagesSection = this.messages.closest('.chat-section');
      this.channelsSection = this.channels.closest('.chat-section');
      this.channelInfoSection = this.channelDetails.closest('.chat-section');
      this.channelNameClass = '.channel-name';
      this.channelPinIconClass = '.channel-pin-icon';
      this.channelNameHeader = $('#channel-name-header');
      this.togglePaneButtons = $('.toggle-pane');
      this.toggleChannelPaneButton = $('.toggle-pane[data-target="#messages-tab"]');
      this.toggleChannelInfoPaneButton = $('#toggle-channel-info');
      this.closeChannelInfoPaneButton = $('#close-channel-info');
      this.createChannelModal = $('#create-channel-modal');
      this.channelNameInput = this.createChannelModal.find('input[name="channel"]');
      this.channelDescriptionInput = this.createChannelModal.find('textarea[name="description"]');
      this.submitNewChannelButton = this.createChannelModal.find('#submit');
      this.sendMessageForm = $('#send-message');
      this.messageInput = this.sendMessageForm.find('textarea[name="message"]');
      this.fileInput = this.sendMessageForm.find('input[name="file"]');
      this.fileInfoField = $('#upload-file-info');
      this.fileInfoGroup = this.fileInfoField.parent();
      this.unlinkUploadFileButton = $('#unlink-file');
      this.downloadButtonClass = '.download';
      this.sendMessageButton = $('#btn-send');
      this.flashTemplate = $('#flash-template');
      this.channelsTemplate = $('#channels-template');
      this.channelDetailsTemplate = $('#channel-details-template');
      this.membersTemplate = $('#members-template');
      this.messagesTemplate = $('#messages-template');
      this.logoutButton = $('#logout');
      this.navbar = $('#navbar');
      this.chatContainer = $('#chat-container');
      this.messagesSpinner = $('#messages-spinner');
      this.newMessageSpinner = $('#new-message-spinner');
      this.channelsSentinel = $('#channels-sentinel');
      this.channelInfoSentinel = $('#channel-info-sentinel');
      this.messagesSentinel = $('#messages-sentinel');
      this.maximumFileSize = 5 * 1024 * 1024;
      this.renderChannels = this.renderChannels.bind(this);
      this.renderMembers = this.renderMembers.bind(this);
      this.renderMessages = this.renderMessages.bind(this);
      this.scrollToChatBottom = this.scrollToChatBottom.bind(this);
      this.initialize();
    }

    initialize () {
      this.handlebarsHelpers();
      this.initializeTooltips(this.tooltipSelector);
      this.setChatContainerHeight();
      this.setMessagesAreaHeight();
      this.togglePane();
      this.onToggleChannelInfoPane();
      this.onCloseChannelInfoPane();
      this.onWindowResize();
      this.onChangeUploadFileName();
      this.unlinkUploadFile();
      this.validateSendMessageForm();
      this.resizeMessageInput();
      this.animatePaneChanging();
      this.initializePresentFlashMessages();
    }

    handlebarsHelpers () {
      Handlebars.registerHelper('if_eq', function (a, b, opts) {
        return a === b ? opts.fn(this) : opts.inverse(this);
      });

      Handlebars.registerHelper('date', function (date, method, ...args) {
        return moment.utc(date).local()[method](...args);
      });

      Handlebars.registerHelper('breaklines', function (text) {
        text = Handlebars.Utils.escapeExpression(text);
        text = text.replace(/(\r\n|\n|\r)/gm, '<br>');
        return new Handlebars.SafeString(text);
      });
    }

    initializeTooltips (tooltips) {
      $(tooltips).tooltip();
    }

    hideTooltips (tooltips = this.tooltipSelector) {
      $(tooltips).tooltip('hide');
    }

    setChatContainerHeight () {
      const height = $(window).height() - this.navbar.outerHeight(true) -
        this.flashMessages.outerHeight(true) -
        (parseInt(this.flashMessages.children().last().css('margin-bottom')) || 0);
      this.chatContainer.outerHeight(height);
    }

    setMessagesAreaHeight () {
      this.messagesArea.css('minHeight', `${this.messagesSection.height() -
      this.messagesSection.find('.fixed-header').outerHeight(true) -
      this.messagesSentinel.outerHeight(true)}px`);
    }

    scrollToChatBottom (animation = true) {
      if ((this.messagesSection[0].scrollHeight - this.messagesSection[0].scrollTop -
        this.messagesSection[0].clientHeight) !== 0) {
        if (animation) this.messagesSection.animate({ scrollTop: this.messagesSection[0].scrollHeight }, 2000);
        else this.messagesSection.scrollTop(this.messagesSection[0].scrollHeight);
      }
    }

    checkBottomScroll () {
      return (this.messagesSection[0].scrollHeight -
        this.messagesSection[0].scrollTop - this.messagesSection[0].clientHeight) !== 0;
    }

    onWindowResize () {
      const optimizedResize = this.throttle(() => {
        this.setChatContainerHeight();
        this.setMessagesAreaHeight();
      }, 150);
      $(window).on('resize', optimizedResize);
    }

    onFlashMessageClosed () {
      const self = this;
      const handler = function () {
        self.setChatContainerHeight();
        $(this).off('closed.bs.alert', handler);
      };
      $('.alert').on('closed.bs.alert', handler);
    }

    showFormFieldErrorMessage (field, error, cb) {
      const nextSibling = field.next();
      if (nextSibling.hasClass('invalid-feedback')) {
        nextSibling.text(error);
      } else {
        $(`<div class="invalid-feedback">${error}</div>`).insertAfter(field);
      }
      if (cb) cb();
    }

    removeFormFieldErrorMessage (field) {
      const nextSibling = field.next();
      if (nextSibling.hasClass('invalid-feedback')) nextSibling.remove();
    }

    displaySpinner (spinner) {
      spinner.removeClass('d-none');
    }

    isChannelActive (channel) {
      return $(channel).hasClass('channel-active');
    }

    setChannelActive (channelName) {
      let newActiveChannelItem;
      if (typeof channelName === 'string') {
        newActiveChannelItem = this.channels.children(`li[data-channel=${channelName}]`);
      } else {
        newActiveChannelItem = $(channelName).parent();
      }
      if (this.isChannelActive(newActiveChannelItem)) return;
      this.displaySpinner(this.messagesSpinner);
      if (newActiveChannelItem.length) {
        newActiveChannelItem.addClass('channel-active').siblings().removeClass('channel-active');
      } else {
        this.channels.find('.channel-active').removeClass('channel-active');
      }
      this.channelNameHeader.html(newActiveChannelItem.find(this.channelNameClass).html() || channelName);
      if (this.toggleChannelPaneButton.css('display') !== 'none') this.toggleChannelPaneButton.tab('show');
      return newActiveChannelItem.data('channel');
    }

    getChannelPinData (channelPinIcon) {
      const channelItem = $(channelPinIcon).parent();
      const actionToPin = !channelItem.data('pinned');
      const channel = channelItem.data('channel');
      this.hideTooltips();
      if (actionToPin) this.channelsSection.scrollTop(0);
      return { channel: channel, actionToPin: actionToPin };
    }

    getDataAttributeFile (elem) {
      return $(elem).data('file_id');
    }

    togglePane () {
      this.togglePaneButtons.on('click', () => {
        this.togglePaneButtons.removeClass('active');
      });
    }

    animatePaneChanging () {
      this.togglePaneButtons.on('show.bs.tab', function () {
        let animationClass = 'animated faster ';
        const nextPane = $($(this).data('target'));
        if (nextPane.hasClass('channels')) animationClass += 'slideInLeft';
        else if (nextPane.hasClass('channel-info')) animationClass += 'slideInRight';
        else if (nextPane.hasClass('messages')) {
          const currentPane = $(this).closest('.chat-section');
          if (currentPane.hasClass('channels')) animationClass += 'slideInRight';
          else if (currentPane.hasClass('channel-info')) animationClass += 'slideInLeft';
        }

        function onAnimationEnded () {
          nextPane.removeClass(animationClass);
          nextPane.off('animationend', onAnimationEnded);
        }

        nextPane.addClass(animationClass);
        nextPane.on('animationend', onAnimationEnded);
      });
    }

    onToggleChannelInfoPane () {
      const self = this;
      this.toggleChannelInfoPaneButton.on('click', function () {
        self.checkScreenChangedFromExtraSmall();
        if ($(this).hasClass('active')) self.closeChannelInfoPane();
        else {
          self.channelInfoSection.addClass('removed d-sm-block');
          $(this).addClass('active');
          setTimeout(() => self.channelInfoSection.removeClass('removed'), 50);
        }
      });
    }

    onCloseChannelInfoPane () {
      this.closeChannelInfoPaneButton.on('click', () => {
        this.checkScreenChangedFromExtraSmall();
        this.closeChannelInfoPane();
      });
    }

    closeChannelInfoPane () {
      this.channelInfoSection.addClass('removed');
      const onAnimationEnded = () => {
        this.channelInfoSection.removeClass('d-sm-block removed');
        this.toggleChannelInfoPaneButton.removeClass('active');
        this.channelInfoSection.off('transitionend', onAnimationEnded);
      };
      this.channelInfoSection.on('transitionend', onAnimationEnded);
    }

    checkScreenChangedFromExtraSmall () {
      if (this.channelInfoSection.hasClass('active')) {
        this.channelInfoSection.removeClass('active').addClass('d-sm-block');
        this.messagesSection.addClass('active');
        this.toggleChannelInfoPaneButton.addClass('active');
      }
    }

    checkChannelCreateForm (channelName, channelDescription) {
      const errors = { name: '', description: '' };
      const isNameValid = channelName.length > 0 && channelName.length < 21 &&
        /^[A-Za-z][A-Za-z0-9_.]*$/.test(channelName);
      errors.name = isNameValid ? '' : 'Channel name must be between 1 and 20 characters long and have only letters, numbers, dots or underscores.';
      const isDescriptionValid = channelDescription.length > 0 && channelDescription.length < 255;
      errors.description = isDescriptionValid ? '' : 'Channel description must be between 1 and 255 characters long';
      return {
        isValid: isNameValid && isDescriptionValid,
        errors: errors
      };
    }

    calculateUploadFileSize (fileSize) {
      const units = ['', 'B', 'KB', 'MB', 'GB'];
      let size = fileSize;
      let bytes = 1024;
      for (let i = 1; i < 4; i++) {
        if (fileSize < bytes) return `${size}${units[i]}`;
        size = (fileSize / bytes).toFixed(1);
        bytes *= 1024;
      }
      return `${size}${units[4]}`;
    }

    checkSendMessageForm (message, files) {
      let errors = [];
      let isValid = message.length > 0 || files.length > 0;
      if (files.length > 0) {
        if (files[0].name.length < 1) {
          isValid = false;
          errors.push('File must have a name.');
        }
        if (!files[0].size) {
          isValid = false;
          errors.push('File size is unknown or 0.');
        }
        if (files[0].size > this.maximumFileSize) {
          isValid = false;
          errors.push(`File exceeded maximum size ${this.calculateUploadFileSize(this.maximumFileSize)}.`);
        }
      }
      return { isValid: isValid, error: errors.length ? errors.join(' ') : '' };
    }

    channelCreateFormOpen () {
      this.createChannelModal.on('shown.bs.modal', () => {
        this.channelNameInput.focus();
        this.submitNewChannelButton.prop('disabled', true);
        this.createChannelModal.on('input', () => {
          const channelName = this.channelNameInput.val();
          const channelDescription = this.channelDescriptionInput.val();
          const validation = this.checkChannelCreateForm(channelName, channelDescription);
          this.submitNewChannelButton.prop('disabled', !validation.isValid);
          if (validation.errors.name && channelName.length) {
            this.showFormFieldErrorMessage(this.channelNameInput, validation.errors.name);
          } else this.removeFormFieldErrorMessage(this.channelNameInput);
          if (validation.errors.description && channelDescription.length) {
            this.showFormFieldErrorMessage(this.channelDescriptionInput, validation.errors.description);
          } else this.removeFormFieldErrorMessage(this.channelDescriptionInput);
        });
      });
    }

    channelCreateFormClose () {
      this.createChannelModal.on('hidden.bs.modal', () => {
        this.submitNewChannelButton.prop('disabled', true);
        this.removeFormFieldErrorMessage(this.channelNameInput);
        this.removeFormFieldErrorMessage(this.channelDescriptionInput);
        this.createChannelModal.find('form')[0].reset();
      });
    }

    toggleUploadFileName (html) {
      if (html === '') {
        const parent = this.fileInfoField.parent();
        parent.animate({ height: 0, opacity: 0 }, () => {
          this.fileInfoField.html(html);
          parent.height('auto').css('opacity', 1);
        });
      } else {
        this.fileInfoField.html(html);
      }
      this.scrollToChatBottom();
    }

    onChangeUploadFileName () {
      const self = this;
      this.fileInput.on('change', function () {
        const files = $(this).prop('files');
        const html = files.length > 0 ?
          `${files[0].name} - ${self.calculateUploadFileSize(files[0].size)}` : '';
        self.toggleUploadFileName(html);
      });
    }

    unlinkUploadFile () {
      this.unlinkUploadFileButton.on('click', () => {
        this.fileInput.val('').change();
      });
    }

    validateSendMessageForm () {
      this.sendMessageForm.on('input change', () => {
        const validation = this.checkSendMessageForm(this.messageInput.val(), this.fileInput.prop('files'));
        this.sendMessageButton.prop('disabled', !validation.isValid);
        if (validation.error) {
          this.showFormFieldErrorMessage(this.fileInfoGroup, validation.error, this.scrollToChatBottom);
        } else this.removeFormFieldErrorMessage(this.fileInfoGroup);
      });
    }

    resetSendMessageForm () {
      this.sendMessageForm[0].reset();
      this.toggleUploadFileName('');
      this.messageInput.attr('rows', 2).outerHeight('auto');
      this.sendMessageButton.prop('disabled', true);
    }

    resizeMessageInput () {
      const self = this;
      const offset = this.messageInput[0].offsetHeight - this.messageInput[0].clientHeight;
      this.messageInput.on('input', function () {
        $(this).outerHeight('auto').outerHeight(this.scrollHeight + offset);
        self.scrollToChatBottom(false);
      });
    }

    renderMessages (messages, fromSendMessage, fromScrollEvent, username) {
      const template = Handlebars.compile(this.messagesTemplate.html());
      const html = template({ messages: messages, username: username, animated: fromSendMessage });
      if (fromSendMessage) {
        if (!this.newMessageSpinner.hasClass('d-none')) this.newMessageSpinner.addClass('d-none');
        const isBottomScroll = this.checkBottomScroll();
        const prevScrollTop = this.messagesSection.scrollTop();
        this.messages.append(html);
        if (isBottomScroll) this.messagesSection.scrollTop(prevScrollTop);
        else this.scrollToChatBottom(false);
      } else if (fromScrollEvent) {
        const prevScrollTop = this.messagesSection.scrollTop();
        const wrappedHtml = $(`<div id="wrapper" class="invisible">${html}</div>`);
        this.messages.append(wrappedHtml);
        const htmlHeight = wrappedHtml.outerHeight();
        wrappedHtml.remove();
        setTimeout(() => {
          this.messages.prepend(html);
          this.messagesSection.scrollTop(prevScrollTop + htmlHeight);
        }, 300);
      } else {
        this.messages.prepend(html);
        this.setMessagesAreaHeight();
        this.scrollToChatBottom(false);
      }
    }

    renderChannelDetails (info) {
      const template = Handlebars.compile(this.channelDetailsTemplate.html());
      const html = template(info);
      this.channelDetails.html('').append(html);
    }

    renderMembers (members, username) {
      const template = Handlebars.compile(this.membersTemplate.html());
      const html = template({ members: members, username: username });
      this.members.append(html);
    }

    renderChannels (channels, activeChannel) {
      const template = Handlebars.compile(this.channelsTemplate.html());
      const html = template({ channels: channels, activeChannel: activeChannel });
      this.channels.append(html);
      this.initializeTooltips(this.channels.find(this.tooltipSelector));
    }

    showFlashMessages (messages) {
      const template = Handlebars.compile(this.flashTemplate.html());
      const html = template(messages);
      const isBottomScroll = this.checkBottomScroll();
      this.flashMessages.append(html);
      this.setChatContainerHeight();
      if (!isBottomScroll) this.scrollToChatBottom(false);
      this.onFlashMessageClosed();
      this.closeFlashMessages(messages.length);
    }

    closeFlashMessages (messagesLen) {
      const alerts = this.flashMessages.find('.alert').slice(-messagesLen);
      alerts.each((index, item) => setTimeout(() => $(item).alert('close'), 10000));
    }

    initializePresentFlashMessages () {
      if (this.flashMessages.children().length > 0) {
        this.onFlashMessageClosed();
        this.closeFlashMessages(this.flashMessages.children().length);
      }
    }

    throttle (func, wait = 250, immediate = false) {
      let timeout;
      return (...args) => {
        const later = () => {
          timeout = null;
          if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        if (!timeout) timeout = setTimeout(later, wait);
        if (callNow) func(...args);
      };
    }
  }

  const view = new View();
  new Socket(view);
});
