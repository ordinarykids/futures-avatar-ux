import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskMode,
  TaskType,
  VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Input,
  Select,
  SelectItem,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";
import { v4 as uuidv4 } from "uuid";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";

import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("text_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isSendingTestAudio, setIsSendingTestAudio] = useState(false);
  const heygenAudioWs = useRef<WebSocket | null>(null);

  function baseApiUrl() {
    return process.env.NEXT_PUBLIC_BASE_API_URL;
  }

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();
      console.log("Access Token fetched:", token ? "<received>" : "<empty>");
      setAccessToken(token);
      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      setAccessToken(null);
    }
    return "";
  }

  async function startSession() {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();

    if (!newToken) {
      console.error("Failed to get access token, cannot start session.");
      setDebug("Error: Failed to get access token.");
      setIsLoadingSession(false);
      return;
    }

    avatar.current = new StreamingAvatar({
      token: newToken,
      basePath: baseApiUrl(),
    });
    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
      console.log("Avatar started talking", e);
    });
    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      console.log("Avatar stopped talking", e);
    });
    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log("Stream disconnected");
      endSession();
    });
    avatar.current?.on(StreamingEvents.STREAM_READY, (event) => {
      console.log(">>>>> Stream ready:", event.detail);
      setStream(event.detail);
    });
    avatar.current?.on(StreamingEvents.USER_START, (event) => {
      console.log(">>>>> User started talking:", event);
      setIsUserTalking(true);
    });
    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      console.log(">>>>> User stopped talking:", event);
      setIsUserTalking(false);
    });
    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId: knowledgeId, // Or use a custom `knowledgeBase`.
        voice: {
          rate: 1.5, // 0.5 ~ 1.5
          emotion: VoiceEmotion.EXCITED,
          // elevenlabsSettings: {
          //   stability: 1,
          //   similarity_boost: 1,
          //   style: 1,
          //   use_speaker_boost: false,
          // },
        },
        language: language,
        disableIdleTimeout: true,
      });

      setData(res);
      // default to voice mode
      await avatar.current?.startVoiceChat({
        useSilencePrompt: false,
      });
      setChatMode("voice_mode");
    } catch (error) {
      console.error("Error starting avatar session:", error);
    } finally {
      setIsLoadingSession(false);
    }
  }
  async function handleSpeak() {
    setIsLoadingRepeat(true);
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    // speak({ text: text, task_type: TaskType.REPEAT })
    await avatar.current
      .speak({ text: text, taskType: TaskType.REPEAT, taskMode: TaskMode.SYNC })
      .catch((e) => {
        setDebug(e.message);
      });
    setIsLoadingRepeat(false);
  }
  async function handleInterrupt() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    await avatar.current.interrupt().catch((e) => {
      setDebug(e.message);
    });
  }
  async function endSession() {
    await avatar.current?.stopAvatar();
    setStream(undefined);
  }

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    if (v === chatMode) {
      return;
    }
    if (v === "text_mode") {
      avatar.current?.closeVoiceChat();
    } else {
      await avatar.current?.startVoiceChat();
    }
    setChatMode(v);
  });

  const previousText = usePrevious(text);
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar?.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current?.play().catch((e) => {
          console.error("Error playing video stream:", e);
          setDebug("Error playing video. User interaction might be required.");
        });
      };
    }
  }, [stream, setDebug]);

  // Function to handle sending the test audio file DIRECTLY to HeyGen
  const handleSendTestAudio = useMemoizedFn(async () => {
    // Check if HeyGen session is active and we have the endpoint
    // @ts-ignore - SDK type might be inaccurate
    if (!data?.realtime_endpoint) {
      alert("HeyGen session not started or endpoint missing.");
      return;
    }
    if (isSendingTestAudio) return;

    setIsSendingTestAudio(true);
    setDebug("Connecting directly to HeyGen for audio...");

    // Close previous direct connection if exists
    if (heygenAudioWs.current) {
      heygenAudioWs.current.close();
      heygenAudioWs.current = null;
    }

    // Use the realtime_endpoint from the session data
    // @ts-ignore - SDK type might be inaccurate
    const wsUrl = data.realtime_endpoint;
    console.log("Attempting to connect directly to HeyGen Audio WS:", wsUrl);

    try {
      // Establish direct WebSocket connection to HeyGen
      const ws = new WebSocket(wsUrl);
      heygenAudioWs.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          console.log("Direct HeyGen Audio WS connection established.");
          resolve();
        };
        ws.onerror = (error) => {
          console.error("Direct HeyGen Audio WS error:", error);
          reject(new Error("WebSocket connection error"));
        };
        ws.onclose = (event) => {
          console.log(
            "Direct HeyGen Audio WS closed:",
            event.code,
            event.reason
          );
          if (heygenAudioWs.current === ws) {
            heygenAudioWs.current = null; // Clear ref if it's the one closing
          }
          // If it closes before we expect, reject the promise
          if (!isSendingTestAudio) {
            // Check if closure was unexpected
            reject(new Error(`WebSocket closed unexpectedly: ${event.code}`));
          }
        };
        ws.onmessage = (event) => {
          // Handle messages from HeyGen if needed (e.g., status updates)
          try {
            const message = JSON.parse(event.data);
            console.log("Message from Direct HeyGen WS:", message);
            // Add specific handling based on message.type if necessary
          } catch (e) {
            console.warn(
              "Received non-JSON message from Direct HeyGen WS:",
              event.data
            );
          }
        };
      });

      // Ensure connection is still open after promise resolves
      if (
        !heygenAudioWs.current ||
        heygenAudioWs.current.readyState !== WebSocket.OPEN
      ) {
        throw new Error("WebSocket connection not available after opening.");
      }

      setDebug("Loading and processing test audio for HeyGen (24kHz)...");

      // 1. Fetch the audio file
      const response = await fetch("/1.wav");
      if (!response.ok)
        throw new Error(
          `Failed to fetch test-audio.wav: ${response.statusText}`
        );
      const arrayBuffer = await response.arrayBuffer();

      // 2. Decode WAV data
      const audioContext = new AudioContext(); // Use default sample rate for decoding
      const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // 3. Resample to 24kHz MONO using OfflineAudioContext
      const targetSampleRate = 24000;
      const numberOfChannels = 1; // Mono
      const offlineCtx = new OfflineAudioContext(
        numberOfChannels,
        (decodedBuffer.length * targetSampleRate) / decodedBuffer.sampleRate,
        targetSampleRate
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(offlineCtx.destination);
      source.start();
      const resampledBuffer = await offlineCtx.startRendering();
      console.log(
        `Resampled to ${resampledBuffer.sampleRate}Hz, ${resampledBuffer.numberOfChannels} channels`
      );

      // 4. Convert Float32 PCM to Int16 PCM
      const pcmFloat32 = resampledBuffer.getChannelData(0); // Get mono channel
      const pcmInt16 = new Int16Array(pcmFloat32.length);
      for (let i = 0; i < pcmFloat32.length; i++) {
        const sample = Math.max(-1, Math.min(1, pcmFloat32[i]));
        pcmInt16[i] = sample < 0 ? sample * 32768 : sample * 32767;
      }
      const pcmBytes = new Uint8Array(pcmInt16.buffer);

      setDebug("Sending audio chunks directly to HeyGen...");

      // 5. Send in chunks via WebSocket using HeyGen JSON format
      const bytesPerSecond = targetSampleRate * numberOfChannels * 2; // 2 bytes per sample (16-bit)
      const chunkSize = bytesPerSecond * 2; // Approx 2 seconds per chunk

      // Clear buffer initially (good practice?)
      // const clearMsg = { type: "agent.audio_buffer_clear", event_id: uuidv4() };
      // ws.send(JSON.stringify(clearMsg));

      for (let i = 0; i < pcmBytes.length; i += chunkSize) {
        if (
          !heygenAudioWs.current ||
          heygenAudioWs.current.readyState !== WebSocket.OPEN
        ) {
          throw new Error("WebSocket closed during audio sending loop.");
        }
        const chunkBytes = pcmBytes.slice(i, i + chunkSize);
        // Convert chunk to base64
        const chunkBase64 = btoa(
          String.fromCharCode.apply(null, Array.from(chunkBytes))
        );

        // Create JSON message
        const appendMsg = {
          type: "agent.audio_buffer_append",
          event_id: uuidv4(),
          audio: chunkBase64,
        };

        // Send the JSON string
        ws.send(JSON.stringify(appendMsg));
        console.log(
          `Sent audio chunk ${Math.floor(i / chunkSize) + 1}, size: ${chunkBytes.length} bytes`
        );

        // Optional: Delay based on chunk duration
        const chunkDurationMs = (chunkBytes.length / bytesPerSecond) * 1000;
        await new Promise((resolve) =>
          setTimeout(resolve, chunkDurationMs * 0.9)
        );
      }

      // Commit after sending all chunks (mimicking HeyGenVideoService logic)
      if (
        heygenAudioWs.current &&
        heygenAudioWs.current.readyState === WebSocket.OPEN
      ) {
        console.log("Sending audio buffer commit...");
        const commitMsg = {
          type: "agent.audio_buffer_commit",
          event_id: uuidv4(),
          audio: "", // Sending empty audio on commit seems common
        };
        ws.send(JSON.stringify(commitMsg));
      }

      setDebug("Test audio sent directly to HeyGen!");
    } catch (error: any) {
      console.error("Error sending test audio directly to HeyGen:", error);
      setDebug(`Error: ${error.message}`);
      // Close WS on error
      if (heygenAudioWs.current) {
        heygenAudioWs.current.close();
        heygenAudioWs.current = null;
      }
    } finally {
      setIsSendingTestAudio(false);
      // Don't close the WS here automatically, maybe let HeyGen close it?
      // Or close after a delay?
      // if (heygenAudioWs.current) { heygenAudioWs.current.close(); heygenAudioWs.current = null; }
    }
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <Card>
        <CardBody className="h-[500px] flex flex-col justify-center items-center">
          {stream ? (
            <div className="h-[500px] w-[900px] justify-center items-center flex rounded-lg overflow-hidden">
              <video
                ref={mediaStream}
                autoPlay
                playsInline
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              >
                <track kind="captions" />
              </video>
              <div className="flex flex-col gap-2 absolute bottom-3 right-3">
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={handleInterrupt}
                >
                  Interrupt task
                </Button>
                <Button
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300  text-white rounded-lg"
                  size="md"
                  variant="shadow"
                  onClick={endSession}
                >
                  End session
                </Button>
              </div>
            </div>
          ) : !isLoadingSession ? (
            <div className="h-full justify-center items-center flex flex-col gap-8 w-[500px] self-center">
              <div className="flex flex-col gap-2 w-full">
                <p className="text-sm font-medium leading-none">
                  Custom Knowledge ID (optional)
                </p>
                <Input
                  placeholder="Enter a custom knowledge ID"
                  value={knowledgeId}
                  onChange={(e) => setKnowledgeId(e.target.value)}
                />
                <p className="text-sm font-medium leading-none">
                  Custom Avatar ID (optional)
                </p>
                <Input
                  placeholder="Enter a custom avatar ID"
                  value={avatarId}
                  onChange={(e) => setAvatarId(e.target.value)}
                />
                <Select
                  placeholder="Or select one from these example avatars"
                  size="md"
                  onChange={(e) => {
                    setAvatarId(e.target.value);
                  }}
                >
                  {AVATARS.map((avatar) => (
                    <SelectItem
                      key={avatar.avatar_id}
                      textValue={avatar.avatar_id}
                    >
                      {avatar.name}
                    </SelectItem>
                  ))}
                </Select>
                <Select
                  label="Select language"
                  placeholder="Select language"
                  className="max-w-xs"
                  selectedKeys={[language]}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                  }}
                >
                  {STT_LANGUAGE_LIST.map((lang) => (
                    <SelectItem key={lang.key}>{lang.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <Button
                className="bg-gradient-to-tr from-indigo-500 to-indigo-300 w-full text-white"
                size="md"
                variant="shadow"
                onClick={startSession}
              >
                Start session
              </Button>
            </div>
          ) : (
            <Spinner color="default" size="lg" />
          )}
        </CardBody>
        <Divider />
        <CardFooter className="flex flex-col gap-3 relative">
          <Tabs
            aria-label="Options"
            selectedKey={chatMode}
            onSelectionChange={(v) => {
              handleChangeChatMode(v);
            }}
          >
            <Tab key="text_mode" title="Text mode" />
            <Tab key="voice_mode" title="Voice mode" />
          </Tabs>
          {chatMode === "text_mode" ? (
            <div className="w-full flex relative">
              <InteractiveAvatarTextInput
                disabled={!stream}
                input={text}
                label="Chat"
                loading={isLoadingRepeat}
                placeholder="Type something for the avatar to respond"
                setInput={setText}
                onSubmit={handleSpeak}
              />
              {text && (
                <Chip className="absolute right-16 top-3">Listening</Chip>
              )}
            </div>
          ) : (
            <div className="w-full text-center">
              <Button
                isDisabled={!isUserTalking}
                className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white"
                size="md"
                variant="shadow"
              >
                {isUserTalking ? "Listening" : "Voice chat"}
              </Button>
            </div>
          )}
          <Button
            color="secondary"
            onClick={handleSendTestAudio}
            isLoading={isSendingTestAudio}
            // Disable only if session not started or currently sending
            // @ts-ignore
            isDisabled={!data?.realtime_endpoint || isSendingTestAudio}
          >
            {isSendingTestAudio
              ? "Sending..."
              : "Send Test Audio File (Direct)"}
          </Button>
        </CardFooter>
      </Card>
      <p className="font-mono text-right">
        <span className="font-bold">Console:</span>
        <br />
        {debug}
      </p>
    </div>
  );
}
