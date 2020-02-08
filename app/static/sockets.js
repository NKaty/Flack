$(function () {
  let activeChannel = null;
  const socket = io.connect(
    location.protocol + '//' + document.domain + ':' + location.port);
  socket.on('connect', () => {
    $('#channels').on('click', 'li', function () {
      if ($(this).hasClass('active')) return;
      socket.emit('left', activeChannel);
      activeChannel = $(this).data('channel');
      socket.emit('joined', activeChannel);
      $(this).addClass('active').siblings().removeClass('active');
    });

    $('#messages').on('click', '#send', function () {
      const inp = $('#message').val();
      if (inp.length > 0) {
        socket.emit('send message', inp);
        $('#message').val('');
      }
    });
  });

  socket.on('set active channel', channel => {
    activeChannel = channel;
    socket.emit('joined', activeChannel);
  });

  socket.on('update message', message => {
    $('#msg').append($(`
      <div>
      <span>${message.author}</span>
      <span>${message.timestamp}</span>
      <div>${message.text}</div>
      </div>
      `));
  });

  socket.on('load channel', channelInfo => {
    loadMessages(channelInfo.messages);
    loadMembers(channelInfo.members);
  });

  socket.on('load channels', channels => loadChannels(channels));

  function loadMessages (messages) {
    $('#messages').html('').append(messages.reduce((acc, item) => {
      acc.append($(`
      <div>
      <span>${item.author}</span>
      <span>${item.timestamp}</span>
      <div>${item.text}</div>
      </div>
      `));
      return acc;
    }, $('<div id="msg"></div>')));
    $('#messages').append($(`
    <input id="message" type="text">
    <button id="send">Send</button>
    `));
  }

  function loadMembers (members) {
    $('#members').html('').append(members.reduce((acc, item) => {
      acc.append($(`
      <li>${item}</li>
      `));
      return acc;
    }, $('<ul></ul>')));
  }

  function loadChannels (channels) {
    $('#channels').html('').append(channels.reduce((acc, item) => {
      acc.append($(`
      <li${item === activeChannel
        ? ' class=active'
        : ''} data-channel=${item}>${item}</li>
      `));
      return acc;
    }, $('<ul></ul>')));
  }
});
