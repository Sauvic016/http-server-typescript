import { Server, type Socket } from "node:net";
import { parseRequest } from "./codec.ts";
import { IncomingMessage } from "./incoming-message.ts";
import { ServerResponse } from "./server-response.ts";

export type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;

export class CustomHttpServer extends Server {
  constructor(listener?: RequestListener) {
    super();

    if (listener) this.on("request", listener);

    this.on("connection", (socket: Socket) => {
      let buffer = Buffer.alloc(0);

      socket.on("data", (chunk) => {
        buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

        while (buffer.length > 0) {
          const result = parseRequest(buffer);

          if (result.kind === "incomplete") break;

          if (result.kind !== "complete") {
            new ServerResponse(socket, true).writeHead(400).end();
            return;
          }

          buffer = buffer.subarray(result.bytesConsumed);

          const closeConnection = result.request.headers["connection"]
            ?.split(",")
            .some((value) => value.trim().toLowerCase() === "close") ?? false;
          const res = new ServerResponse(socket, closeConnection);

          this.emit("request", new IncomingMessage(result.request), res);

          if (closeConnection) {
            buffer = Buffer.alloc(0);
            return;
          }
        }
      });
      socket.on("close", () => console.log("Client disconnected"));
    });
  }
}

export const createServer = (listener?: RequestListener): CustomHttpServer => new CustomHttpServer(listener);
