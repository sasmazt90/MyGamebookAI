/**
 * useReaderAudio — Web Audio API hook for the Reader page.
 *
 * Provides:
 *  - playPageTurn(sfxTags?)  → optional Google Sound Library SFX
 *  - startAmbience()         → genre-specific procedural ambient loop
 *  - stopAmbience()
 *  - muted / setMuted
 *  - musicEnabled / setMusicEnabled
 *  - volume / setVolume
 *
 * Preferences are persisted in localStorage under "gamebook_audio_prefs".
 * Sound effects come from the Google Sound Library (OGG format).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { SOUND_LIBRARY_CSV_URL, findBestSound, type SoundEntry } from "@shared/soundLibrary";

// ---------------------------------------------------------------------------
// Google Sound Library — CSV loader + keyword matcher
// ---------------------------------------------------------------------------

// Module-level cache so we only fetch once per session
let soundLibraryCache: SoundEntry[] | null = null;
let soundLibraryLoading = false;
const soundLibraryCallbacks: Array<(entries: SoundEntry[]) => void> = [];

function loadSoundLibrary(): Promise<SoundEntry[]> {
  return new Promise((resolve) => {
    if (soundLibraryCache) { resolve(soundLibraryCache); return; }
    soundLibraryCallbacks.push(resolve);
    if (soundLibraryLoading) return;
    soundLibraryLoading = true;
    fetch(SOUND_LIBRARY_CSV_URL)
      .then(r => r.text())
      .then(text => {
        const lines = text.split("\n").slice(1);
        const entries: SoundEntry[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const c1 = trimmed.indexOf(",");
          const rest = trimmed.slice(c1 + 1);
          const c2 = rest.indexOf(",");
          const category = trimmed.slice(0, c1).toLowerCase().replace(/^\uFEFF/, "").trim();
          const sound = rest.slice(0, c2).toLowerCase().trim();
          const url = rest.slice(c2 + 1).trim();
          if (url.startsWith("http")) entries.push({ category, sound, url });
        }
        soundLibraryCache = entries;
        soundLibraryCallbacks.forEach(cb => cb(entries));
        soundLibraryCallbacks.length = 0;
      })
      .catch(() => {
        soundLibraryCache = [];
        soundLibraryCallbacks.forEach(cb => cb([]));
        soundLibraryCallbacks.length = 0;
      });
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BookCategory =
  | "horror_thriller"
  | "romance"
  | "comic"
  | "fairy_tale"
  | "crime_mystery"
  | "fantasy_scifi"
  | string;

interface AudioPrefs {
  muted: boolean;
  musicEnabled: boolean;
  volume: number;
}

const PREFS_KEY = "gamebook_audio_prefs";

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw) as AudioPrefs;
  } catch {}
  return { muted: false, musicEnabled: true, volume: 0.4 };
}

function savePrefs(p: AudioPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {}
}

// ---------------------------------------------------------------------------
// Genre → ambient config
// ---------------------------------------------------------------------------

interface AmbienceConfig {
  /** Base frequency of the root drone (Hz) */
  rootHz: number;
  /** Oscillator type for the drone */
  droneType: OscillatorType;
  /** Additional harmonic overtones [multiplier, gainFraction] */
  overtones: [number, number][];
  /** LFO rate for tremolo / vibrato (Hz) */
  lfoRate: number;
  /** LFO depth (0–1) */
  lfoDepth: number;
  /** Reverb wet mix (0–1) */
  reverbWet: number;
  /** Master gain for this genre */
  masterGain: number;
  /** High-pass filter cutoff (Hz) — 0 = no filter */
  hpCutoff: number;
  /** Low-pass filter cutoff (Hz) — 0 = no filter */
  lpCutoff: number;
}

