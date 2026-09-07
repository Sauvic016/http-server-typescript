import * as net from "node:net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// TODO: Uncomment the code below to pass the first stage
const server = net.createServer((socket: net.Socket) => {
  socket.on("data", () => {
    socket.write("HTTP/1.1 200 OK\r\n\r\n");
    socket.end();
  });
  socket.on("close", () => {
    socket.end();
  });
});

server.listen(4221, "localhost");
