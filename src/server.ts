import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { createServer as createViteServer } from "vite";
import { createCardResponse } from "../api/card.js";
import { createNowPlayingResponse } from "../api/now-playing.js";
import { createWeatherResponse } from "../api/weather.js";

const port = Number(process.env.PORT) || 3000;
const vite = await createViteServer({
  appType: "spa",
  server: { middlewareMode: true }
});

async function send(response: Response, destination: ServerResponse): Promise<void> {
  destination.statusCode = response.status;
  response.headers.forEach((value, name) => destination.setHeader(name, value));
  destination.end(Buffer.from(await response.arrayBuffer()));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (pathname === "/api/now-playing") {
    await send(await createNowPlayingResponse(), response);
    return;
  }

  if (pathname === "/api/card" || pathname === "/now.svg") {
    await send(await createCardResponse(new Request(url)), response);
    return;
  }

  if (pathname === "/api/weather") {
    await send(await createWeatherResponse(new Request(url)), response);
    return;
  }

  vite.middlewares(request, response, () => {
    response.statusCode = 404;
    response.end("Not found");
  });
});

server.listen(port, () => {
  console.log(`Listening is running at http://localhost:${port}`);
});
