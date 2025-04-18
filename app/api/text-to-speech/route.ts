import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs"; // Import the client
import { Readable } from "stream"; // Import Readable from stream

// --- Configuration ---
// The client defaults to process.env.ELEVENLABS_API_KEY, but we can be explicit
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = "29vD33N1CtxCmqQRPOHJ"; // Default voice ID or Name (e.g., "Rachel")
// ---

// Instantiate the client
// It will automatically use the ELEVENLABS_API_KEY from process.env if apiKey is omitted
const elevenlabs = new ElevenLabsClient({
  apiKey: ELEVENLABS_API_KEY,
});

export async function POST(req: NextRequest) {
  if (!ELEVENLABS_API_KEY) {
    console.error("ElevenLabs API key is missing from environment variables.");
    return NextResponse.json(
      { error: "Server configuration error: Missing API key." },
      { status: 500 }
    );
  }

  let text: string;
  let voice: string; // Can be voice ID or name

  try {
    const body = await req.json();
    text = body.text;
    // Use 'voice' from body, fallback to default, can be ID or name
    voice = body.voice || DEFAULT_VOICE_ID;

    if (!text) {
      return NextResponse.json(
        { error: 'Missing "text" field in request body.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error parsing request body:", error);
    return NextResponse.json(
      { error: 'Invalid request body. Expecting JSON with "text" field.' },
      { status: 400 }
    );
  }

  console.log(`Sending request to ElevenLabs client for voice "${voice}"...`);

  try {
    // Use the client library to generate audio
    const audioStream = await elevenlabs.generate({
      voice: voice, // Use ID or name
      text: text,
      model_id: "eleven_multilingual_v2", // Ensure this model supports the voice/language
      // Optional: Specify output format, latency optimizations etc.
      // output_format: "mp3_44100_128", // Example: default is mp3_44100_128
      // latency: 4, // Max latency optimization
      voice_settings: {
        // These are optional
        stability: 0.5,
        similarity_boost: 0.75,
        // style: 0.0, // Requires eleven_multilingual_v2
        // use_speaker_boost: true, // Requires eleven_multilingual_v2
      },
    });

    console.log("Successfully received audio stream from ElevenLabs client.");

    // Convert the Node.js Readable stream to a Web API ReadableStream
    const webStream = Readable.toWeb(audioStream);

    // The generate function returns a ReadableStream, which NextResponse can handle directly.
    // We need to tell the client what kind of audio it is.
    // Determine content type based on requested output_format (or default)
    // Default is 'audio/mpeg' for mp3_44100_128
    const contentType = "audio/mpeg"; // Adjust if you change output_format

    // Return the stream directly
    // Cast to 'any' to resolve type conflict between Node.js and Web API ReadableStream
    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error: any) {
    // Handle potential errors from the ElevenLabs client
    console.error("Error calling ElevenLabs client:", error);
    let errorMessage = "Failed to generate speech via client.";
    let status = 500;

    // Check for specific ElevenLabs API errors if the library provides structured errors
    // (Assuming error might have properties like .status or .message)
    if (error.status) {
      status = error.status;
      errorMessage = `ElevenLabs client error (${status}): ${error.message || "Unknown error"}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage, details: error },
      { status: status }
    );
  }
}
