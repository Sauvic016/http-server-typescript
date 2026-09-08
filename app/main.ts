import * as net from "node:net";

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// TODO: Uncomment the code below to pass the first stage
const server = net.createServer((socket: net.Socket) => {
  socket.on("data", (data) => {
    // socket.write("HTTP/1.1 200 OK\r\n" + "Content-Type: text/plain\r\n" + "Content-Length: 5\r\n" + "\r\n" + "Hello");

    const request = data.toString();
    const requestLines = request.split("\r\n");

    const requestLine = requestLines[0];
    const path = requestLine.split(" ")[1];

    // if (path === "/") {
    //   socket.write("HTTP/1.1 200 OK\r\n\r\n");
    // } else {
    //   socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    // }
    // socket.end();
    //------- or better ------
    /* Because socket.end(data) means roughly:
    ---socket.write(data);
    ---socket.end();
    */
    // if (path === "/") {
    //   socket.end("HTTP/1.1 200 OK\r\n\r\n");
    // } else {
    //   socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    // }
    // -------------------------------------------------
    // if (path.startsWith("/echo/")) {
    //   // const text = path.split("/echo/")[1];
    //   const text = path.slice("/echo/".length);
    //   socket.end(
    //     "HTTP/1.1 200 OK\r\n" +
    //       "Content-Type: text/plain\r\n" +
    //       `Content-Length: ${Buffer.byteLength(text)}\r\n` +
    //       "\r\n" +
    //       `${text}`,
    //   );
    // } else {
    //   socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    // }

    if (path === "/user-agent") {
      // const userAgent = requestLines
      //   .filter((reqL) => reqL.startsWith("User-Agent")) this is wrong since the useragent is case insensitive
      //   .join("")
      //   .split(":")[1]
      //   .trim();

      const userAgentLine = requestLines.find((line) => line.toLowerCase().startsWith("user-agent:"));

      const userAgent = userAgentLine?.split(":")[1].trim() ?? "";

      socket.end(
        "HTTP/1.1 200 OK\r\n" +
          "Content-Type: text/plain\r\n" +
          `Content-Length: ${Buffer.byteLength(userAgent)}\r\n` +
          "\r\n" +
          userAgent,
      );
    } else {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
    }
  });

  socket.on("close", () => {
    console.log("Client disconnected");
    // socket.end(); not required here
  });
});

server.listen(4221, "localhost");
