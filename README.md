
This is a starting point for TypeScript solutions to the
["Build Your Own HTTP server" Challenge](https://app.codecrafters.io/courses/http-server/overview).

[HTTP](https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol) is the
protocol that powers the web. In this challenge, you'll build a HTTP/1.1 server
that is capable of serving multiple clients.

Along the way you'll learn about TCP servers,
[HTTP request syntax](https://www.w3.org/Protocols/rfc2616/rfc2616-sec5.html),
and more.

**Note**: If you're viewing this repo on GitHub, head over to
[codecrafters.io](https://codecrafters.io) to try the challenge.

# Passing the first stage

The entry point for your HTTP server implementation is in `app/main.ts`. Study
and uncomment the relevant code, and then run the command below to execute the
tests on our servers:

```sh
codecrafters submit
```

Time to move on to the next stage!

# Stage 2 & beyond

Note: This section is for stages 2 and beyond.

1. Ensure you have `bun (1.3)` installed locally
1. Run `./your_program.sh` to run your program, which is implemented in
   `app/main.ts`.
1. Run `codecrafters submit` to submit your solution to CodeCrafters. Test
   output will be streamed to your terminal.

{{#lang_is_javascript}} In most languages, you'd need to either use threads or implement an Event Loop to do this. In JavaScript however, since the concurrency model itself is based on an event loop, most standard library functions are designed to support this kind of concurrent behaviour out of the box. It is very likely that the code you had for the previous stage will pass this stage without any changes! {{/lang_is_javascript}}

{{#lang_is_typescript}} In most languages, you'd need to either use threads or implement an Event Loop to do this. In TypeScript however, since the concurrency model itself is based on an event loop, most standard library functions are designed to support this kind of concurrent behaviour out of the box. It is very likely that the code you had for the previous stage will pass this stage without any changes! {{/lang_is_typescript}}