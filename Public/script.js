const socket = io();
let currentUser = '';
let mediaRecorder;
let audioChunks = [];

document.getElementById('join-btn').onclick = () => {
  const username = document.getElementById('username').value.trim();
  if (!username) return alert('Введите имя');
  currentUser = username;
  socket.emit('join', username);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('chat-screen').style.display = 'flex';
  
  if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
};

// Голосовые сообщения
document.getElementById('voice-btn').onclick = async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    document.getElementById('voice-btn').classList.remove('recording');
    return;
  }
  
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  
  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('send-message', {
        type: 'voice',
        username: currentUser,
        text: reader.result
      });
    };
    reader.readAsDataURL(audioBlob);
  };
  
  mediaRecorder.start();
  document.getElementById('voice-btn').classList.add('recording');
};

// Стикеры
document.getElementById('sticker-btn').onclick = () => {
  const panel = document.getElementById('sticker-panel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
};

document.querySelectorAll('.sticker').forEach(sticker => {
  sticker.onclick = () => {
    socket.emit('send-message', {
      type: 'sticker',
      username: currentUser,
      text: sticker.innerText
    });
    document.getElementById('sticker-panel').style.display = 'none';
  };
});

// Отправка текста
document.getElementById('send-btn').onclick = () => {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('send-message', { username: currentUser, text, type: 'text' });
  input.value = '';
};

document.getElementById('message-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') document.getElementById('send-btn').click();
});

// Функции отображения
function addMessage(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.username === currentUser ? 'own' : ''}`;
  div.dataset.id = msg.id;
  
  let content = '';
  if (msg.type === 'sticker') {
    content = `<div style="font-size: 48px">${msg.text}</div>`;
  } else if (msg.type === 'voice') {
    content = `<audio controls src="${msg.text}"></audio>`;
  } else {
    content = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
  }
  
  div.innerHTML = `
    <div class="message-name">${escapeHtml(msg.username)}</div>
    ${content}
    <div class="message-time">${msg.time}</div>
    <div class="message-reactions" id="reactions-${msg.id}"></div>
    <div class="add-reaction" style="font-size:12px; margin-top:4px; cursor:pointer">❤️ 👍 😂 🎉 😮</div>
  `;
  
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
  
  if (msg.username !== currentUser && Notification.permission === 'granted') {
    new Notification(`${msg.username}: ${msg.type === 'sticker' ? 'стикер' : msg.text}`);
  }
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'system-message';
  div.innerText = text;
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function scrollToBottom() {
  const messagesDiv = document.getElementById('messages');
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Реакции
document.getElementById('messages').addEventListener('click', (e) => {
  if (e.target.classList.contains('add-reaction') || e.target.parentElement?.classList.contains('add-reaction')) {
    const messageDiv = e.target.closest('.message');
    const messageId = messageDiv.dataset.id;
    let reaction = prompt('Выбери реакцию: ❤️ 👍 😂 🎉 😮');
    if (reaction && ['❤️', '👍', '😂', '🎉', '😮'].includes(reaction)) {
      socket.emit('add-reaction', { messageId, reaction, username: currentUser });
    }
  }
});

// Сокет события
socket.on('message-history', (history) => {
  history.forEach(msg => addMessage(msg));
});

socket.on('new-message', (msg) => addMessage(msg));
socket.on('system-message', (text) => addSystemMessage(text));
socket.on('update-users', (users) => {
  document.getElementById('user-count').innerText = `${users.length} в чате`;
});

socket.on('update-reactions', ({ messageId, reactions }) => {
  const container = document.getElementById(`reactions-${messageId}`);
  if (container) {
    container.innerHTML = Object.entries(reactions).map(([reaction, users]) => 
      `<span class="reaction">${reaction} ${users.length}</span>`
    ).join('');
  }
});
