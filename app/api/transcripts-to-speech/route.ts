import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const client = new TextToSpeechClient();

interface TranscriptUtterance {
  speaker: string;
  text: string;
}

export async function POST(request: NextRequest) {
  try {
    let transcripts: TranscriptUtterance[];

    // Check if the request has a JSON payload
    if (request.headers.get("content-type")?.includes("application/json")) {
      // Get transcript from request body
      const body = await request.json();
      transcripts = body.transcripts || [];
    } else {
      // Default to reading from file if no upload provided
      const transcriptsPath = path.join(
        process.cwd(),
        "data",
        "transcripts.json"
      );
      const raw = await fs.readFile(transcriptsPath, "utf-8");
      transcripts = JSON.parse(raw);
    }

    if (!transcripts.length) {
      return NextResponse.json(
        { error: "No transcript data provided" },
        { status: 400 }
      );
    }

    // Synthesize each utterance with alternating voices
    const buffers: Buffer[] = [];
    for (const utterance of transcripts) {
      const isCustomer = utterance.speaker.toLowerCase() === "customer";
      const voiceName = isCustomer ? "Charon" : "Orus";
      const ssmlGender = isCustomer
        ? protos.google.cloud.texttospeech.v1.SsmlVoiceGender.FEMALE
        : protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL;

      const ttsReq: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
        {
          input: { text: utterance.text },
          voice: { languageCode: "en-US", ssmlGender, name: voiceName },
          audioConfig: {
            audioEncoding:
              protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
          },
        };

      const [resp] = await client.synthesizeSpeech(ttsReq);
      buffers.push(Buffer.from(resp.audioContent as Uint8Array));
    }

    // Concatenate all MP3 buffers into one
    const combined = Buffer.concat(buffers);
    return new NextResponse(combined, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="transcript_speech.mp3"',
      },
    });
  } catch (err) {
    console.error("Error generating transcript speech:", err);
    return NextResponse.json(
      { error: "Failed to generate transcript speech" },
      { status: 500 }
    );
  }
}
