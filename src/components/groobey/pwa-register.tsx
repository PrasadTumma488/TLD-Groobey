import { useEffect } from "react";

/** Registers the service worker on the client only (SSR-safe). */
export function PwaRegister() {
  useEffect(() => {
    void import("virtual:pwa-register").then(({ registerSW }) => {
      const update = registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          const intervalMs = 60 * 60 * 1000;
          window.setInterval(() => {
            void registration.update();
          }, intervalMs);
        },
        onRegisterError(error) {
          console.warn("[groobey-pwa] Service worker registration failed:", error);
        },
      });
      void update;
    });
  }, []);

  return null;
}
