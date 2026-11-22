"use client";

import { useEffect, useRef, useState } from "react";
import type { Screen } from "@/lib/store";

const views = ["room", "entry", "bench", "shelf"] as const;
type View = typeof views[number];

const viewFor: Record<Screen, View> = {
  title: "room", board: "entry", craft: "bench", shop: "bench", result: "shelf", gallery: "shelf",
};

export default function WorkshopScene({ screen }: { screen: Screen }) {
  const target = viewFor[screen];
  const [shown, setShown] = useState<View>("room");
  const images = useRef<Partial<Record<View, HTMLImageElement | null>>>({});

  // Keep the current room visible until the next angle can actually be painted.
  useEffect(() => {
    let current = true;
    const image = images.current[target];
    if (image) void image.decode().then(() => {
      if (current) setShown(target);
    }).catch(() => {
      if (current && image.naturalWidth) setShown(target);
    });
    return () => { current = false; };
  }, [target]);

  return (
    <div className="workshop-scene" data-view={shown} aria-hidden="true">
      {views.map(view => (
        <picture key={view} className={`room-angle angle-${view}`} data-visible={view === shown}>
          {view === "room" && <source media="(max-aspect-ratio: 4/5)" srcSet="/images/workshop/room-portrait.webp" />}
          {/* The static export ships the native art direction selected by picture. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={image => { images.current[view] = image; }}
            src={`/images/workshop/${view}.webp`} alt="" decoding="async"
            fetchPriority={view === target ? "high" : "low"} />
        </picture>
      ))}
    </div>
  );
}
