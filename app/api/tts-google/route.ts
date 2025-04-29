import { TextToSpeechClient, protos } from "@google-cloud/text-to-speech";
import { NextRequest, NextResponse } from "next/server";

// Create a client
const client = new TextToSpeechClient();

// Types for request
type SynthesizeSpeechRequest =
  protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest;
type AudioEncoding = protos.google.cloud.texttospeech.v1.AudioEncoding;

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const {
      text,
      languageCode = "en-US",
      ssmlGender = "NEUTRAL",
    } = await request.json();

    // Validate the input
    if (!text) {
      return NextResponse.json(
        { error: "Text input is required" },
        { status: 400 }
      );
    }

    // Construct the request
    const ttsRequest: SynthesizeSpeechRequest = {
      input: { text },
      voice: {
        languageCode,
        ssmlGender,
        name: "Orus",
      },
      audioConfig: {
        audioEncoding: "MP3" as unknown as AudioEncoding,
      },
    };

    // Perform the text-to-speech request
    const [response] = await client.synthesizeSpeech(ttsRequest);

    // Return the audio content with appropriate headers
    return new NextResponse(response.audioContent, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="speech.mp3"',
      },
    });
  } catch (error) {
    console.error("Error generating speech:", error);
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    );
  }
}
