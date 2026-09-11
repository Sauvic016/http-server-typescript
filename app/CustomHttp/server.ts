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
      let handled = false;
      socket.on("data", (chunk) => {
        if (handled) return;
        buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
        const result = parseRequest(buffer);
        if (result.kind === "incomplete") return;
        handled = true;
        buffer = Buffer.alloc(0);
        const res = new ServerResponse(socket);
        if (result.kind !== "complete") {
          res.writeHead(400).end();
          return;
        }
        this.emit("request", new IncomingMessage(result.request), res);
      });
      socket.on("close", () => console.log("Client disconnected"));
    });
  }
}

export const createServer = (listener?: RequestListener): CustomHttpServer => new CustomHttpServer(listener);
