import React, { useEffect, useRef, useState } from "react";

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

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);

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
    if (!hasInteracted) return; // Defer until first user interaction
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

      {/* Controls */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-end p-4">
        <div className="pointer-events-auto mb-2 flex gap-2">
          <button
            onClick={handlePrev}
            className="bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-all hover:scale-105"
            aria-label="Previous background"
          >
            ⬅
          </button>
          <button
            onClick={handleToggleAutoRotate}
            className={`bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-all hover:scale-105 ${
              isAutoRotate ? "ring-1 ring-white/50" : ""
            }`}
            aria-label={
              isAutoRotate
                ? "Disable auto room change"
                : "Enable auto room change"
            }
            title={
              isAutoRotate ? "Auto room change: ON" : "Auto room change: OFF"
            }
          >
            {isAutoRotate ? "⏸️" : "▶️"}
          </button>
          <button
            onClick={handleToggleMute}
            className="bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-all hover:scale-105"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={handleNext}
            className="bg-white/20 text-white px-4 py-2 rounded-lg backdrop-blur-sm hover:bg-white/30 transition-all hover:scale-105"
            aria-label="Next background"
          >
            ➡
          </button>
        </div>
      </div>
    </div>
  );
}
