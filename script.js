let counter = 0;
const roomCode = "0000";

const socket = io({
  auth: {
    serverOffset: 0,
  },
  // enable retries
  ackTimeout: 10000,
  retries: 3,
});

const form = document.getElementById("form");
const room = document.getElementById("room");
const roomcode = document.getElementById("room-code");
const input = document.getElementById("input");
const messages = document.getElementById("messages");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (input.value) {
    // compute a unique offset
    const clientOffset = `${socket.id}-${counter++}`;
    socket.emit("chat message", input.value, clientOffset, roomCode);
    input.value = "";
  }
});

room.addEventListener("submit", (e) => {
  e.preventDefault();
  if (roomcode.value) {
    // compute a unique offset
    socket.emit("room change", roomcode.value);
  }
  messages.innerHTML = '';
});

socket.on("chat message", (msg, serverOffset) => {
  const item = document.createElement("li");
  item.textContent = msg;
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
  socket.auth.serverOffset = serverOffset;
});
