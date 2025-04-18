import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskMode,
  TaskType,
  VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
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
  Textarea,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";
import { v4 as uuidv4 } from "uuid";
import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import { Button } from "@/components/ui/button";
import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";
import { Loader2 } from "lucide-react";

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
  const [sendingAudioFile, setSendingAudioFile] = useState<string | null>(null);
  const heygenAudioWs = useRef<WebSocket | null>(null);
  const [ttsInputText, setTtsInputText] = useState<string>("");
  const [isSendingTts, setIsSendingTts] = useState<boolean>(false);

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
        quality: AvatarQuality.High,
        avatarName: "YoungAlex_CasualStudio_250318",
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

  const processAndSendAudioToHeygen = useMemoizedFn(
    async (
      audioBuffer: ArrayBuffer,
      wsUrl: string,
      sourceDescription: string = "audio"
    ) => {
      if (sendingAudioFile !== null) {
        console.log(`Already sending ${sendingAudioFile}, please wait.`);
        alert(`Already sending ${sendingAudioFile}, please wait.`);
        return;
      }

      setSendingAudioFile(sourceDescription);
      setDebug(`Connecting directly to HeyGen for ${sourceDescription}...`);

      if (heygenAudioWs.current) {
        heygenAudioWs.current.close();
        heygenAudioWs.current = null;
      }

      console.log(
        `Attempting to connect directly to HeyGen Audio WS: ${wsUrl} for ${sourceDescription}`
      );

      try {
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
              heygenAudioWs.current = null;
            }
            if (!sendingAudioFile) {
              reject(new Error(`WebSocket closed unexpectedly: ${event.code}`));
            }
          };
          ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              console.log("Message from Direct HeyGen WS:", message);
            } catch (e) {
              console.warn(
                "Received non-JSON message from Direct HeyGen WS:",
                event.data
              );
            }
          };
        });

        if (
          !heygenAudioWs.current ||
          heygenAudioWs.current.readyState !== WebSocket.OPEN
        ) {
          throw new Error("WebSocket connection not available after opening.");
        }

        setDebug(`Processing ${sourceDescription} for HeyGen (24kHz)...`);

        const audioContext = new AudioContext();
        const decodedBuffer = await audioContext.decodeAudioData(
          audioBuffer.slice(0)
        );

        const targetSampleRate = 24000;
        const numberOfChannels = 1;
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

        const pcmFloat32 = resampledBuffer.getChannelData(0);
        const pcmInt16 = new Int16Array(pcmFloat32.length);
        for (let i = 0; i < pcmFloat32.length; i++) {
          const sample = Math.max(-1, Math.min(1, pcmFloat32[i]));
          pcmInt16[i] = sample < 0 ? sample * 32768 : sample * 32767;
        }
        const pcmBytes = new Uint8Array(pcmInt16.buffer);

        setDebug(`Sending ${sourceDescription} chunks directly to HeyGen...`);

        const bytesPerSecond = targetSampleRate * numberOfChannels * 2;
        const chunkSize = bytesPerSecond * 2;

        for (let i = 0; i < pcmBytes.length; i += chunkSize) {
          if (
            !heygenAudioWs.current ||
            heygenAudioWs.current.readyState !== WebSocket.OPEN
          ) {
            throw new Error("WebSocket closed during audio sending loop.");
          }
          const chunkBytes = pcmBytes.slice(i, i + chunkSize);

          let binaryString = "";
          for (let j = 0; j < chunkBytes.length; j++) {
            binaryString += String.fromCharCode(chunkBytes[j]);
          }
          const chunkBase64 = btoa(binaryString);

          const appendMsg = {
            type: "agent.audio_buffer_append",
            event_id: uuidv4(),
            audio: chunkBase64,
          };

          heygenAudioWs.current.send(JSON.stringify(appendMsg));
          console.log(
            `Sent audio chunk ${Math.floor(i / chunkSize) + 1}, size: ${chunkBytes.length} bytes for ${sourceDescription}`
          );
        }

        if (
          heygenAudioWs.current &&
          heygenAudioWs.current.readyState === WebSocket.OPEN
        ) {
          console.log("Sending audio buffer commit...");
          const commitMsg = {
            type: "agent.audio_buffer_commit",
            event_id: uuidv4(),
            audio: "",
          };
          ws.send(JSON.stringify(commitMsg));
        }

        setDebug(`Audio from ${sourceDescription} sent directly to HeyGen!`);
      } catch (error: any) {
        console.error(
          `Error processing/sending ${sourceDescription} directly to HeyGen:`,
          error
        );
        setDebug(`Error sending ${sourceDescription}: ${error.message}`);
        if (heygenAudioWs.current) {
          heygenAudioWs.current.close();
          heygenAudioWs.current = null;
        }
      }
    }
  );

  const handleSendTestAudio = useMemoizedFn(async (audioFilename: string) => {
    const wsUrl = data?.realtime_endpoint;
    if (!wsUrl) {
      alert("HeyGen session not started or endpoint missing.");
      return;
    }

    if (sendingAudioFile !== null) {
      alert(`Already sending ${sendingAudioFile}, please wait.`);
      return;
    }

    setSendingAudioFile(audioFilename);
    setDebug(`Fetching ${audioFilename}...`);

    try {
      const response = await fetch(`/${audioFilename}`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch ${audioFilename}: ${response.statusText}`
        );
      }
      const arrayBuffer = await response.arrayBuffer();

      await processAndSendAudioToHeygen(arrayBuffer, wsUrl, audioFilename);
    } catch (error: any) {
      console.error(`Error fetching/sending ${audioFilename}:`, error);
      setDebug(`Error with ${audioFilename}: ${error.message}`);
      setSendingAudioFile(null);
    }
  });

  const handleSendTextToTTS = useMemoizedFn(async () => {
    if (!ttsInputText.trim()) {
      alert("Please enter some text to synthesize.");
      return;
    }
    const wsUrl = data?.realtime_endpoint;
    if (!wsUrl) {
      alert("HeyGen session not started or endpoint missing.");
      return;
    }
    if (sendingAudioFile !== null) {
      alert(`Already sending ${sendingAudioFile}, please wait.`);
      return;
    }

    setIsSendingTts(true);
    setDebug("Sending text to OpenAI TTS...");

    try {
      const response = await fetch("/api/openai-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: ttsInputText }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `OpenAI TTS API request failed: ${response.statusText} - ${errorData}`
        );
      }

      setDebug("Received audio from OpenAI TTS. Processing for HeyGen...");
      const audioBuffer = await response.arrayBuffer();

      await processAndSendAudioToHeygen(audioBuffer, wsUrl, "TTS Audio");
    } catch (error: any) {
      console.error(
        "Error sending text to TTS or forwarding to HeyGen:",
        error
      );
      setDebug(`TTS Error: ${error.message}`);
    } finally {
      setIsSendingTts(false);
    }
  });

  return (
    <>
      {stream ? (
        <div className="h-full w-full justify-center items-center flex rounded-lg overflow-hidden mx-auto relative">
          <video
            ref={mediaStream}
            autoPlay
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          >
            <track kind="captions" />
          </video>
          <div className="flex flex-col gap-2 absolute bottom-3 right-3">
            <Button onClick={handleInterrupt}>Interrupt task</Button>
            <Button onClick={endSession}>End session</Button>
          </div>
        </div>
      ) : !isLoadingSession ? (
        <div className="h-full justify-center items-center flex flex-col gap-8 w-[500px] self-center mx-auto">
          <Button onClick={startSession}>Start session</Button>
        </div>
      ) : (
        <div className="flex justify-center items-center w-full">
          <Spinner color="default" size="lg" />
        </div>
      )}

      <div className="flex flex-row gap-2 justify-center pt-4">
        {["1.wav", "2.wav", "3.wav", "long2.mp3"].map((filename) => {
          const isLoading = sendingAudioFile === filename;
          return (
            <Button
              key={filename}
              variant="secondary"
              onClick={() => handleSendTestAudio(filename)}
              disabled={sendingAudioFile !== null || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Sending..." : `Send ${filename} (Direct)`}
            </Button>
          );
        })}
      </div>

      {stream && (
        <div className="w-full max-w-xl mx-auto flex flex-col gap-2 pt-4 items-center">
          <Textarea
            label="Text to Speech (via OpenAI)"
            placeholder="Enter text for the avatar to speak via OpenAI TTS..."
            value={ttsInputText}
            onValueChange={setTtsInputText}
            minRows={2}
            maxRows={5}
            // disabled={!stream || isSendingTts || sendingAudioFile !== null}
          />
          <Button
            variant="default"
            onClick={handleSendTextToTTS}
            // disabled={
            //   !stream ||
            //   !ttsInputText.trim() ||
            //   isSendingTts ||
            //   sendingAudioFile !== null
            // }
          >
            {isSendingTts && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSendingTts ? "Synthesizing & Sending..." : "Send Text via TTS"}
          </Button>
        </div>
      )}

      <div className="w-full flex flex-col gap-4 hidden">
        <Card>
          <CardBody className="h-[500px] flex flex-col justify-center items-center"></CardBody>
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
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white"
                  size="lg"
                >
                  {isUserTalking ? "Listening" : "Voice chat"}
                </Button>
              </div>
            )}
          </CardFooter>
        </Card>
        <p className="font-mono text-right mt-4">
          <span className="font-bold">Console:</span>
          <br />
          {debug}
        </p>
      </div>
    </>
  );
}
