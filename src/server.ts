import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { createServer as createViteServer } from "vite";
import { createCardResponse } from "../api/card";
import { createNowPlayingResponse } from "../api/now-playing";
import { createWeatherResponse } from "../api/weather";

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
  const pathname = new URL(request.url ?? "/", `http://${request.headers.host}`).pathname;

  if (pathname === "/api/now-playing") {
    await send(await createNowPlayingResponse(), response);
    return;
  }

  if (pathname === "/api/card" || pathname === "/now.svg") {
    await send(await createCardResponse(), response);
    return;
  }

  if (pathname === "/api/weather") {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
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
