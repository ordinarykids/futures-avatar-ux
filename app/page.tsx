"use client";

import InteractiveAvatar from "@/components/InteractiveAvatar";
import AiAvatarPanel from "@/components/Avatar1";

export default function App() {
  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="w-[900px] flex flex-col items-start justify-start gap-5 mx-auto pt-4 pb-20">
        <div className="w-full">
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
