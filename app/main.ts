import * as net from "node:net";
import fs from "node:fs";
import { getClientEncoding } from "./utils.ts";

const args = process.argv.slice(2);
const directoryIndex = args.indexOf("--directory");
const directoryPath = directoryIndex !== -1 ? args[directoryIndex + 1] : undefined;

const handleNotFoundRoute = (socket: net.Socket) => {
  socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
};

const handleEchoRoute = (socket: net.Socket, path: string, clientEncoding?: string) => {
  const text = path.slice("/echo/".length);

  socket.end(
    "HTTP/1.1 200 OK\r\n" +
      "Content-Type: text/plain\r\n" +
      (clientEncoding === "gzip" ? "Content-Encoding: gzip\r\n" : "") +
      `Content-Length: ${Buffer.byteLength(text)}\r\n` +
      "\r\n" +
      text,
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

  if (!directoryPath) {
    socket.end("HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n");
    return;
  }

  let file: Buffer;
  try {
    file = fs.readFileSync(`${directoryPath}/${fileName}`);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT" || code === "ENOTDIR") {
      handleNotFoundRoute(socket);
    } else {
      socket.end("HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n");
    }
    return;
  }

  socket.write(
    "HTTP/1.1 200 OK\r\n" +
      "Content-Type: application/octet-stream\r\n" +
      `Content-Length: ${file.length}\r\n` +
      "\r\n",
  );
  socket.end(file);
};

const handleFilePostRoute = (socket: net.Socket, path: string, body: Buffer) => {
  const fileName = path.slice("/files/".length);

  if (!directoryPath) {
    socket.end("HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n");
    return;
  }

  if (!fileName || fileName === "." || fileName === ".." || /[/\\]/.test(fileName)) {
    socket.end("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n");
    return;
  }

  try {
    fs.writeFileSync(`${directoryPath}/${fileName}`, body);
    socket.end("HTTP/1.1 201 Created\r\nContent-Length: 0\r\n\r\n");
  } catch (error) {
    console.error("Failed to write file:", error);
    socket.end("HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\n\r\n");
  }
};

const server = net.createServer((socket: net.Socket) => {
  let requestBuffer = Buffer.alloc(0);
  let handled = false;

  socket.on("data", (data) => {
    if (handled) return;
    const chunk = typeof data === "string" ? Buffer.from(data) : data;
    requestBuffer = Buffer.concat([requestBuffer, chunk]);
    const headerEnd = requestBuffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const requestLines = requestBuffer.subarray(0, headerEnd).toString().split("\r\n");

    const [method, path] = requestLines[0].split(" ");

    const lengthLine = requestLines.slice(1).find((line) => line.toLowerCase().startsWith("content-length:"));

    const lengthValue = lengthLine?.slice(lengthLine.indexOf(":") + 1).trim() ?? "0";
    const contentLength = Number(lengthValue);

    if (!path || !/^\d+$/.test(lengthValue) || !Number.isSafeInteger(contentLength)) {
      handled = true;
      socket.end("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n");
      return;
    }

    const bodyStart = headerEnd + 4;
    if (requestBuffer.length - bodyStart < contentLength) return;
    const body = requestBuffer.subarray(bodyStart, bodyStart + contentLength);
    handled = true;

    if (path === "/") {
      socket.end("HTTP/1.1 200 OK\r\n\r\n");
    } else if (path.startsWith("/echo/")) {
      handleEchoRoute(socket, path, getClientEncoding(requestLines));
    } else if (path === "/user-agent") {
      handleUserAgentRoute(socket, requestLines);
    } else if (path.startsWith("/files/")) {
      if (method === "POST") {
        handleFilePostRoute(socket, path, body);
      } else if (method === "GET") {
        handleFileRequestRoute(socket, path);
      } else {
        socket.end("HTTP/1.1 405 Method Not Allowed\r\nAllow: GET, POST\r\nContent-Length: 0\r\n\r\n");
      }
    } else {
      handleNotFoundRoute(socket);
    }
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });
});

server.listen(4221, "localhost");
