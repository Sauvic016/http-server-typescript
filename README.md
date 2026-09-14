# Building an HTTP server from TCP in TypeScript

[![progress-banner](assests/completed.gif)](https://app.codecrafters.io/users/codecrafters-bot?r=2qF)

This repository follows our implementation of the CodeCrafters “Build Your Own HTTP Server” challenge. We began with a TCP listener that returned a fixed response. We then added routing, headers, files, compression, and connection management, and refactored the implementation into a small HTTP layer with a familiar `createServer((req, res) => ...)` interface.

The server uses `node:net` for TCP and implements HTTP parsing and response formatting itself. It runs with Bun; it does not use Express or Node’s built-in HTTP server.

This guide follows the actual Git history. The milestones below describe implemented behavior, rather than claiming that every official challenge test has been submitted and passed.

## Run it locally

Use Bun 1.3, matching `codecrafters.yml`. From this directory:

```bash
bun install
./your_program.sh
```

The server listens on `localhost:4221`. To enable file routes, start it with an existing directory:

```bash
mkdir -p /tmp/http-server-demo
./your_program.sh --directory /tmp/http-server-demo
```

Run curl commands in another terminal. Stop the server with Ctrl+C before restarting it with different arguments.

```bash
bun run typecheck
```

This checks TypeScript types. If the CodeCrafters CLI is installed and configured, `codecrafters submit` runs the challenge’s remote checks.

## The journey through the stages

### 1. Accept a TCP connection

**History:** `c006a2f` → `e260dba`

We started with the generated TypeScript project and enabled a `net.createServer` listener on port 4221. At this point, the important achievement was accepting a connection: HTTP behavior would be built on top of that transport.

A TCP connection gives us a socket. A socket can receive bytes and send bytes back. TCP does not parse URLs, headers, or HTTP messages for us.

### 2. Return a fixed HTTP response

**History:** `b2c7c83` — `stage-2`

The first response was intentionally small. The essential code looked like this:

```ts
socket.on("data", () => {
  socket.write("HTTP/1.1 200 OK\r\n\r\n");
  socket.end();
});
```

This introduced the status line and the blank line terminating the headers. Every request received the same response, and the socket closed afterward. There was no request routing or connection reuse yet.

### 3. Read the request target and choose a status

**History:** `9bbf507` — conditional responses

We converted incoming bytes to text, split the request into lines, and extracted the path from its first line:

```text
GET / HTTP/1.1
│   │ └─ protocol version
│   └─── request target
└─────── method
```

The server could now distinguish `/` from an unknown path and choose between `200 OK` and `404 Not Found`. This was the first routing decision.

The early approach treated a received chunk as a request. Later stages had to remove that assumption because TCP can split or combine HTTP messages.

### 4. Return a response body

**History:** `4b00807` — respond with body

We added `/echo/{text}`. Requesting `/echo/apple` returns `apple`, with `Content-Type: text/plain` and a body length.

```text
HTTP/1.1 200 OK\r\n
Content-Type: text/plain\r\n
Content-Length: 5\r\n
\r\n
apple
```

The escapes above show the actual line separators; they are not extra printed text. `Content-Length` counts bytes, not JavaScript string characters. That distinction becomes essential for non-ASCII text, file bytes, and compressed bodies.

### 5. Read request headers

**History:** `e657c6c` — user-agent endpoint

We added `/user-agent`, returning the value supplied by the client. Header-name lookup is case-insensitive. The current implementation also preserves colons inside the value by joining everything after the first colon.

```bash
curl -i http://localhost:4221/user-agent \
  -H "User-Agent: orange/mango-grape"
```

Expected body: `orange/mango-grape`.

### 6. Handle multiple clients

**History:** `056f2bb` — concurrency checkpoint

The event-based TCP server already accepted multiple connections. This checkpoint did not require an application-code change: each accepted socket had its own callbacks.

Multiple connections can remain open at once. JavaScript callbacks still execute one at a time on the event loop. A client waiting to send more bytes does not occupy a thread that prevents another client from being served.

The current implementation strengthens this separation by keeping a receive buffer inside each connection callback. Client A’s unfinished request cannot become part of client B’s request.

### 7. Serve files

**History:** `976e19e` — file request handling

We added `--directory` and `GET /files/{filename}`. The handler reads a file and returns its bytes with `Content-Type: application/octet-stream`.

Missing files return `404`. A missing directory configuration or other read failure returns `500`. Working with files made it necessary to preserve binary data instead of treating every body as text.

### 8. Accept POST bodies and wait for complete requests

**History:** `c7a5128` — POST file endpoint

`POST /files/{filename}` writes the request body to a file and returns `201 Created`. Supporting request bodies also introduced a more reliable receive path:

1. Append incoming chunks to a connection buffer.
2. Wait for `\r\n\r\n`, which marks the end of the headers.
3. Read and validate `Content-Length`.
4. Wait until that many body bytes have arrived.
5. Pass the complete body to the route handler.

This solved a fundamental TCP issue: **one `data` event is not necessarily one HTTP request**. A body may arrive in several pieces.

At this point, the server still handled only one request per connection, using a `handled` flag. Persistent connections came later.

### 9. Recognize compression requests

**History:** `9341d94` — compression headers

We introduced `getClientEncoding` in `utils.ts` to inspect `Accept-Encoding`, including comma-separated lists, and recognize `gzip`.

This intermediate commit added the response header before actual compression was implemented. It was a development step, not the finished gzip feature: advertising gzip requires sending gzip bytes.

### 10. Separate HTTP mechanics from route behavior

**History:** `9bb3ce1` — refactor to a `node:http`-style interface

As `main.ts` grew, parsing, file operations, routing, and response formatting became harder to follow in one place. We extracted a custom HTTP layer:

```ts
const server = createServer((req, res) => {
  handleRequest(req, res, directoryPath);
});

server.listen(4221, "localhost");
```

The callback receives a parsed request and a response object. Routes no longer assemble raw HTTP strings or directly manage socket closure. This resembles part of Node’s HTTP API, but is our own smaller implementation.

### 11. Send actual gzip-compressed bytes

**History:** `6d29e24` — gzip compression

The echo handler now calls `gzipSync(text)` when gzip is accepted. It sends the resulting bytes with `Content-Encoding: gzip`. The shared serializer computes `Content-Length` from the compressed body’s byte length.

```bash
curl -i --compressed http://localhost:4221/echo/apple \
  -H "Accept-Encoding: gzip"
```

Curl decodes the compressed response for display, so the visible body is still `apple`. Without an accepted gzip token, the server sends plain text.

### 12. Reuse connections for multiple requests

**History:** `04862c2` — persistent HTTP connections

We replaced the one-request `handled` approach with a loop. The parser reports `bytesConsumed`; the server removes those bytes and keeps any remainder for the next request.

The key receive logic is:

```ts
this.on("connection", (socket: Socket) => {
  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);

    while (buffer.length > 0) {
      const result = parseRequest(buffer);
      if (result.kind === "incomplete") break;
      // Invalid input receives a 400 response and closes the connection.
      // Complete input consumes only the bytes belonging to that request.
      // A fresh request/response pair is dispatched for each complete request.
    }
  });
});
```

This excerpt omits the dispatch and error branches; see [server.ts](app/CustomHttp/server.ts) for the complete implementation.

Normal responses now use `socket.write(...)`. Each response includes `Content-Length`, including zero-length bodies, so the client can determine where it ends without waiting for the TCP connection to close.

This supports both sequential reuse and parsing several complete requests received in the same chunk. Each connection retains its own buffer throughout its lifetime.

### 13. Close explicitly when requested

**History:** also implemented in `04862c2`

The server checks the request’s `Connection` header for a case-insensitive `close` token, including within a comma-separated list:

```ts
const closeConnection = result.request.headers["connection"]
  ?.split(",")
  .some((value) => value.trim().toLowerCase() === "close") ?? false;
```

`ServerResponse` adds `Connection: close` when required, then chooses how to send the response:

```ts
if (this.#closeConnection) {
  this.#socket.end(serializedResponse);
} else {
  this.#socket.write(serializedResponse);
}
```

`socket.end(data)` sends the final response and ends the writable side of the connection. Our response object’s `res.end()` means “finish this HTTP response”; it only ends the socket when the closure flag is set.

## How the final implementation fits together

```text
Client TCP bytes
  → server.ts: collect bytes in this connection’s buffer
  → codec.ts: parse one complete HTTP message
  → IncomingMessage + ServerResponse: create req/res objects
  → "request" event: call the registered listener
  → handler.ts: choose route, status, headers, and body
  → ServerResponse.end(): ask codec.ts to serialize the response
  → socket.write() or socket.end(): send bytes to this client
```

| File | Responsibility |
| --- | --- |
| [app/main.ts](app/main.ts) | Read command-line arguments, register the handler, and listen on port 4221. |
| [app/CustomHttp/server.ts](app/CustomHttp/server.ts) | Own connection buffers, parse repeatedly, dispatch requests, and decide whether to close. |
| [app/CustomHttp/codec.ts](app/CustomHttp/codec.ts) | Parse request bytes and serialize response bytes with the correct body length. |
| [app/CustomHttp/incoming-message.ts](app/CustomHttp/incoming-message.ts) | Expose method, URL, headers, body, and original request lines. |
| [app/CustomHttp/server-response.ts](app/CustomHttp/server-response.ts) | Collect response metadata and write the response to its socket. |
| [app/CustomHttp/types.ts](app/CustomHttp/types.ts) | Define internal request and response types. |
| [app/CustomHttp/index.ts](app/CustomHttp/index.ts) | Export the public custom HTTP interface. |
| [app/handler.ts](app/handler.ts) | Implement routing, file operations, and echo compression. |
| [app/utils.ts](app/utils.ts) | Recognize accepted gzip encoding. |

The HTTP layer owns connection state. Each complete request gets new `req` and `res` objects. The application handler assumes parsing has finished and receives the entire body as a `Buffer`.

## Understanding the buffer with one POST request

Consider this command:

```bash
curl -i http://localhost:4221/files/example.txt --data-binary 'hello'
```

Its request contains headers and a body, conceptually:

```text
POST /files/example.txt HTTP/1.1\r\n
Host: localhost:4221\r\n
Content-Length: 5\r\n
...other curl headers...\r\n
\r\n
hello
```

A `Buffer` holds the raw bytes. The server only converts the header portion to text; the body stays binary. If the first chunk ends in `he`, parsing returns `incomplete`. After `llo` arrives, the body has all five bytes and the request can be dispatched.

The parser computes:

```ts
const bodyStart = headerEnd + 4; // Skip the four bytes in \r\n\r\n
const bytesConsumed = bodyStart + contentLength;
```

The connection loop then preserves whatever follows:

```ts
buffer = buffer.subarray(result.bytesConsumed);
```

If those remaining bytes contain the next request, the loop processes it. If they contain only part of one, it waits for more data. That is why the buffer belongs to the connection rather than to an individual request.

## Try the completed behavior

These examples assume the server is running with the demo directory configured above.

| Request | Expected behavior |
| --- | --- |
| `GET /` | `200`, empty body. |
| `GET /echo/apple` | `200`, text body `apple`; gzip when accepted. |
| `GET /user-agent` | `200`, supplied user-agent value, or an empty body if absent. |
| `GET /files/example.txt` | `200` with file bytes, or `404` when missing. |
| `POST /files/example.txt` | Write body to the file; `201`, empty body. |
| Unsupported method on `/files/...` | `405` with `Allow: GET, POST`. |
| Unknown path | `404`, empty body. |

The non-file routes currently match by path without enforcing GET-only behavior.

```bash
# Basic responses
curl -i http://localhost:4221/
curl -i http://localhost:4221/echo/apple
curl -i http://localhost:4221/unknown

# Write and read a file
curl -i http://localhost:4221/files/example.txt --data-binary 'hello'
curl -i http://localhost:4221/files/example.txt

# Two requests on one persistent connection
curl --http1.1 -v http://localhost:4221/user-agent \
  -H "User-Agent: orange/mango-grape" \
  --next http://localhost:4221/echo/apple

# Reuse the connection, then explicitly close it
curl --http1.1 -v http://localhost:4221/echo/orange \
  --next http://localhost:4221/ -H "Connection: close"
```

For persistence, look for curl’s `Re-using existing connection` message. For explicit closure, look for `Connection: close` in the second response and connection shutdown afterward. The exact diagnostic wording depends on curl’s version.

A `--next` sequence demonstrates reuse of one connection. To exercise separate connections, launch separate curl processes concurrently:

```bash
curl --http1.1 -v http://localhost:4221/echo/client-a-1 \
  --next http://localhost:4221/echo/client-a-2 &
curl --http1.1 -v http://localhost:4221/echo/client-b-1 \
  --next http://localhost:4221/echo/client-b-2 &
wait
```

These short requests provide a smoke check; a controlled socket test is stronger evidence of overlapping connections and independent buffering.

## What has been verified

During development, direct TCP checks against the server and handler verified:

- Two simultaneously open connections returned 24 correct responses without reconnecting.
- Connection B completed two requests while connection A held an incomplete request, demonstrating independent receive state.
- A normal `/echo/orange` response kept the connection usable; a subsequent `/` request with `Connection: close` returned that header and the complete response before TCP EOF.

These were ad hoc checks under Node because Bun was unavailable in that environment. They do not verify `./your_program.sh` under Bun, and there is no committed automated test suite for them. Run the launcher and the challenge checks in the intended runtime before treating this as a complete challenge submission result.

## Current boundaries and further work

This is an educational HTTP/1.1 implementation. The current solution covers the behaviors above, with several deliberate or remaining simplifications:

- Request bodies use `Content-Length` framing. Chunked transfer encoding, streaming bodies, and full HTTP validation are not implemented.
- `readFileSync`, `writeFileSync`, and `gzipSync` block the event loop while running, delaying other clients. Async operations would improve responsiveness, but would also require preserving response order for pipelined requests on one connection.
- Incoming data is fully buffered, without header/body size limits or idle timeouts. Response writing does not handle backpressure explicitly.
- Socket error handling and a persistent closing-state guard need further work for clients that disconnect unexpectedly or send more data after a close request.
- POST rejects simple invalid filenames, but GET paths are joined directly to the configured directory. File access needs consistent path containment and symlink handling before use with untrusted clients.
- Encoding negotiation recognizes a literal `gzip` token; it does not implement quality values such as `gzip;q=0.5` or wildcard negotiation.
- The custom request/response classes provide only a small part of Node’s HTTP interface. They are not drop-in replacements or streaming objects.

A useful reading order is `main.ts` → `server.ts` → `codec.ts` → `incoming-message.ts` → `handler.ts` → `server-response.ts`. Follow one `/echo/apple` request through those files, then repeat with a POST body and a `Connection: close` request.
