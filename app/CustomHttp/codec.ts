import type { HttpRequest, HttpResponse } from "./types.ts";

const HEADER_SEPARATOR = "\r\n\r\n";

type ParseResult =
  | { kind: "incomplete" | "invalid" }
  | { kind: "complete"; request: HttpRequest; bytesConsumed: number };

const parseHeaders = (lines: string[]): HttpRequest["headers"] => {
  const headers: HttpRequest["headers"] = Object.create(null);
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const name = line.slice(0, colon).toLowerCase();
    // Keep the first value, matching the previous header lookups.
    if (!(name in headers)) headers[name] = line.slice(colon + 1).trim();
  }
  return headers;
};

const parseContentLength = (headers: HttpRequest["headers"]): number | undefined => {
  const lengthValue = headers["content-length"] ?? "0";
  const contentLength = Number(lengthValue);
  return /^\d+$/.test(lengthValue) && Number.isSafeInteger(contentLength) ? contentLength : undefined;
};


export const parseRequest = (buffer: Buffer): ParseResult => {
  const headerEnd = buffer.indexOf(HEADER_SEPARATOR);

  if (headerEnd === -1) return { kind: "incomplete" };

  const requestLines = buffer.subarray(0, headerEnd).toString().split("\r\n");
  const [requestLine, ...lines] = requestLines;

  const [method, path] = requestLine.split(" ");
  const headers = parseHeaders(lines);
  const contentLength = parseContentLength(headers);

  if (!path || contentLength === undefined) return { kind: "invalid" };

  const bodyStart = headerEnd + HEADER_SEPARATOR.length;

  if (buffer.length - bodyStart < contentLength) return { kind: "incomplete" };

  return {
    kind: "complete",
    request: { method, path, headers, requestLines, body: buffer.subarray(bodyStart, bodyStart + contentLength) },
    bytesConsumed: bodyStart + contentLength,
  };
};

const statusText = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  404: "Not Found",
  405: "Method Not Allowed",
  500: "Internal Server Error",
};

/** Keeps binary bodies intact and calculates length from the bytes sent. */
export const serializeResponse = (response: HttpResponse): Buffer => {
  const headers = { ...response.headers };
  headers["Content-Length"] = String(response.body?.byteLength ?? 0);

  const head =
    `HTTP/1.1 ${response.status} ${statusText[response.status]}\r\n` +
    Object.entries(headers)
      .map(([name, value]) => `${name}: ${value}\r\n`)
      .join("") +
    "\r\n";
  return Buffer.concat([Buffer.from(head), response.body ?? new Uint8Array()]);
};
