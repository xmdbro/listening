import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cardHandler from "../api/card.js";
import nowPlayingHandler from "../api/now-playing.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT) || 3000;

const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"]
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === "/api/now-playing") {
    return nowPlayingHandler(request, response);
  }

  if (pathname === "/api/card" || pathname === "/now.svg") {
    return cardHandler(request, response);
  }

  const filename = publicFiles.get(pathname);
  const path = filename ? join(root, filename) : "";

  if (!path || !existsSync(path)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }

  response.writeHead(200, { "Content-Type": contentTypes[extname(path)] });
  createReadStream(path).pipe(response);
});

server.listen(port, () => {
  console.log(`Listening is running at http://localhost:${port}`);
});

