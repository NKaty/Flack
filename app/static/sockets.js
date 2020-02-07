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

    $('#send').on('click', function () {
      const inp = $('#message').val();
      if (inp.length > 0) {
        socket.emit('send message', inp);
        $('#message').val('');
      }
    });
  });

  socket.on('set active channel', channel => activeChannel = channel);

  socket.on('update message', message => {
    const item = document.createElement('li');
    item.innerHTML = message.author + ' ' + message.msg + ' ' + message.timestamp + '\n';
    $('#messages').append(item)
  });
});