const GENRE_AMBIENCE: Record<string, AmbienceConfig> = {
  horror_thriller: {
    rootHz: 55,          // A1 — deep, ominous
    droneType: "sawtooth",
    overtones: [[1.5, 0.3], [2, 0.15], [3, 0.08]],
    lfoRate: 0.07,
    lfoDepth: 0.6,
    reverbWet: 0.7,
    masterGain: 0.18,
    hpCutoff: 0,
    lpCutoff: 900,
  },
  crime_mystery: {
    rootHz: 73.4,        // D2 — tense, brooding
    droneType: "sawtooth",
    overtones: [[1.5, 0.25], [2.5, 0.1]],
    lfoRate: 0.12,
    lfoDepth: 0.4,
    reverbWet: 0.55,
    masterGain: 0.15,
    hpCutoff: 60,
    lpCutoff: 1200,
  },
  romance: {
    rootHz: 261.6,       // C4 — warm, gentle
    droneType: "sine",
    overtones: [[2, 0.3], [3, 0.12], [4, 0.06]],
    lfoRate: 0.25,
    lfoDepth: 0.15,
    reverbWet: 0.6,
    masterGain: 0.12,
    hpCutoff: 80,
    lpCutoff: 3500,
  },
  fairy_tale: {
    rootHz: 329.6,       // E4 — bright, magical
    droneType: "sine",
    overtones: [[2, 0.4], [3, 0.2], [4, 0.1], [6, 0.05]],
    lfoRate: 0.4,
    lfoDepth: 0.2,
    reverbWet: 0.65,
    masterGain: 0.13,
    hpCutoff: 100,
    lpCutoff: 5000,
  },
  fantasy_scifi: {
    rootHz: 110,         // A2 — epic, otherworldly
    droneType: "triangle",
    overtones: [[1.5, 0.35], [2, 0.2], [3, 0.1], [4.5, 0.05]],
    lfoRate: 0.18,
    lfoDepth: 0.35,
    reverbWet: 0.75,
    masterGain: 0.16,
    hpCutoff: 40,
    lpCutoff: 4000,
  },
  comic: {
    rootHz: 196,         // G3 — punchy, energetic
    droneType: "square",
    overtones: [[2, 0.2], [3, 0.1]],
    lfoRate: 0.5,
    lfoDepth: 0.25,
    reverbWet: 0.3,
    masterGain: 0.1,
    hpCutoff: 150,
    lpCutoff: 2500,
  },
};

const DEFAULT_AMBIENCE = GENRE_AMBIENCE.fantasy_scifi;

function getAmbienceConfig(category: BookCategory): AmbienceConfig {
  return GENRE_AMBIENCE[category] ?? DEFAULT_AMBIENCE;
}

// ---------------------------------------------------------------------------
// Reverb impulse response (simple exponential decay)
// ---------------------------------------------------------------------------

