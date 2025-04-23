import { NextRequest, NextResponse } from "next/server";

// POST /api/openai-dialog
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 1) Parse incoming form-data for 'audio'
  const formData = await req.formData();
  const audioFile = formData.get("audio");
  if (!(audioFile instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'audio' file in form data." },
      { status: 400 }
    );
  }

  // 2) Transcribe with Deepgram (VAD + punctuation)
  const buffer = await audioFile.arrayBuffer();
  const deepgramRes = await fetch(
    `https://api.deepgram.com/v1/listen?model=whisper&vad=true&punctuate=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": audioFile.type,
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      },
      body: buffer,
    }
  );
  if (!deepgramRes.ok) {
    const errText = await deepgramRes.text();
    console.error("Deepgram transcription error:", errText);
    return NextResponse.json(
      { error: "Deepgram transcription failed.", details: errText },
      { status: deepgramRes.status }
    );
  }
  const dgJson = await deepgramRes.json();
  const userText =
    dgJson.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  if (!userText) {
    return NextResponse.json(
      { error: "Could not transcribe audio." },
      { status: 500 }
    );
  }

  // 3) Send transcription to OpenAI o4-mini for chat completion
  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: userText },
      ],
    }),
  });
  if (!chatRes.ok) {
    const errText = await chatRes.text();
    console.error("OpenAI chat error:", errText);
    return NextResponse.json(
      { error: "OpenAI chat failed.", details: errText },
      { status: chatRes.status }
    );
  }
  const chatJson = await chatRes.json();
  const reply = chatJson.choices?.[0]?.message?.content;
  if (!reply) {
    return NextResponse.json(
      { error: "No reply from OpenAI." },
      { status: 500 }
    );
  }

  // 4) Call existing TTS endpoint to get audio bytes
  const origin = new URL(req.url).origin;
  const ttsRes = await fetch(`${origin}/api/openai-tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: reply }),
  });
  if (!ttsRes.ok) {
    const errText = await ttsRes.text();
    console.error("TTS endpoint error:", errText);
    return NextResponse.json(
      { error: "TTS conversion failed.", details: errText },
      { status: ttsRes.status }
    );
  }

  // 5) Stream the resulting audio back to the client
  return new NextResponse(ttsRes.body, {
    status: 200,
    headers: {
      "Content-Type":
        ttsRes.headers.get("Content-Type") || "audio/mpeg",
    },
  });
} 