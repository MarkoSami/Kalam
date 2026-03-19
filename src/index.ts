import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config";

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors);
  await app.register(websocket);

  app.get("/health", async () => {
    return { status: "ok" };
  });

  app.get("/ws", { websocket: true }, (socket) => {
    app.log.info("WebSocket client connected");

    socket.on("message", (message: Buffer) => {
      app.log.info(`Received: ${message.toString()}`);
    });

    socket.on("close", () => {
      app.log.info("WebSocket client disconnected");
    });
  });

  await app.listen({ port: config.port, host: config.host });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
