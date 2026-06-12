export const GROOBEY_WELCOME_VOICE_SRC = "/voice-notes/TLD_Groobey_Welcome_Note.mp3";

export const GROOBEY_WELCOME_VOICE_TEXT = "Welcome to TLD Groobey. You order. We deliver.";

const TAB_OPEN_KEY = "groobey-welcome-tab-opened";

let listenersAttached = false;
let played = false;
let autoTimer: number | undefined;

function isReloadNavigation() {
  if (typeof window === "undefined") return true;

  const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (entry?.type === "reload") return true;

  // Legacy fallback (older WebViews)
  const perf = performance as Performance & { navigation?: { type: number } };
  return perf.navigation?.type === 1;
}

function hasOpenedHomepageThisTab() {
  if (typeof window === "undefined") return true;
  return sessionStorage.getItem(TAB_OPEN_KEY) === "1";
}

function markHomepageOpenedThisTab() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TAB_OPEN_KEY, "1");
}

function shouldSkipWelcome() {
  return isReloadNavigation() || hasOpenedHomepageThisTab() || played;
}

function detachListeners(onGesture: () => void) {
  document.removeEventListener("touchstart", onGesture, true);
  document.removeEventListener("touchend", onGesture, true);
  document.removeEventListener("pointerdown", onGesture, true);
  document.removeEventListener("click", onGesture, true);
  if (autoTimer !== undefined) {
    window.clearTimeout(autoTimer);
    autoTimer = undefined;
  }
}

function tryPlay(audio: HTMLAudioElement, onGesture: () => void) {
  if (played) return;

  audio.currentTime = 0;

  const promise = audio.play();
  if (!promise) return;

  void promise
    .then(() => {
      played = true;
      markHomepageOpenedThisTab();
      detachListeners(onGesture);
    })
    .catch(() => {
      // Autoplay blocked - wait for the next tap/click.
    });
}

/**
 * Attach welcome voice playback to a mounted <audio> element.
 * Safe across React Strict Mode remounts (listeners stay until audio plays).
 */
export function mountWelcomeVoicePlayer(audio: HTMLAudioElement) {
  if (typeof window === "undefined" || shouldSkipWelcome()) return;

  audio.src = GROOBEY_WELCOME_VOICE_SRC;
  audio.preload = "auto";
  audio.volume = 1;
  audio.muted = false;
  audio.setAttribute("playsinline", "true");
  audio.setAttribute("webkit-playsinline", "true");
  void audio.load();

  if (listenersAttached) return;
  listenersAttached = true;

  const onGesture = () => {
    tryPlay(audio, onGesture);
  };

  autoTimer = window.setTimeout(() => {
    tryPlay(audio, onGesture);
  }, 800);

  document.addEventListener("touchstart", onGesture, { capture: true, passive: true });
  document.addEventListener("touchend", onGesture, { capture: true, passive: true });
  document.addEventListener("pointerdown", onGesture, { capture: true, passive: true });
  document.addEventListener("click", onGesture, { capture: true });
}

export function unmountWelcomeVoicePlayer(audio: HTMLAudioElement) {
  if (!played) return;

  audio.pause();
  audio.currentTime = 0;
}
