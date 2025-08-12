import React, { useEffect, useRef, useState } from "react";

const TOTAL_BACKGROUNDS = 10;

// Order matches room index 1..10
const TRACKS: { src: string; title: string }[] = [
  {
    src: "/bgm/good-night-lofi-cozy-cafe-1.mp3",
    title: "Good Night Lofi — Cozy Cafe",
  },
  {
    src: "/bgm/lofi-relax-music-lofium-2.mp3",
    title: "Lofi Relax Music — Lofium",
  },
  { src: "/bgm/lofi-295209.mp3", title: "Lofi 295209" },
  { src: "/bgm/lofi-relax-lofi-4.mp3", title: "Lofi Relax" },
  { src: "/bgm/spring-lofi-vibes-lofi-5.mp3", title: "Spring Lofi Vibes" },
  {
    src: "/bgm/walking-dreaming-chill-lofi-6.mp3",
    title: "Walking Dreaming Chill Lofi",
  },
  {
    src: "/bgm/focus-zone-relax-mellow-lofi-7.mp3",
    title: "Focus Zone — Relax & Mellow",
  },
  { src: "/bgm/lofi-background-music-8.mp3", title: "Lofi Background Music" },
  { src: "/bgm/rainy-lofi-city-lofi-9.mp3", title: "Rainy Lofi City" },
  { src: "/bgm/lofi-girl-lofi-ambient-10.mp3", title: "Lofi Girl — Ambient" },
];
const IMAGE_FADE_MS = 700; // 0.7s crossfade for GIFs
const AUDIO_CROSSFADE_MS = 800; // 0.8s audio crossfade
const VOLUME_FADE_MS = 300; // quick fade for mute/unmute
const AUTO_ROTATE_INTERVAL_MS = 20000; // auto-change background every 20s when enabled

function getBgSrc(index: number): string {
  return `/bg${index + 1}.gif`;
}

