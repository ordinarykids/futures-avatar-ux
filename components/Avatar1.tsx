"use client";
import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils"; // make sure this util exists
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Volume2,
  Video,
  Minimize2,
  X,
  Square,
} from "lucide-react";
import InteractiveAvatar, { InteractiveAvatarHandle } from "./Avatar-HeyGen";

/**
 * Props for the AI Avatar panel component.
 */
export interface AiAvatarPanelProps {
  /** Title in header */
  agentName?: string;
  /** Avatar still frame / poster */
  avatarSrc: string;
  /** Visual state */
  state?: "default" | "captions" | "disconnected";
  /** Caption text when `state === 'captions'` */
  captionsText?: string;
  className?: string;
}

/**
 * Shadcn + Tailwind implementation of the Figma panel.
 * Fully client‑side (declared with `use client`).
 */
export default function AiAvatarPanel({
  agentName = "Agent name",
  avatarSrc,
  state = "default",
  captionsText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  className,
}: AiAvatarPanelProps) {
  const isDisconnected = state === "disconnected";
  const showCaptions = state === "captions";

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
  const interactiveAvatarRef = useRef<InteractiveAvatarHandle>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!dragRef.current || isMaximized) return;
    setIsDragging(true);
    const rect = dragRef.current.getBoundingClientRect();
    setOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    },
    [isDragging, offset]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handleDoubleClick = useCallback(() => {
    setIsMaximized((prev) => {
      if (!prev) {
        setPosition({ x: 0, y: 0 });
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={dragRef}
      className={cn(
        "absolute flex flex-col rounded-2xl shadow-lg overflow-hidden bg-background transition-all duration-300 ease-in-out",
        isMaximized
          ? "inset-0 w-full h-full aspect-auto"
          : "aspect-[9/16] w-72 sm:w-80",
        className
      )}
      style={
        !isMaximized
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
          : {}
      }
    >
      {/* Header */}
      <header
        className={cn(
          "z-20 flex items-center justify-between px-4 py-2 bg-muted/60 backdrop-blur-md",
          isMaximized
            ? "cursor-default"
            : isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
        )}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        <span className="font-medium truncate text-sm">
          Intuit Intelligence
        </span>

        <nav className="ml-auto flex items-center gap-2 text-xs font-medium select-none">
          {/* <span className="text-primary">AI Avatar</span> */}
          {/* <span className="opacity-60">|</span>
          <span className="opacity-60 hover:opacity-100 cursor-pointer">Tasks</span> */}
        </nav>

        <div className="ml-2 flex items-center space-x-1">
          {/* <IconButton icon={<Square className="h-3.5 w-3.5" />} class="hover:bg-red-500" />
          <IconButton icon={<Minimize2 className="h-3.5 w-3.5" />} /> */}
          <IconButton icon={<X className="h-3.5 w-3.5" />} />
        </div>
      </header>

      {/* Video / poster */}
      <div className="relative flex-1 bg-black/10">
        <InteractiveAvatar
          ref={interactiveAvatarRef}
          className={cn(
            "object-cover object-center transition-opacity duration-300",
            isDisconnected && "opacity-40 grayscale"
          )}
        />

        {/* <Image
          src={avatarSrc}
          alt="AI avatar"
          fill
          sizes="(max-width: 640px) 100vw, 432px"
          priority
        /> */}

        {showCaptions && (
          <div className="absolute inset-x-4 bottom-28 text-center text-sm leading-snug text-white drop-shadow-lg">
            {captionsText}
          </div>
        )}

        {isDisconnected && (
          <span className="absolute top-3 left-4 bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-0.5 rounded-md shadow">
            DISCONNECTED
          </span>
        )}
      </div>

      {/* Control bar */}
      <div className="absolute bottom-4 inset-x-0 px-6 flex justify-between items-center pointer-events-none">
        <ControlButton icon={<Volume2 className="h-5 w-5" />} />
        <ControlButton
          icon={<Volume2 className="h-5 w-5" />}
          onClick={() =>
            interactiveAvatarRef.current?.handleSendTestAudio("1.wav")
          }
        />
        <ControlButton
          icon={
            isDisconnected ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )
          }
          ring={!isDisconnected}
        />
        <ControlButton icon={<Video className="h-5 w-5" />} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Helper buttons
// ──────────────────────────────────────────────────────────────
interface ControlButtonProps {
  icon: React.ReactNode;
  ring?: boolean;
  onClick?: () => void;
}

function ControlButton({ icon, ring, onClick }: ControlButtonProps) {
  return (
    <div className="relative pointer-events-auto">
      {ring && (
        <span className="absolute inset-0 rounded-full animate-ping border-2 border-primary opacity-40" />
      )}
      <Button
        size="icon"
        className="hover:bg-red-500 h-12 w-12 rounded-full bg-background/80 shadow-md backdrop-blur-md"
        variant="secondary"
        onClick={onClick}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {icon}
      </Button>
    </div>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
}

const IconButton = ({ icon }: IconButtonProps) => (
  <Button
    variant="ghost"
    size="icon"
    className="h-6 w-6 p-0"
    onMouseDown={(e) => e.stopPropagation()}
  >
    {icon}
  </Button>
);
