import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Use Edge runtime for streaming
export const runtime = "edge";

// Instantiate OpenAI client (uses OPENAI_API_KEY env var)
const openai = new OpenAI();

// POST /api/openai-chat
export async function POST(req: NextRequest) {
  // Expect a multipart/form-data with 'audio' file
  const formData = await req.formData();
  const audioFile = formData.get("audio");

  if (!(audioFile instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'audio' file in form data." },
      { status: 400 }
    );
  }

  try {
    // 1) Transcribe using Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
    });
    const userText = transcription.text;

    // 2) Generate chat completion
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userText },
      ],
    });
    const reply = chatCompletion.choices?.[0]?.message?.content || "";

    // 3) Synthesize reply via TTS
    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: reply,
      response_format: "mp3",
    });

    // Stream back the MP3 audio
    return new NextResponse(ttsResponse.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error: any) {
    console.error("/api/openai-chat error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
} 