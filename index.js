const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");

const app = express();
const server = createServer(app);
const port = process.argv[2];

app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
});

server.listen(port, () => {
    console.log(`server running at http://localhost:${port}`);
});
