import type { Socket } from "node:net";
import type { HttpResponse } from "./types.ts";
import { serializeResponse } from "./codec.ts";

// A small facade over the response construction previously inside each route.
export class ServerResponse {
  statusCode: HttpResponse["status"] = 200;
  #socket: Socket;
  #headers: Record<string, string> = {};
  #closeConnection: boolean;

  constructor(socket: Socket, closeConnection = false) {
    this.#socket = socket;
    this.#closeConnection = closeConnection;

    if (closeConnection) {
      this.setHeader("Connection", "close");
    }
  }

  setHeader(name: string, value: string | number): this {
    this.#headers[name] = String(value);
    return this;
  }

  writeHead(statusCode: HttpResponse["status"], headers: Record<string, string | number> = {}): this {
    this.statusCode = statusCode;

    for (const [name, value] of Object.entries(headers)) {
      this.setHeader(name, value);
    }
    return this;
  }

  end(data?: string | Uint8Array): this {
    const body = data === undefined ? undefined : Buffer.from(data);

    const serializedResponse = serializeResponse({
      status: this.statusCode,
      headers: this.#headers,
      body,
    });

    if (this.#closeConnection) {
      this.#socket.end(serializedResponse);
    } else {
      this.#socket.write(serializedResponse);
    }

    return this;
  }
}
