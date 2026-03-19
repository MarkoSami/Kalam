import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import type { WebSocket } from "ws";
import { resolve } from "path";
import { existsSync } from "fs";
import { config } from "./config";
import {
  joinRoom,
  leaveRoom,
  getPeerSocket,
  getPeerId,
  getRoomId,
  broadcastToRoom,
} from "./rooms";
import { registerElevenLabsRoutes } from "./routes/elevenlabs";

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors);
  await app.register(websocket);

  registerElevenLabsRoutes(app);

  // Serve built client files in production
  const clientDist = resolve(__dirname, "..", "..", "client", "dist");
  app.log.info(`Client dist path: ${clientDist}`);
  app.log.info(`Client dist exists: ${existsSync(clientDist)}`);
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, {
      root: clientDist,
    });
    app.log.info("Static file serving enabled");
  } else {
    app.log.warn("Client dist not found — static files not served");
  }

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/ws", { websocket: true }, (socket: WebSocket) => {
    socket.on("message", (raw: Buffer) => {
      let msg: { type: string; [key: string]: unknown };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        return;
      }

      switch (msg.type) {
        case "join":
          handleJoin(
            socket,
            msg as { type: string; roomId: string; displayName: string }
          );
          break;
        case "leave":
          handleLeave(socket);
          break;
        case "offer":
        case "answer":
        case "ice-candidate":
          relay(
            socket,
            msg as {
              type: string;
              targetPeerId: string;
              [key: string]: unknown;
            }
          );
          break;
        case "ai-started":
        case "ai-stopped":
          broadcastFromPeer(socket, msg);
          break;
        default:
          socket.send(
            JSON.stringify({
              type: "error",
              message: `Unknown type: ${msg.type}`,
            })
          );
      }
    });

    socket.on("close", () => handleLeave(socket));
  });

  // SPA catch-all: serve index.html for any unmatched route
  if (existsSync(clientDist)) {
    app.setNotFoundHandler(async (_request, reply) => {
      return reply.sendFile("index.html", clientDist);
    });
  }

  await app.listen({ port: config.port, host: config.host });
}

function handleJoin(
  socket: WebSocket,
  msg: { roomId: string; displayName: string }
) {
  const { peerId, existingPeers } = joinRoom(
    msg.roomId,
    msg.displayName,
    socket
  );

  socket.send(
    JSON.stringify({
      type: "joined",
      peerId,
      peers: existingPeers,
    })
  );

  broadcastToRoom(
    msg.roomId,
    {
      type: "peer-joined",
      peerId,
      displayName: msg.displayName,
    },
    peerId
  );

  app.log.info(`Peer ${peerId} joined room ${msg.roomId}`);
}

function handleLeave(socket: WebSocket) {
  const result = leaveRoom(socket);
  if (!result) return;

  broadcastToRoom(result.roomId, {
    type: "peer-left",
    peerId: result.peerId,
  });

  app.log.info(`Peer ${result.peerId} left room ${result.roomId}`);
}

function relay(
  socket: WebSocket,
  msg: { type: string; targetPeerId: string; [key: string]: unknown }
) {
  const fromPeerId = getPeerId(socket);
  if (!fromPeerId) return;

  const targetSocket = getPeerSocket(msg.targetPeerId);
  if (!targetSocket) return;

  const { targetPeerId, ...rest } = msg;
  targetSocket.send(JSON.stringify({ ...rest, fromPeerId }));
}

function broadcastFromPeer(
  socket: WebSocket,
  msg: { type: string; [key: string]: unknown }
) {
  const fromPeerId = getPeerId(socket);
  if (!fromPeerId) return;

  const roomId = getRoomId(fromPeerId);
  if (!roomId) return;

  broadcastToRoom(roomId, { ...msg, peerId: fromPeerId }, fromPeerId);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
