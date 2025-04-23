"use client";

import InteractiveAvatar from "@/components/InteractiveAvatar";
import AiAvatarPanel from "@/components/Avatar1";

import { useEffect, useState } from "react";
import { socket } from "./socket";



export default function App() {

  const [isConnected, setIsConnected] = useState(false);
  const [transport, setTransport] = useState("N/A");

  useEffect(() => {
    if (socket.connected) {
      onConnect();
    }

    function onConnect() {
      setIsConnected(true);
      setTransport(socket.io.engine.transport.name);

      socket.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
      });
    }

    function onDisconnect() {
      setIsConnected(false);
      setTransport("N/A");
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);



  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="w-[900px] flex flex-col items-start justify-start gap-5 mx-auto pt-4 pb-20">
        <div className="w-full">
          <div>
            <p>Status: { isConnected ? "connected" : "disconnected" }</p>
            <p>Transport: { transport }</p>
          </div>
          <AiAvatarPanel
            agentName="John"
            avatarSrc="/avatar.png"
            state="default"
            captionsText="Hello, how can I help you today?"
            // className="w-[300px] h-[300px]"
          />
        </div>
      </div>
    </div>
  );
}
