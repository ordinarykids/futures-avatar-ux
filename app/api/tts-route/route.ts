// New transcript-to-speech route
import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const client = new TextToSpeechClient();

// Transcript utterance type
type TranscriptUtterance = {
  speaker: string;
  text: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    // Load transcripts from JSON file
    const transcriptsPath = path.join(
      process.cwd(),
      "data",
      "transcripts.json"
    );
    const fileContents = await fs.readFile(transcriptsPath, "utf-8");
    const transcripts: TranscriptUtterance[] = JSON.parse(fileContents);

    const audioBuffers: Buffer[] = [];
    for (const utterance of transcripts) {
      const isCustomer = utterance.speaker.toLowerCase() === "customer";
      const voiceName = isCustomer ? "Charon" : "Orus";
      const ssmlGender = isCustomer
        ? protos.google.cloud.texttospeech.v1.SsmlVoiceGender.FEMALE
        : protos.google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL;

      const ttsRequest: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest =
        {
          input: { text: utterance.text },
          voice: {
            languageCode: "en-US",
            ssmlGender,
            name: voiceName,
          },
          audioConfig: {
            audioEncoding:
              protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
          },
        };

      const [response] = await client.synthesizeSpeech(ttsRequest);
      audioBuffers.push(Buffer.from(response.audioContent as Uint8Array));
    }

    // Concatenate all audio buffers
    const combinedBuffer = Buffer.concat(audioBuffers);

    return new NextResponse(combinedBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="transcript_speech.mp3"',
      },
    });
  } catch (error) {
    console.error("Error generating transcript speech:", error);
    return NextResponse.json(
      { error: "Failed to generate transcript speech" },
      { status: 500 }
    );
  }
}
