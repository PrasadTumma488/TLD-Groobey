import { useCallback, useEffect, useRef } from "react";

import {
  GROOBEY_WELCOME_VOICE_SRC,
  GROOBEY_WELCOME_VOICE_TEXT,
  mountWelcomeVoicePlayer,
  unmountWelcomeVoicePlayer,
} from "@/lib/groobey-welcome-voice";

/** Homepage welcome voice - first tab open only (not on reload). */
export function GroobeyWelcomeVoice() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleAudioRef = useCallback((node: HTMLAudioElement | null) => {
    if (audioRef.current && audioRef.current !== node) {
      unmountWelcomeVoicePlayer(audioRef.current);
    }

    audioRef.current = node;

    if (node) {
      mountWelcomeVoicePlayer(node);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        unmountWelcomeVoicePlayer(audioRef.current);
      }
    };
  }, []);

  return (
    <audio
      ref={handleAudioRef}
      className="sr-only"
      src={GROOBEY_WELCOME_VOICE_SRC}
      preload="auto"
      playsInline
      aria-label={GROOBEY_WELCOME_VOICE_TEXT}
    />
  );
}
