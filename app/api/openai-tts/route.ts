import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// --- Configuration ---
// Default values if not provided in the request
const DEFAULT_MODEL = "tts-1"; // Or 'tts-1-hd'
const DEFAULT_VOICE = "echo"; // Other options: 'echo', 'fable', 'onyx', 'nova', 'shimmer'
const DEFAULT_RESPONSE_FORMAT = "mp3"; // Other options: 'opus', 'aac', 'flac', 'wav', 'pcm'
// ---

// Define allowed values as const arrays
const VALID_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;
const VALID_FORMATS = ["mp3", "opus", "aac", "flac", "wav", "pcm"] as const;

// Derive union types from the const arrays
type SpeechVoice = (typeof VALID_VOICES)[number];
type ResponseFormat = (typeof VALID_FORMATS)[number];

// Instantiate the OpenAI client
// It automatically uses the OPENAI_API_KEY from process.env
const openai = new OpenAI();

// Mapping response formats to Content-Type headers
const responseFormatToContentType: Record<string, string> = {
  mp3: "audio/mpeg",
  opus: "audio/opus",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "audio/L16; rate=24000; channels=1", // Assuming PCM is 24kHz, 16-bit mono based on docs
};

export async function POST(req: NextRequest) {
  // Basic check if the key might be missing (client doesn't throw error immediately)
  if (!process.env.OPENAI_API_KEY) {
    console.error("OpenAI API key is missing from environment variables.");
    return NextResponse.json(
      { error: "Server configuration error: Missing API key." },
      { status: 500 }
    );
  }

  let input: string;
  let voice: SpeechVoice; // Use derived type
  let model: string; // Assuming 'tts-1' | 'tts-1-hd' is fine as string here
  let instructions: string | undefined;

  instructions =
    "Tone: Sarcastic, disinterested, and melancholic, with a hint of passive-aggressiveness.\n\nEmotion: Apathy mixed with reluctant engagement.\n\nDelivery: Monotone with occasional sighs, drawn-out words, and subtle disdain, evoking a classic emo teenager attitude.";

  let response_format: ResponseFormat; // Use derived type

  try {
    const body = await req.json();
    input = body.input || body.text; // Allow 'input' or 'text'

    // Validate and assign voice
    const requestedVoice = body.voice;
    voice = VALID_VOICES.includes(requestedVoice)
      ? requestedVoice
      : DEFAULT_VOICE;

    // Validate and assign model
    const requestedModel = body.model;
    model =
      requestedModel && ["tts-1", "tts-1-hd"].includes(requestedModel)
        ? requestedModel
        : DEFAULT_MODEL;

    // Validate and assign response_format
    const requestedFormat = body.response_format;
    response_format = VALID_FORMATS.includes(requestedFormat)
      ? requestedFormat
      : DEFAULT_RESPONSE_FORMAT;

    instructions = body.instructions; // Optional

    if (!input) {
      return NextResponse.json(
        { error: 'Missing "input" or "text" field in request body.' },
        { status: 400 }
      );
    }
    // Note: OpenAI currently doesn't support 'instructions' parameter for standard TTS models (tts-1, tts-1-hd)
    // It was shown in an example potentially for a future/different model.
    // We'll keep it here but be aware it might not have an effect with tts-1 models.
    if (instructions) {
      console.warn(
        "OpenAI TTS 'instructions' parameter might not be supported by the selected model."
      );
    }
  } catch (error) {
    console.error("Error parsing request body:", error);
    return NextResponse.json(
      { error: "Invalid request body. Expecting JSON." },
      { status: 400 }
    );
  }

  console.log(
    `Sending request to OpenAI TTS - Model: ${model}, Voice: ${voice}, Format: ${response_format}...`
  );

  try {
    const speechParams: OpenAI.Audio.Speech.SpeechCreateParams = {
      model: model,
      voice: voice,
      input: input,
      response_format: response_format,
      // instructions: instructions, // Include if/when supported by the model
    };

    const response = await openai.audio.speech.create(speechParams);

    // Note: The openai library for Node.js handles the response differently
    // than a raw fetch. It typically returns the response body directly
    // if successful, which might already be a ReadableStream or similar.
    // For speech, it returns a Response object like fetch.

    if (!response.ok) {
      // Attempt to read the error body from OpenAI
      let errorDetails = "Unknown OpenAI error";
      try {
        const errorJson = await response.json();
        errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
      } catch (e) {
        errorDetails = await response.text();
      }
      console.error(`OpenAI API Error (${response.status}): ${errorDetails}`);
      return NextResponse.json(
        {
          error: `Failed to generate speech: ${response.statusText}`,
          details: errorDetails,
        },
        { status: response.status }
      );
    }

    console.log("Successfully received audio stream from OpenAI TTS.");

    // Get the stream from the response body
    const audioStream = response.body;
    const contentType =
      responseFormatToContentType[response_format] || "audio/mpeg"; // Default fallback

    // Return the stream
    return new NextResponse(audioStream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error: any) {
    console.error("Error calling OpenAI TTS API:", error);
    // Handle potential client-side errors (network, config)
    return NextResponse.json(
      {
        error: "Failed to connect to OpenAI TTS service.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
