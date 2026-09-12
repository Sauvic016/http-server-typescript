import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { getClientEncoding } from "./utils.ts";
import type { IncomingMessage, ServerResponse } from "./CustomHttp";

const handleNotFoundRoute = (res: ServerResponse) => {
  res.writeHead(404).end();
};

const handleEchoRoute = (res: ServerResponse, path: string, clientEncoding?: string) => {
  const text = path.slice("/echo/".length);

  res.setHeader("Content-Type", "text/plain");

  if (clientEncoding === "gzip") {
    res.setHeader("Content-Encoding", "gzip");
    res.end(gzipSync(text));
    return;
  }
  res.end(text);
};

const handleUserAgentRoute = (res: ServerResponse, requestLines: string[]) => {
  const userAgentLine = requestLines.find((line) => line.toLowerCase().startsWith("user-agent:"));
  const userAgent = userAgentLine?.split(":").slice(1).join(":").trim() ?? "";
  res.setHeader("Content-Type", "text/plain").end(userAgent);
};

const handleFileRequestRoute = (res: ServerResponse, path: string, directoryPath?: string) => {
  const fileName = path.slice("/files/".length);

  if (!directoryPath) {
    res.writeHead(500).end();
    return;
  }
  let file: Buffer;
  try {
    file = fs.readFileSync(`${directoryPath}/${fileName}`);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;

    if (code === "ENOENT" || code === "ENOTDIR") {
      handleNotFoundRoute(res);
    } else {
      res.writeHead(500).end();
    }
    return;
  }
  res.setHeader("Content-Type", "application/octet-stream").end(file);
};

const handleFilePostRoute = (res: ServerResponse, path: string, body: Buffer, directoryPath?: string) => {
  const fileName = path.slice("/files/".length);

  if (!directoryPath) {
    res.writeHead(500).end();
    return;
  }
  if (!fileName || fileName === "." || fileName === ".." || /[/\\]/.test(fileName)) {
    res.writeHead(400).end();
    return;
  }
  try {
    fs.writeFileSync(`${directoryPath}/${fileName}`, body);
    res.writeHead(201).end();
  } catch (error) {
    console.error("Failed to write file:", error);
    res.writeHead(500).end();
  }
};

export function handleRequest(req: IncomingMessage, res: ServerResponse, directoryPath?: string): void {
  const path = req.url;

  if (path === "/") {
    res.end();
  } else if (path.startsWith("/echo/")) {
    handleEchoRoute(res, path, getClientEncoding(req.requestLines));
  } else if (path === "/user-agent") {
    handleUserAgentRoute(res, req.requestLines);
  } else if (path.startsWith("/files/")) {
    if (req.method === "POST") {
      handleFilePostRoute(res, path, req.body, directoryPath);
    } else if (req.method === "GET") {
      handleFileRequestRoute(res, path, directoryPath);
    } else {
      res.writeHead(405, { Allow: "GET, POST" }).end();
    }
  } else {
    handleNotFoundRoute(res);
  }
}
