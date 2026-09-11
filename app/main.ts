import { createServer } from "./CustomHttp";
import { handleRequest } from "./handler.ts";

const args = process.argv.slice(2);
const directoryIndex = args.indexOf("--directory");
const directoryPath = directoryIndex !== -1 ? args[directoryIndex + 1] : undefined;

const server = createServer((req, res) => {
  handleRequest(req, res, directoryPath);
});

server.listen(4221, "localhost");
