"use client";

import { useEffect, useRef } from "react";

/** Muted looping promo that plays only while on screen and never for reduced-motion users. */
export function PromoVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    let pausedByUser = false;
    const onPause = () => {
      if (visible) pausedByUser = true;
    };
    const onPlay = () => {
      pausedByUser = false;
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (!visible) video.pause();
        else if (!pausedByUser) video.play().catch(() => {});
      },
      { threshold: 0.35 }
    );
    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-[24px] border-[3px] border-foreground bg-card shadow-[8px_8px_0_var(--dp-color-accent)] sm:rounded-[30px]">
      <video
        ref={ref}
        className="block aspect-video w-full bg-[var(--dp-color-ground)]"
        src="/promo/otpwave-promo.mp4"
        poster="/promo/otpwave-promo-poster.jpg"
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label="OtpWave in 20 seconds: a developer sends one API request, the verification code arrives in WhatsApp, and the user is verified."
      />
    </div>
  );
}
