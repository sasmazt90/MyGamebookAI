export interface ManagedAudioLike {
  pause: () => void;
  currentTime: number;
  src?: string;
  play?: () => Promise<void> | void;
}

export function stopManagedAudio(audio: ManagedAudioLike | null | undefined) {
  if (!audio) return;
  try {
    audio.pause();
  } catch {}
  try {
    audio.currentTime = 0;
  } catch {}
  if ("src" in audio) {
    try {
      audio.src = "";
    } catch {}
  }
}

export function clearManagedAudioTimeout(
  timeoutRef: { current: ReturnType<typeof setTimeout> | null },
) {
  if (!timeoutRef.current) return;
  clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
}

export function scheduleManagedAudioPlay(input: {
  audio: ManagedAudioLike;
  delayMs: number;
  playTokenRef: { current: number };
  token: number;
  timeoutRef: { current: ReturnType<typeof setTimeout> | null };
  isStillCurrent: () => boolean;
}) {
  clearManagedAudioTimeout(input.timeoutRef);
  input.timeoutRef.current = setTimeout(() => {
    input.timeoutRef.current = null;
    if (input.playTokenRef.current !== input.token) return;
    if (!input.isStillCurrent()) return;
    try {
      const result = input.audio.play?.();
      if (result && typeof (result as Promise<void>).catch === "function") {
        (result as Promise<void>).catch(() => {});
      }
    } catch {}
  }, input.delayMs);
}
