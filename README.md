# Lofi Room

A cozy space with looping lofi GIFs and relaxing beats — your perfect background for studying, working, or just unwinding.

## Overview

The app displays full‑screen animated GIF backgrounds and plays a matching MP3 per room. It crossfades audio and images when switching rooms. A compact player provides essential controls and a room picker. A settings panel exposes useful tuning options.

## Requirements and assets

Place the following files under `public/`:

- Background GIFs (required)

```
public/
  bg1.gif
  bg2.gif
  ...
  bg10.gif
```

- Music tracks (required, mapped by index)

```
public/
  bgm/
    good-night-lofi-cozy-cafe-1.mp3
    lofi-relax-music-lofium-2.mp3
    lofi-295209.mp3
    lofi-relax-lofi-4.mp3
    spring-lofi-vibes-lofi-5.mp3
    walking-dreaming-chill-lofi-6.mp3
    focus-zone-relax-mellow-lofi-7.mp3
    lofi-background-music-8.mp3
    rainy-lofi-city-lofi-9.mp3
    lofi-girl-lofi-ambient-10.mp3
```

- Optional ambient sounds

```
public/
  ambient/
    rain.mp3
```

- Optional room titles

Create `public/rooms.json` (array of 10 strings) to override displayed titles.

```json
[
  "Good Night Lofi — Cozy Cafe — room 1",
  "Lofi Relax Music — room 2",
  "Lofi 295209 — room 3",
  "Lofi Relax — room 4",
  "Spring Lofi Vibes — room 5",
  "Walking Dreaming Chill Lofi — room 6",
  "Focus Zone — Relax and Mellow — room 7",
  "Lofi Background Music — room 8",
  "Rainy Lofi City — room 9",
  "Lofi Girl — Ambient — room 10"
]
```

If `rooms.json` is not present, titles are derived from the file mapping in code.

## Quick start

```bash
npm install
npm start
```

Open http://localhost:3000

Tailwind is already configured; no extra steps are required.

## Controls

- Play/Pause, Previous, Next, Mute
- Volume meter: click any bar to set volume
- Auto‑rotate toggle: cycles rooms at a set interval
- Room picker (bottom‑right): choose any room
- Fullscreen toggle (top‑right)
- Settings (top‑right)

## Settings panel

- Volume
- Crossfade duration (audio)
- Auto‑rotate interval (seconds)
- Ambient rain volume (requires `public/ambient/rain.mp3`)

Changes apply immediately. Audio starts after the first user gesture due to autoplay rules.

## How room mapping works

- Room index N uses `bgN.gif` and the Nth entry in the `TRACKS` list defined in `src/App.tsx` (under the `TRACKS` constant). If you prefer to keep names stable but change files, replace the MP3 files in `public/bgm/` using the same order or adjust the `TRACKS` list.

## Build

```bash
npm run build
```

## License

MIT.

thanks guys for reading this file hope you enjoyed this lofi room project and please let me know your feedback... im adding more assests in future

keep loving...

thanks again :)
