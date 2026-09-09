import * as net from "node:net";
import fs from "node:fs";

const args = process.argv.slice(2);

const handleNotFoundRoute = (socket: net.Socket) => {
  socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
};

const handleEchoRoute = (socket: net.Socket, path: string) => {
  const text = path.slice("/echo/".length);
  socket.end(
    "HTTP/1.1 200 OK\r\n" +
      "Content-Type: text/plain\r\n" +
      `Content-Length: ${Buffer.byteLength(text)}\r\n` +
      "\r\n" +
      `${text}`,
  );
};

const handleUserAgentRoute = (socket: net.Socket, requestLines: string[]) => {
  const userAgentLine = requestLines.find((line) => line.toLowerCase().startsWith("user-agent:"));

  const userAgent = userAgentLine?.split(":").slice(1).join(":").trim() ?? "";

  socket.end(
    "HTTP/1.1 200 OK\r\n" +
      "Content-Type: text/plain\r\n" +
      `Content-Length: ${Buffer.byteLength(userAgent)}\r\n` +
      "\r\n" +
      userAgent,
  );
};

const handleFileRequestRoute = (socket: net.Socket, path: string) => {
  const fileName = path.slice("/files/".length);

  const directoryIndex = args.indexOf("--directory");
  const directoryPath = directoryIndex !== -1 ? args[directoryIndex + 1] : undefined;

  if (fs.existsSync(`${directoryPath}/${fileName}`)) {
    const file = fs.readFileSync(`${directoryPath}/${fileName}`);
    const fileSize = file.length;

    socket.write(
      "HTTP/1.1 200 OK\r\n" + "Content-Type: application/octet-stream\r\n" + `Content-Length: ${fileSize}\r\n` + "\r\n",
    );
    socket.end(file);
  } else {
    handleNotFoundRoute(socket);
  }
};

const server = net.createServer((socket: net.Socket) => {
  socket.on("data", (data) => {
    // socket.write("HTTP/1.1 200 OK\r\n" + "Content-Type: text/plain\r\n" + "Content-Length: 5\r\n" + "\r\n" + "Hello");

    const request = data.toString();
    const requestLines = request.split("\r\n");

    const requestLine = requestLines[0];
    const path = requestLine.split(" ")[1];

    if (path === "/") {
      socket.write("HTTP/1.1 200 OK\r\n\r\n");
    } else if (path.startsWith("/echo/")) {
      handleEchoRoute(socket, path);
    } else if (path === "/user-agent") {
      handleUserAgentRoute(socket, requestLines);
    } else if (path.startsWith("/files/")) {
      handleFileRequestRoute(socket, path);
    } else {
      handleNotFoundRoute(socket);
    }
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });
});

server.listen(4221, "localhost");
