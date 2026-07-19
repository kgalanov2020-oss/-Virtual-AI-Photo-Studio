"use client";

import { useEffect, useRef, useState } from "react";

type LazyAutoplayVideoProps = {
  src: string;
};

export function LazyAutoplayVideo({ src }: LazyAutoplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || shouldLoad) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "500px 0px" },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !videoRef.current) {
      return;
    }

    void videoRef.current.play().catch(() => {
      // Browsers may still block autoplay despite muted video; the poster remains visible.
    });
  }, [shouldLoad]);

  return (
    <video
      aria-hidden="true"
      autoPlay
      loop
      muted
      onLoadedData={() => setIsReady(true)}
      onPlaying={() => setIsReady(true)}
      playsInline
      preload="none"
      ref={videoRef}
      src={shouldLoad ? src : undefined}
      style={{ opacity: isReady ? 1 : 0 }}
    />
  );
}
