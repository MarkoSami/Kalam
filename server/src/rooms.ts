import { randomUUID } from "crypto";
import type { WebSocket } from "ws";

export interface Peer {
  peerId: string;
  displayName: string;
  socket: WebSocket;
}

const rooms = new Map<string, Map<string, Peer>>();
const peerToRoom = new Map<string, string>();
const socketToPeer = new Map<WebSocket, string>();

export function joinRoom(
  roomId: string,
  displayName: string,
  socket: WebSocket
) {
  const peerId = randomUUID();

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  const room = rooms.get(roomId)!;
  const existingPeers = Array.from(room.values()).map((p) => ({
    peerId: p.peerId,
    displayName: p.displayName,
  }));

  room.set(peerId, { peerId, displayName, socket });
  peerToRoom.set(peerId, roomId);
  socketToPeer.set(socket, peerId);

  return { peerId, existingPeers };
}

export function leaveRoom(socket: WebSocket) {
  const peerId = socketToPeer.get(socket);
  if (!peerId) return null;

  const roomId = peerToRoom.get(peerId);
  if (!roomId) return null;

  const room = rooms.get(roomId);
  if (room) {
    room.delete(peerId);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }

  peerToRoom.delete(peerId);
  socketToPeer.delete(socket);

  return { peerId, roomId };
}

export function getPeerSocket(peerId: string): WebSocket | undefined {
  for (const room of rooms.values()) {
    const peer = room.get(peerId);
    if (peer) return peer.socket;
  }
  return undefined;
}

export function broadcastToRoom(
  roomId: string,
  message: object,
  excludePeerId?: string
) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(message);
  for (const peer of room.values()) {
    if (peer.peerId !== excludePeerId) {
      peer.socket.send(data);
    }
  }
}

export function getPeerId(socket: WebSocket): string | undefined {
  return socketToPeer.get(socket);
}

export function getRoomId(peerId: string): string | undefined {
  return peerToRoom.get(peerId);
}
