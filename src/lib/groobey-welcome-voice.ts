export const GROOBEY_WELCOME_VOICE_SRC = "/voice-notes/TLD_Groobey_Welcome_Note.mp3";

export const GROOBEY_WELCOME_VOICE_TEXT = "Welcome to TLD Groobey. You order. We deliver.";

const SESSION_PLAYED_KEY = "groobey-welcome-voice-played";

let listenersAttached = false;
let played = false;
let autoTimer: number | undefined;

function hasPlayedThisSession() {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(SESSION_PLAYED_KEY) === "1";
}

function markPlayedThisSession() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_PLAYED_KEY, "1");
}

function shouldSkipWelcome() {
  return played || hasPlayedThisSession();
}

function detachListeners(onGesture: () => void) {
  document.removeEventListener("touchstart", onGesture, true);
  document.removeEventListener("touchend", onGesture, true);
  document.removeEventListener("pointerdown", onGesture, true);
  document.removeEventListener("click", onGesture, true);
  document.removeEventListener("keydown", onGesture, true);
  document.removeEventListener("visibilitychange", onVisibility);
  if (autoTimer !== undefined) {
    window.clearTimeout(autoTimer);
    autoTimer = undefined;
  }
}

function onVisibility() {
  if (document.visibilityState !== "visible") return;
  const audio = document.querySelector<HTMLAudioElement>('audio[data-groobey-welcome="1"]');
  if (audio) tryPlay(audio, () => {});
}

function tryPlay(audio: HTMLAudioElement, onGesture: () => void) {
  if (played || shouldSkipWelcome()) return;

  audio.currentTime = 0;
  audio.muted = false;
  audio.volume = 1;

  const promise = audio.play();
  if (!promise) return;

  void promise
    .then(() => {
      played = true;
      markPlayedThisSession();
      detachListeners(onGesture);
    })
    .catch(() => {
      // Autoplay blocked — next tap, click, or key press will retry.
    });
}

/**
 * Attach welcome voice playback to a mounted <audio> element.
 * Plays once per browser tab session (mobile + desktop), after autoplay or first gesture.
 */
export function mountWelcomeVoicePlayer(audio: HTMLAudioElement) {
  if (typeof window === "undefined" || shouldSkipWelcome()) return;

  audio.dataset.groobeyWelcome = "1";
  audio.src = GROOBEY_WELCOME_VOICE_SRC;
  audio.preload = "auto";
  audio.volume = 1;
  audio.muted = false;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  void audio.load();

  if (listenersAttached) {
    autoTimer = window.setTimeout(() => tryPlay(audio, () => {}), 400);
    return;
  }
  listenersAttached = true;

  const onGesture = () => {
    tryPlay(audio, onGesture);
  };

  autoTimer = window.setTimeout(() => {
    tryPlay(audio, onGesture);
  }, 500);

  document.addEventListener("touchstart", onGesture, { capture: true, passive: true });
  document.addEventListener("touchend", onGesture, { capture: true, passive: true });
  document.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
  document.addEventListener("click", onGesture, { capture: true });
  document.addEventListener("keydown", onGesture, { capture: true });
  document.addEventListener("visibilitychange", onVisibility);
}

export function unmountWelcomeVoicePlayer(audio: HTMLAudioElement) {
  if (!played) return;

  audio.pause();
  audio.currentTime = 0;
}
