import React, { useEffect, useRef, useState } from "react";
import type { IconType } from "react-icons";

const TOTAL_BACKGROUNDS = 10;
const IMAGE_FADE_MS = 700; // 0.7s crossfade for GIFs
const AUDIO_CROSSFADE_MS = 800; // 0.8s audio crossfade
const VOLUME_FADE_MS = 300; // quick fade for mute/unmute
const AUTO_ROTATE_INTERVAL_MS = 20000; // auto-change background every 20s when enabled

function getBgSrc(index: number): string {
  return `/bg${index + 1}.gif`;
}

function getMusicSrc(index: number): string {
  return `/music${index + 1}.mp3`;
}

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [layerSrcs, setLayerSrcs] = useState<[string, string]>([
    getBgSrc(0),
    getBgSrc(0),
  ]);

  const [isMuted, setIsMuted] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isAutoRotate, setIsAutoRotate] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const renderIcon = (Icon: IconType, className?: string) =>
    React.createElement(Icon, { className });

  // Ensure both layers start with the initial background
  useEffect(() => {
    setLayerSrcs([getBgSrc(currentIndex), getBgSrc(currentIndex)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear any running fade interval on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        window.clearInterval(fadeIntervalRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
      if (nextAudioRef.current) {
        nextAudioRef.current.pause();
      }
    };
  }, []);

  // Auto-rotate backgrounds when enabled
  useEffect(() => {
    if (!isAutoRotate) return;
    const id = window.setInterval(() => {
      const newIndex = (currentIndex + 1) % TOTAL_BACKGROUNDS;
      switchBackgroundTo(newIndex);
    }, AUTO_ROTATE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAutoRotate, currentIndex]);

  const clearFadeInterval = () => {
    if (fadeIntervalRef.current) {
      window.clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  };

  const startAudioIfAllowed = async (audio: HTMLAudioElement) => {
    // Defer until first user interaction and only when play state is ON
    if (!hasInteracted || !isPlaying) return;
    try {
      await audio.play();
    } catch {
      // Ignore autoplay rejections; will start after next user click
    }
  };

  const crossfadeToIndex = async (newIndex: number) => {
    const targetVolume = isMuted ? 0 : 1;
    const newSrc = getMusicSrc(newIndex);

    // If no current audio, start new track directly (after first user interaction)
    if (!currentAudioRef.current) {
      const a = new Audio(newSrc);
      a.loop = true;
      a.volume = targetVolume;
      currentAudioRef.current = a;
      await startAudioIfAllowed(a);
      return;
    }

    const current = currentAudioRef.current;
    if (!current) return;

    // If the same track, nothing to do
    if (current.src.endsWith(newSrc)) {
      return;
    }

    // Prepare next audio
    const next = new Audio(newSrc);
    next.loop = true;
    next.volume = 0;
    nextAudioRef.current = next;
    await startAudioIfAllowed(next);

    // Crossfade
    clearFadeInterval();
    const intervalMs = 50;
    const steps = Math.max(1, Math.round(AUDIO_CROSSFADE_MS / intervalMs));
    let step = 0;
    const startVolCurrent = current.volume;

    fadeIntervalRef.current = window.setInterval(() => {
      step += 1;
      const t = Math.min(1, step / steps);

      // Fade out current towards 0
      current.volume = Math.max(0, startVolCurrent * (1 - t));

      // Fade in next towards targetVolume
      next.volume = Math.min(targetVolume, targetVolume * t);

      if (t >= 1) {
        clearFadeInterval();
        // Stop current and switch references
        current.pause();
        try {
          current.src = "";
        } catch {
          // ignore
        }
        currentAudioRef.current = next;
        nextAudioRef.current = null;
      }
    }, intervalMs);
  };

  const fadeCurrentVolumeTo = (toVolume: number, durationMs: number) => {
    const audio = currentAudioRef.current;
    if (!audio) return;
    clearFadeInterval();
    const intervalMs = 50;
    const steps = Math.max(1, Math.round(durationMs / intervalMs));
    let step = 0;
    const start = audio.volume;

    fadeIntervalRef.current = window.setInterval(() => {
      step += 1;
      const t = Math.min(1, step / steps);
      audio.volume = start + (toVolume - start) * t;
      if (t >= 1) {
        clearFadeInterval();
      }
    }, intervalMs);
  };

  const switchBackgroundTo = (newIndex: number) => {
    // 1) Preload image into the inactive layer
    const inactive = (activeLayer === 0 ? 1 : 0) as 0 | 1;
    const newSrc = getBgSrc(newIndex);

    const img = new Image();
    img.onload = () => {
      setLayerSrcs((prev) => {
        const next = [...prev] as [string, string];
        next[inactive] = newSrc;
        return next;
      });

      // Flip layers on next animation frame to trigger CSS opacity transition
      requestAnimationFrame(() => {
        setActiveLayer(inactive);
      });
    };
    img.src = newSrc;

    // 2) Switch audio with crossfade
    void crossfadeToIndex(newIndex);

    // 3) Update index
    setCurrentIndex(newIndex);
  };

  const handlePrev = () => {
    const newIndex = (currentIndex - 1 + TOTAL_BACKGROUNDS) % TOTAL_BACKGROUNDS;
    switchBackgroundTo(newIndex);
  };

  const handleNext = () => {
    const newIndex = (currentIndex + 1) % TOTAL_BACKGROUNDS;
    switchBackgroundTo(newIndex);
  };

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    const target = newMuted ? 0 : 1;
    fadeCurrentVolumeTo(target, VOLUME_FADE_MS);
  };

  const handleToggleAutoRotate = () => {
    setIsAutoRotate((prev) => !prev);
  };

  const handlePlayPause = async () => {
    const audio = currentAudioRef.current;
    if (isPlaying) {
      // Pause with a short fade
      fadeCurrentVolumeTo(0, 250);
      setTimeout(() => {
        currentAudioRef.current?.pause();
      }, 260);
      setIsPlaying(false);
      return;
    }

    // Turn on playing
    setIsPlaying(true);
    if (!audio) {
      // Start current track
      await crossfadeToIndex(currentIndex);
    } else {
      audio.volume = isMuted ? 0 : 1;
      try {
        await audio.play();
      } catch {
        // ignore; will play on next user gesture
      }
    }
  };

  // Start playback on first user interaction (any click inside the app)
  const handleFirstInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      // Ensure current track is created/playing
      void crossfadeToIndex(currentIndex);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full select-none overflow-hidden bg-black"
      onClickCapture={handleFirstInteraction}
    >
      {/* Background layers (double-buffered GIF crossfade) */}
      <img
        src={layerSrcs[0]}
        alt=""
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
          activeLayer === 0 ? "opacity-100" : "opacity-0"
        }`}
      />
      <img
        src={layerSrcs[1]}
        alt=""
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
          activeLayer === 1 ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* CRT overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 opacity-20 mix-blend-overlay"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, rgba(0,0,0,0) 2px)",
        }}
      />

      {/* Top-left listening now */}
      <div className="absolute left-4 top-4 z-20 text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
        <div className="mb-1 text-sm uppercase tracking-widest">
          listening now {currentIndex + 1}…
        </div>
        <div className="h-1 w-64 overflow-hidden rounded bg-white/20">
          <div className="h-full w-1/3 animate-pulse bg-white/70" />
        </div>
      </div>

      {/* Bottom-left player bar */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-start p-4">
        <div className="pointer-events-auto mb-1 max-w-[min(96vw,980px)] rounded-md border border-white/10 bg-black/35 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="rounded-md bg-white/15 px-3 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? renderIcon(FaPause) : renderIcon(FaPlay)}
            </button>
            <button
              onClick={handlePrev}
              className="rounded-md bg-white/15 px-2 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
              aria-label="Previous background"
            >
              {renderIcon(FaStepBackward)}
            </button>
            <button
              onClick={handleNext}
              className="rounded-md bg-white/15 px-2 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
              aria-label="Next background"
            >
              {renderIcon(FaStepForward)}
            </button>
            <button
              onClick={handleToggleMute}
              className="rounded-md bg-white/15 px-2 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
              aria-label={isMuted ? "Unmute" : "Mute"}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? renderIcon(FaVolumeMute) : renderIcon(FaVolumeUp)}
            </button>
            <button
              onClick={handleToggleAutoRotate}
              className={`rounded-md px-2 py-1 text-lg transition active:scale-95 ${
                isAutoRotate ? "bg-white/30" : "bg-white/15 hover:bg-white/25"
              }`}
              aria-label={
                isAutoRotate
                  ? "Disable auto room change"
                  : "Enable auto room change"
              }
            >
              {renderIcon(FaRedoAlt)}
            </button>

            {/* Volume indicator */}
            <div className="flex items-center gap-1 pl-2 pr-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <span
                  key={i}
                  className={`inline-block h-3 w-1 rounded-sm ${
                    isMuted
                      ? "bg-white/20"
                      : i < 9
                      ? "bg-white/80"
                      : "bg-white/40"
                  }`}
                />
              ))}
            </div>

            {/* Track label */}
            <div className="flex items-center gap-2 truncate text-sm opacity-90">
              {renderIcon(FaMusic, "opacity-80")}
              <span className="truncate">
                coffee shop radio // 24/7 lofi hip-hop beats — room{" "}
                {currentIndex + 1}/10
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