function getMusicSrc(index: number): string {
  const track = TRACKS[index];
  return track ? track.src : `/music${index + 1}.mp3`;
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [displayVolume, setDisplayVolume] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [roomTitles, setRoomTitles] = useState<string[]>(
    TRACKS.map((t, i) => `${t.title} — room ${i + 1}`)
  );

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const renderIcon = (Icon: React.ElementType, className?: string) => (
    <Icon className={className} />
  );

  // Ensure both layers start with the initial background
  useEffect(() => {
    setLayerSrcs([getBgSrc(currentIndex), getBgSrc(currentIndex)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load optional titles from public/rooms.json
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/rooms.json", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          if (
            data.every((t) => typeof t === "string") &&
            data.length === TOTAL_BACKGROUNDS
          ) {
            setRoomTitles(data as string[]);
          } else if (
            data.every((t: any) => typeof t?.title === "string") &&
            data.length === TOTAL_BACKGROUNDS
          ) {
            setRoomTitles((data as { title: string }[]).map((x) => x.title));
          }
        }
      } catch {
        /* ignore */
      }
    };
    void load();
  }, []);

  const getRoomTitle = (index: number): string =>
    roomTitles[index] ?? TRACKS[index]?.title ?? `Room ${index + 1}`;

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
      setDisplayVolume(audio.volume);
    } catch {
      // Ignore autoplay rejections; will start after next user click
    }
  };

  const crossfadeToIndex = async (newIndex: number) => {
    const targetVolume = isMuted ? 0 : volume;
    const newSrc = getMusicSrc(newIndex);

    // If no current audio, start new track directly (after first user interaction)
    if (!currentAudioRef.current) {
      const a = new Audio(newSrc);
      a.loop = true;
      a.volume = targetVolume;
      currentAudioRef.current = a;
      setDisplayVolume(a.volume);
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

      // Update visual volume to the louder of both during crossfade
      setDisplayVolume(Math.max(current.volume, next.volume));

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
        setDisplayVolume(currentAudioRef.current.volume);
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
      setDisplayVolume(audio.volume);
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
    const target = newMuted ? 0 : volume;
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
      audio.volume = isMuted ? 0 : volume;
      try {
        await audio.play();
        setDisplayVolume(audio.volume);
      } catch {
        // ignore; will play on next user gesture
      }
    }
  };

  // Background gallery (room picker)
  const openPicker = () => setIsPickerOpen(true);
  const closePicker = () => setIsPickerOpen(false);
  const handleSelectIndex = (index: number) => {
    switchBackgroundTo(index);
    setIsPickerOpen(false);
  };

  // Start playback on first user interaction (any click inside the app)
  const handleFirstInteraction = () => {
    if (!hasInteracted) {
      setHasInteracted(true);
      // Ensure current track is created/playing
      void crossfadeToIndex(currentIndex);
    }
  };

  // Number of bars to fill based on current displayVolume
  const filledBars = Math.max(0, Math.min(12, Math.round(displayVolume * 12)));

  const setVolumeByFraction = (fraction: number) => {
    const next = Math.max(0, Math.min(1, fraction));
    setVolume(next);
    const audio = currentAudioRef.current;
    if (audio) {
      if (isMuted) {
        setIsMuted(false);
        audio.volume = 0;
        fadeCurrentVolumeTo(next, 150);
      } else {
        audio.volume = next;
        setDisplayVolume(next);
      }
    } else {
      setDisplayVolume(next);
    }
  };

  // Fullscreen
  useEffect(() => {
    const onFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="relative min-h-screen w-full select-none overflow-hidden bg-black"
      onClickCapture={handleFirstInteraction}
    >
      {/* Top-right fullscreen + settings */}
      <div className="absolute right-3 top-3 z-30 flex gap-2">
        <button
          onClick={toggleFullscreen}
          className="rounded bg-white/10 p-2 text-white hover:bg-white/20 backdrop-blur-sm"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          {isFullscreen ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M7 14H5v5h5v-2H7v-3zm0-4h3V7h2v5H7V7zm10 7h-3v2h5v-5h-2v3zm0-11h-5v2h3v3h2V6z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M7 7h3V5H5v5h2V7zm7-2v2h3v3h2V5h-5zm3 12h-3v2h5v-5h-2v3zM7 14H5v5h5v-2H7v-3z" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setIsSettingsOpen((s) => !s)}
          className="rounded bg-white/10 p-2 text-white hover:bg-white/20 backdrop-blur-sm"
          aria-label={isSettingsOpen ? "Close settings" : "Open settings"}
          title={isSettingsOpen ? "Close settings" : "Open settings"}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,13.67,2H10.33a.5.5,0,0,0-.49.42L9.46,5.07a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L4.86,11.06a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L2.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.49.42h3.34a.5.5,0,0,0,.49-.42l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
          </svg>
        </button>
      </div>

      {isSettingsOpen && (
        <div className="absolute right-3 top-14 z-30 w-64 rounded-md border border-white/10 bg-black/70 p-3 text-white shadow-lg backdrop-blur-md">
          <div className="mb-2 text-sm font-medium">Music settings</div>
          <div className="mb-3">
            <label className="mb-1 block text-xs opacity-80">
              Volume: {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(volume * 100)}
              onChange={(e) => {
                const next = Math.max(
                  0,
                  Math.min(1, Number(e.target.value) / 100)
                );
                setVolume(next);
                const audio = currentAudioRef.current;
                if (audio && !isMuted) {
                  audio.volume = next;
                  setDisplayVolume(next);
                } else if (isMuted) {
                  setDisplayVolume(0);
                } else {
                  setDisplayVolume(next);
                }
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded bg-white/10 accent-white/80"
              aria-label="Volume"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={handleToggleMute}
              className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
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

      {/* Room picker overlay */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/80 p-6 backdrop-blur-sm">
          <div className="relative w-full max-w-6xl">
            <button
              onClick={closePicker}
              className="absolute right-0 top-0 rounded bg-white/10 px-3 py-1 text-white hover:bg-white/20"
              aria-label="Close"
            >
              ✕
            </button>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: TOTAL_BACKGROUNDS }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectIndex(i)}
                  className={`group overflow-hidden rounded-lg border border-white/10 bg-black/30 text-left text-white transition hover:bg-white/10 ${
                    i === currentIndex
                      ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-black"
                      : ""
                  }`}
                >
                  <img
                    src={getBgSrc(i)}
                    alt={`${getRoomTitle(i)} — room ${i + 1}`}
                    className="h-40 w-full object-cover"
                  />
                  <div className="flex items-center justify-between px-2 py-1 text-xs">
                    <span className="truncate opacity-90">
                      {getRoomTitle(i)} — {i + 1}
                    </span>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      Select
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top-left listening now */}
      <div className="absolute left-4 top-4 z-20 text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
        <div className="mb-1 text-sm uppercase tracking-widest">
          listening now: {getRoomTitle(currentIndex)}
        </div>
        <div className="h-1 w-64 overflow-hidden rounded bg-white/20">
          <div className="h-full w-1/3 animate-pulse bg-white/70" />
        </div>
      </div>

      {/* Bottom-left player bar */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-start p-4">
        <div className="pointer-events-auto mb-1 max-w-[min(96vw,980px)] rounded-md border border-white/10 bg-black/35 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePlayPause}
                className="rounded-md bg-white/15 px-3 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
                aria-label={isPlaying ? "Pause" : "Play"}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handlePrev}
                className="rounded-md bg-white/15 px-2 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
                aria-label="Previous background"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M6 6h2v12H6zM20 6v12L9 12z" />
                </svg>
              </button>
              <button
                onClick={handleNext}
                className="rounded-md bg-white/15 px-2 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
                aria-label="Next background"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5"
                >
                  <path d="M16 6h2v12h-2zM4 6l11 6-11 6z" />
                </svg>
              </button>
              <button
                onClick={handleToggleMute}
                className="rounded-md bg-white/15 px-2 py-1 text-lg hover:bg-white/25 active:scale-95 transition"
                aria-label={isMuted ? "Unmute" : "Mute"}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M5 9v6h4l5 5V4L9 9H5zm12.59.59L16.17 11l1.42 1.41L19.41 11l1.41 1.41 1.41-1.41L20.83 9.59l1.4-1.41-1.41-1.41L19.41 8.17l-1.41-1.4-1.41 1.41 1.41 1.41z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89 1.09 5 3.9 5 7.71s-2.11 6.62-5 7.71v2.06c4.01-1.17 7-4.93 7-9.77s-2.99-8.6-7-9.77z" />
                  </svg>
                )}
              </button>
              <div className="flex items-center gap-1 pl-2 pr-3 cursor-pointer">
                {Array.from({ length: 12 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setVolumeByFraction((i + 1) / 12)}
                    className={`inline-block h-3 w-1 rounded-sm transition-colors ${
                      isMuted
                        ? "bg-white/20"
                        : i < filledBars
                        ? "bg-white/80"
                        : "bg-white/30"
                    }`}
                    title={`Set volume to ${Math.round(((i + 1) / 12) * 100)}%`}
                    aria-label={`Set volume to ${Math.round(
                      ((i + 1) / 12) * 100
                    )}%`}
                  />
                ))}
              </div>
            </div>

            {/* Volume indicator (row 2) */}

            {/* Music open + label moved to bottom-right corner */}
          </div>
        </div>
      </div>

      {/* Bottom-right music label + picker trigger */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-end p-4">
        <div className="pointer-events-auto mb-1 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-white shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <button
              onClick={openPicker}
              className="rounded bg-white/10 p-1 hover:bg-white/20"
              aria-label="Choose room"
              title="Choose room"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4 opacity-80"
              >
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
              </svg>
            </button>
            <span className="truncate max-w-[60vw] sm:max-w-[40vw] md:max-w-[30vw]">
              {getRoomTitle(currentIndex)}/10
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
