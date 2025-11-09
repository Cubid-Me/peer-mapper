"use client";

import { useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "loading" | "ready" | "error" | "unsupported";

export default function QRScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatus("unsupported");
        setError("Camera access is not available in this browser.");
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          currentStream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (video) {
          video.srcObject = currentStream;
          const playPromise = video.play();
          if (playPromise && typeof playPromise.then === "function") {
            playPromise.catch(() => {
              /* ignore autoplay restrictions in tests */
            });
          }
        }

        setStatus("ready");
      } catch (err) {
        currentStream?.getTracks().forEach((track) => track.stop());
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to access the camera");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      currentStream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt]);

  const showOverlay = status === "loading" || status === "error" || status === "unsupported";

  return (
    <div className="space-y-3">
      <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-3xl border border-slate-700/60 bg-slate-950/80">
        <video
          aria-label="Camera preview"
          className="h-full w-full object-cover"
          muted
          playsInline
          ref={videoRef}
        />
        {showOverlay ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/80 text-center text-sm text-slate-200">
            {status === "loading" ? <span>Requesting camera access…</span> : null}
            {status === "error" || status === "unsupported" ? (
              <>
                <span>{error ?? "Camera unavailable"}</span>
                <button
                  className="rounded-full border border-sky-400/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-sky-100 transition hover:border-sky-300"
                  onClick={() => setAttempt((value) => value + 1)}
                  type="button"
                >
                  Try again
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Point a Cubid QR at your camera to scan it instantly.</p>
      {status === "ready" ? (
        <p className="text-xs text-slate-400">We keep the feed local—no footage leaves your device.</p>
      ) : null}
    </div>
  );
}
