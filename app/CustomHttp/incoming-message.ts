import type { HttpRequest } from "./types.ts";

export class IncomingMessage {
  method: string;
  url: string;
  headers: HttpRequest["headers"];
  body: Buffer;
  requestLines: string[];

  constructor(request: HttpRequest) {
    this.method = request.method;
    this.url = request.path;
    this.headers = request.headers;
    // This demo buffers the full request before invoking the listener.
    this.body = request.body;
    this.requestLines = request.requestLines;
  }
}
