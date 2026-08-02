"use client";

import { useMemo, useState } from "react";
import type { Studio } from "@/lib/types";

const INITIAL_STUDIO_COUNT = 6;
const STUDIO_COUNT_STEP = 12;

type StudioGridClientProps = {
  labels: Record<string, string>;
  studios: Studio[];
};

export function StudioGridClient({ labels, studios }: StudioGridClientProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_STUDIO_COUNT);
  const visibleStudios = useMemo(
    () => studios.slice(0, visibleCount),
    [studios, visibleCount],
  );
  const hasMore = visibleCount < studios.length;

  return (
    <>
      <div className="atelier-studio-grid">
        {visibleStudios.map((studio, index) => (
          <article className="atelier-studio-tile" key={studio.id}>
            {studio.preview_url ? (
              <StudioPreview
                alt={studio.name}
                src={studio.card_preview_url ?? studio.preview_url}
              />
            ) : null}
            <a href={`/studios/${studio.slug}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <em>{labels[studio.slug] ?? "Портретная серия"}</em>
                <strong>{studio.name}</strong>
              </div>
            </a>
          </article>
        ))}
      </div>

      {hasMore ? (
        <div className="atelier-studio-more">
          <button
            className="atelier-load-more"
            onClick={() =>
              setVisibleCount((current) =>
                Math.min(current + STUDIO_COUNT_STEP, studios.length),
              )
            }
            type="button"
          >
            Показать ещё интерьеры
          </button>
        </div>
      ) : null}
    </>
  );
}

function StudioPreview({ alt, src }: { alt: string; src: string }) {
  return (
    <img
      alt={alt}
      decoding="async"
      fetchPriority="low"
      height={1000}
      loading="lazy"
      src={src}
      width={800}
    />
  );
}
