const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const users = {};
const messages = [];

io.on('connection', (socket) => {
  console.log('Новый пользователь');

  socket.on('join', (username) => {
    users[socket.id] = username;
    socket.emit('message-history', messages.slice(-50));
    socket.broadcast.emit('system-message', `${username} присоединился`);
    io.emit('update-users', Object.values(users));
  });

  socket.on('send-message', (data) => {
    const msg = {
      id: Date.now(),
      type: data.type || 'text',
      username: data.username,
      text: data.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }),
      reactions: {}
    };
    messages.push(msg);
    io.emit('new-message', msg);
  });

  socket.on('add-reaction', ({ messageId, reaction, username }) => {
    const msg = messages.find(m => m.id == messageId);
    if (msg) {
      if (!msg.reactions[reaction]) msg.reactions[reaction] = [];
      if (!msg.reactions[reaction].includes(username)) {
        msg.reactions[reaction].push(username);
      }
      io.emit('update-reactions', { messageId, reactions: msg.reactions });
    }
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      delete users[socket.id];
      io.emit('system-message', `${username} покинул чат`);
      io.emit('update-users', Object.values(users));
    }
  });
});

server.listen(3000, () => console.log('Сервер на http://localhost:3000'));
