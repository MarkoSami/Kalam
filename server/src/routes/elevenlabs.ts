import type { FastifyInstance } from "fastify";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config } from "../config";

export function registerElevenLabsRoutes(app: FastifyInstance) {
  const client = new ElevenLabsClient({ apiKey: config.elevenlabs.apiKey });

  app.post("/api/elevenlabs/signed-url", async (_request, reply) => {
    if (!config.elevenlabs.apiKey || !config.elevenlabs.agentId) {
      return reply.status(500).send({ error: "ElevenLabs not configured" });
    }

    const response = await client.conversationalAi.conversations.getSignedUrl({
      agentId: config.elevenlabs.agentId,
    });

    return { signedUrl: response.signedUrl };
  });
}
