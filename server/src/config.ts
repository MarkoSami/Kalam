import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

// Resolve .env relative to server root (one level up from src/)
dotenvConfig({ path: resolve(__dirname, "..", ".env") });

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || "",
    agentId: process.env.ELEVENLABS_AGENT_ID || "",
  },
};
