const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function main() {
  // open the database file
  const db = await open({
    filename: "chat.db",
    driver: sqlite3.Database,
  });

  // create our 'messages' table (you can ignore the 'client_offset' column for now)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room VARCHAR(4),
        client_offset TEXT UNIQUE,
        content TEXT
    );
`);

  const port = process.argv[2];
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {},
  });

  app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
  });

  app.get("/script.js", (req, res) => {
    res.sendFile(join(__dirname, "script.js"));
  });

  async function displayLatestMessages(socket, socketRoom) {
    await db.each(
      "SELECT id, content FROM messages WHERE room = ? ORDER BY id DESC LIMIT 25",
      socketRoom,
      (_err, row) => {
        io.to(socket.id).emit("chat message", row.content, row.id);
      }
    );
  }

  io.on("connection", async (socket) => {
    let socketRoom = "0000";
    socket.join(socketRoom);
    try {
      await displayLatestMessages(socket, socketRoom);
    } catch (e) {
      // something went wrong
    }
    socket.on("room change", async (code, callback) => {
      let result;
      if (!RegExp("^[0-9]{4}$").test(code)) {
        callback();
      }
      socket.leave(socketRoom);
      socketRoom = code;
      socket.join(code);
      console.log(code);
      try {
        await displayLatestMessages(socket, socketRoom);
      } catch (e) {
        // something went wrong
      }
      callback();
    });
    socket.on("chat message", async (msg, clientOffset, callback) => {
      let result;
      console.log(socketRoom);
      try {
        result = await db.run(
          "INSERT INTO messages (content, client_offset, room) VALUES (?, ?, ?)",
          msg,
          clientOffset,
          socketRoom
        );
      } catch (e) {
        if (e.errno === 19 /* SQLITE_CONSTRAINT */) {
          // the message was already inserted, so we notify the client
          callback();
        } else {
          // nothing to do, just let the client retry
        }
        return;
      }
      // if (msg === "roomcodes") {
      //   db.each("SELECT * FROM messages", (_err, row) => {
      //     io.to(socket.id).emit("chat message", row.room, row.id);
      //   });
      // }
      io.to(socketRoom).emit("chat message", msg, result.lastID);
      // acknowledge the event
      callback();
    });

    if (!socket.recovered) {
      // if the connection state recovery was not successful
      try {
        await db.each(
          "SELECT id, content FROM messages WHERE id > ?",
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            if (row.room === socketRoom) {
              io.to(socket.id).emit("chat message", row.content, row.id);
            }
          }
        );
      } catch (e) {
        // something went wrong
      }
    }
  });

  server.listen(port, () => {
    console.log(`server running at http://localhost:${port}`);
  });
}

main();
