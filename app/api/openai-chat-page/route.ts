import type { NextApiRequest, NextApiResponse } from "next";
import { Configuration, OpenAIApi } from "openai";

// Initialize OpenAI client
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Handler for /api/openai-chat
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'message' field" });
  }

  try {
    // 1) Generate chat completion
    const chatCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: message },
      ],
    });
    const reply = chatCompletion.data.choices[0].message?.content?.trim();
    if (!reply) {
      throw new Error("No reply from OpenAI.");
    }

    // 2) Generate speech via existing TTS API
    const ttsResponse = await fetch(
      `${req.headers.origin}/api/openai-tts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      }
    );
    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      throw new Error(`TTS API error: ${ttsResponse.status} - ${errorText}`);
    }
    const arrayBuffer = await ttsResponse.arrayBuffer();

    // Encode audio to base64
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    // Return both reply text and audio base64
    return res.status(200).json({ reply, audio: base64Audio });
  } catch (error: any) {
    console.error("/api/openai-chat error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error" });
  }
} 