function buildReverbBuffer(ctx: AudioContext, duration = 2.5, decay = 2): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReaderAudio(category: BookCategory) {
  const prefs = loadPrefs();
  const [muted, setMutedState] = useState(prefs.muted);
  const [musicEnabled, setMusicEnabledState] = useState(prefs.musicEnabled);
  const [volume, setVolumeState] = useState(prefs.volume);
  const [isPlaying, setIsPlaying] = useState(false);

  // Refs for the audio graph (so we don't recreate on every render)
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const ambienceNodesRef = useRef<AudioNode[]>([]);
  const categoryRef = useRef<BookCategory>(category);
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null);

  // Keep category ref in sync
  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  // Persist prefs
  useEffect(() => {
    savePrefs({ muted, musicEnabled, volume });
  }, [muted, musicEnabled, volume]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function getCtx(): AudioContext {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }

  function stopAmbienceNodes() {
    ambienceNodesRef.current.forEach(n => {
      try {
        (n as OscillatorNode).stop?.();
        n.disconnect();
      } catch {}
    });
    ambienceNodesRef.current = [];
  }

  // ---------------------------------------------------------------------------
  // Page-turn SFX (Google Sound Library only)
  // ---------------------------------------------------------------------------

  const playPageTurn = useCallback((sfxTags?: string[]) => {
    if (muted || !sfxTags || sfxTags.length === 0) return;

    // Page-turn whoosh/rustle intentionally removed for all categories.
    // Only context-aware scene SFX is played from the shared sound library.
    loadSoundLibrary().then(entries => {
      const url = findBestSound(entries, "", sfxTags, categoryRef.current);
      if (!url) return;
      try {
        if (sfxAudioRef.current) {
          sfxAudioRef.current.pause();
          sfxAudioRef.current = null;
        }
        const audio = new Audio(url);
        audio.volume = Math.min(1, volume * 1.2);
        audio.crossOrigin = "anonymous";
        sfxAudioRef.current = audio;
        setTimeout(() => {
          if (sfxAudioRef.current === audio) {
            audio.play().catch(() => {});
          }
        }, 350);
      } catch {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, volume]);

  // ---------------------------------------------------------------------------
  // Ambience start / stop
  // ---------------------------------------------------------------------------

  const startAmbience = useCallback(() => {
    if (!musicEnabled || muted) return;
    try {
      const ctx = getCtx();
      const cfg = getAmbienceConfig(categoryRef.current);

      stopAmbienceNodes();

      const nodes: AudioNode[] = [];

      // Master gain
      const master = ctx.createGain();
      master.gain.value = cfg.masterGain * volume;
      masterGainRef.current = master;

      // Reverb
      const convolver = ctx.createConvolver();
      convolver.buffer = buildReverbBuffer(ctx, 3, 2.5);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = cfg.reverbWet;
      const dryGain = ctx.createGain();
      dryGain.gain.value = 1 - cfg.reverbWet * 0.5;

      // Filters
      const chain: AudioNode[] = [];
      if (cfg.hpCutoff > 0) {
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = cfg.hpCutoff;
        chain.push(hp);
        nodes.push(hp);
      }
      if (cfg.lpCutoff > 0) {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = cfg.lpCutoff;
        chain.push(lp);
        nodes.push(lp);
      }

      // LFO for tremolo
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = cfg.lfoRate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = cfg.lfoDepth * 0.5;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start();
      nodes.push(lfo, lfoGain);

      // Root drone + overtones
      const allOscs: [number, number][] = [[1, 1], ...cfg.overtones];
      allOscs.forEach(([mult, gainFrac]) => {
        const osc = ctx.createOscillator();
        osc.type = cfg.droneType;
        osc.frequency.value = cfg.rootHz * mult;

        // Slight detune for warmth
        osc.detune.value = (Math.random() - 0.5) * 8;

        const oscGain = ctx.createGain();
        oscGain.gain.value = gainFrac;

        osc.connect(oscGain);

        // Wire through filter chain
        let prev: AudioNode = oscGain;
        chain.forEach(f => {
          prev.connect(f);
          prev = f;
        });

        // Dry path
        prev.connect(dryGain);
        // Wet (reverb) path
        prev.connect(convolver);

        osc.start();
        nodes.push(osc, oscGain);
      });

      convolver.connect(reverbGain);
      reverbGain.connect(master);
      dryGain.connect(master);
      master.connect(ctx.destination);

      nodes.push(convolver, reverbGain, dryGain, master);
      ambienceNodesRef.current = nodes;

      // Fade in
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(
        cfg.masterGain * volume,
        ctx.currentTime + 2.5
      );

      setIsPlaying(true);
    } catch (e) {
      // Silently ignore
    }
  }, [musicEnabled, muted, volume]);

  const stopAmbience = useCallback(() => {
    try {
      if (masterGainRef.current && ctxRef.current) {
        const ctx = ctxRef.current;
        const master = masterGainRef.current;
        // Fade out before stopping
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
        setTimeout(() => {
          stopAmbienceNodes();
          setIsPlaying(false);
        }, 1300);
      } else {
        stopAmbienceNodes();
        setIsPlaying(false);
      }
    } catch {
      stopAmbienceNodes();
      setIsPlaying(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // React to muted / musicEnabled / volume changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (muted || !musicEnabled) {
      if (isPlaying) stopAmbience();
      // Also stop any SFX
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
        sfxAudioRef.current = null;
      }
    } else {
      if (!isPlaying) startAmbience();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, musicEnabled]);

  // Update master gain when volume changes without restarting
  useEffect(() => {
    if (masterGainRef.current && ctxRef.current) {
      const cfg = getAmbienceConfig(categoryRef.current);
      masterGainRef.current.gain.setTargetAtTime(
        cfg.masterGain * volume,
        ctxRef.current.currentTime,
        0.1
      );
    }
    // Also update SFX volume
    if (sfxAudioRef.current) {
      sfxAudioRef.current.volume = Math.min(1, volume * 1.2);
    }
  }, [volume]);

  // Restart ambience when category changes (new book genre)
  useEffect(() => {
    if (isPlaying) {
      stopAmbienceNodes();
      setIsPlaying(false);
      if (!muted && musicEnabled) {
        setTimeout(() => startAmbience(), 200);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAmbienceNodes();
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause();
        sfxAudioRef.current = null;
      }
      try {
        ctxRef.current?.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Setters that also persist
  // ---------------------------------------------------------------------------

  const setMuted = useCallback((v: boolean) => setMutedState(v), []);
  const setMusicEnabled = useCallback((v: boolean) => setMusicEnabledState(v), []);
  const setVolume = useCallback((v: number) => setVolumeState(v), []);

  return {
    muted,
    setMuted,
    musicEnabled,
    setMusicEnabled,
    volume,
    setVolume,
    isPlaying,
    playPageTurn,
    startAmbience,
    stopAmbience,
  };
}
