import { describe, expect, it, vi } from "vitest";
import {
  clearManagedAudioTimeout,
  scheduleManagedAudioPlay,
  stopManagedAudio,
} from "../shared/audioPlayback";

describe("audio playback lifecycle", () => {
  it("stops and rewinds the previous audio instance during cleanup", () => {
    const pause = vi.fn();
    const audio = { pause, currentTime: 12, src: "test.ogg" };

    stopManagedAudio(audio);

    expect(pause).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(0);
    expect(audio.src).toBe("");
  });

  it("cancels stale delayed playback when the token changes", () => {
    vi.useFakeTimers();
    const play = vi.fn();
    const timeoutRef = { current: null as ReturnType<typeof setTimeout> | null };
    const playTokenRef = { current: 1 };
    const audio = { pause: vi.fn(), currentTime: 0, play };

    scheduleManagedAudioPlay({
      audio,
      delayMs: 320,
      playTokenRef,
      token: 1,
      timeoutRef,
      isStillCurrent: () => true,
    });

    playTokenRef.current = 2;
    clearManagedAudioTimeout(timeoutRef);
    vi.advanceTimersByTime(500);

    expect(play).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
