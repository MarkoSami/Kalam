export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "0.0.0.0",
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || "",
  },
};
