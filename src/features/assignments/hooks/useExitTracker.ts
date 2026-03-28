import { useEffect } from "react";

export function useExitTracker(sessionId: string | null, submitting: boolean, hasSubmitted: boolean) {
  useEffect(() => {
    if (!sessionId || submitting || hasSubmitted) return;

    // Report exit to server
    const reportExit = () => {
      fetch("/api/student-sessions/track-exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        keepalive: true, // ensure it fires even when unloading
      }).catch(console.error);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") reportExit();
      else if (document.visibilityState === "visible") {
        fetch("/api/student-sessions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "active" }),
        }).catch(console.error);
      }
    };

    const handleBlur = () => reportExit();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [sessionId, submitting, hasSubmitted]);
}
