"use client";

import { useState, useRef } from "react";

export default function TranscriptReader() {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [transcriptPreview, setTranscriptPreview] = useState<any[] | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleGenerateTranscriptSpeech() {
    if (!file) return;

    setLoading(true);
    setAudioUrl("");

    try {
      // Read the file content
      const text = await file.text();

      // Parse the JSON to ensure it's valid
      const transcripts = JSON.parse(text);

      const response = await fetch("/api/transcripts-to-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcripts,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate speech from transcript");
      }

      // Get the audio content and create a blob URL
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (error) {
      console.error("Error generating speech:", error);
      alert(
        "Error processing transcript: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      try {
        // Preview the transcript content
        const text = await selectedFile.text();
        const parsedTranscript = JSON.parse(text);
        setTranscriptPreview(parsedTranscript.slice(0, 3)); // Show first 3 entries
      } catch (error) {
        console.error("Error parsing JSON file:", error);
        setTranscriptPreview(null);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "application/json") {
        setFile(droppedFile);

        try {
          // Preview the transcript content
          const text = await droppedFile.text();
          const parsedTranscript = JSON.parse(text);
          setTranscriptPreview(parsedTranscript.slice(0, 3)); // Show first 3 entries
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          setTranscriptPreview(null);
        }
      } else {
        alert("Please upload a JSON file");
      }
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-[32px] row-start-2 items-center w-full max-w-xl">
        <h1 className="text-2xl font-bold">Conversation to Speech</h1>
        <p>Two person conversation. </p>

        <div className="w-full">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Transcript JSON File
            </label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-gray-400 mb-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-gray-500">
                {file
                  ? file.name
                  : "Drag and drop your JSON file here, or click to browse"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Only JSON files are accepted
              </p>
            </div>
            {file && (
              <div className="mt-4 p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium text-gray-700">
                  Uploaded: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
                {transcriptPreview && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-600 mb-1">
                      Preview:
                    </p>
                    <div className="max-h-40 overflow-y-auto text-xs bg-white p-2 rounded border border-gray-200">
                      {transcriptPreview.map((item, index) => (
                        <div
                          key={index}
                          className="mb-2 pb-2 border-b border-gray-100 last:border-0"
                        >
                          <span className="font-medium">{item.speaker}:</span>{" "}
                          {item.text.substring(0, 100)}
                          {item.text.length > 100 ? "..." : ""}
                        </div>
                      ))}
                      {transcriptPreview.length > 0 && (
                        <p className="text-gray-400 italic">... and more</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
          onClick={handleGenerateTranscriptSpeech}
          disabled={loading || !file}
        >
          {loading ? "Processing..." : "Generate Transcript Speech"}
        </button>

        {audioUrl && (
          <div className="w-full">
            <h2 className="text-lg font-semibold mb-2">Audio Preview</h2>
            <audio className="w-full mt-4" controls src={audioUrl} />
          </div>
        )}
      </main>

      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <p className="text-sm text-gray-500">
          Powered by Google Cloud Text-to-Speech API
        </p>
      </footer>
    </div>
  );
}
