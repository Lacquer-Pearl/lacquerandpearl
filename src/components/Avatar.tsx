"use client";

import { useState } from "react";
import type { CustomerDef } from "@/lib/data";

export type Mood = "happy" | "neutral" | "sad" | "wow";

export default function Avatar({
  c,
  mood = "neutral",
  className,
  portrait,
}: {
  c: CustomerDef;
  mood?: Mood;
  className?: string;
  portrait?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const master = className?.split(/\s+/).includes("master");
  if (portrait && failedSrc !== portrait) {
    return (
      <img
        src={portrait}
        alt=""
        decoding="async"
        draggable={false}
        className={master ? "npc-portrait master" : "npc-portrait"}
        onError={() => setFailedSrc(portrait)}
      />
    );
  }
  const mouth =
    mood === "happy"
      ? "M42 66 Q50 74 58 66"
      : mood === "sad"
        ? "M43 70 Q50 64 57 70"
        : mood === "wow"
          ? ""
          : "M44 67 Q50 70 56 67";
  return (
    <svg viewBox="0 0 100 100" className={className}>
      {/* 몸 (한복) */}
      <path d="M20 100 Q22 78 50 76 Q78 78 80 100 Z" fill={c.outfit} stroke="#6b4430" strokeWidth="2.5" />
      <path d="M50 77 L40 92 M50 77 L60 92" stroke="#6b4430" strokeWidth="2" fill="none" />
      <path d="M44 86 Q50 90 56 86 L58 98 L50 92 L42 98 Z" fill="#f28b9b" stroke="#6b4430" strokeWidth="1.5" />
      {/* 뒷머리 */}
      {c.hat === "daenggi" || c.hat === "jokduri" ? (
        <circle cx="50" cy="46" r="27" fill={c.hair} />
      ) : null}
      {/* 얼굴 */}
      <circle cx="50" cy="50" r="24" fill={c.skin} stroke="#6b4430" strokeWidth="2.5" />
      {/* 앞머리 */}
      <path d="M26 46 Q30 22 50 24 Q70 22 74 46 Q66 34 50 34 Q34 34 26 46 Z" fill={c.hair} />
      {/* 눈 */}
      {mood === "happy" ? (
        <>
          <path d="M37 52 Q41 47 45 52" stroke="#3a2a22" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M55 52 Q59 47 63 52" stroke="#3a2a22" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="41" cy="52" rx="3" ry={mood === "wow" ? 4.2 : 3.6} fill="#3a2a22" />
          <ellipse cx="59" cy="52" rx="3" ry={mood === "wow" ? 4.2 : 3.6} fill="#3a2a22" />
          <circle cx="42" cy="50.6" r="1.1" fill="#fff" />
          <circle cx="60" cy="50.6" r="1.1" fill="#fff" />
        </>
      )}
      {/* 볼터치 */}
      <ellipse cx="34" cy="60" rx="5" ry="3" fill="#ff9fb0" opacity="0.7" />
      <ellipse cx="66" cy="60" rx="5" ry="3" fill="#ff9fb0" opacity="0.7" />
      {mood === "wow" ? (
        <ellipse cx="50" cy="68" rx="3.5" ry="4.5" fill="#c0505f" />
      ) : (
        <path d={mouth} stroke="#6b4430" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* 모자 */}
      {c.hat === "gat" && (
        <g>
          <ellipse cx="50" cy="30" rx="34" ry="6" fill="#2a2120" opacity="0.85" />
          <path d="M38 30 Q38 12 50 12 Q62 12 62 30 Z" fill="#2a2120" />
          <path d="M28 34 Q26 60 30 70 M72 34 Q74 60 70 70" stroke="#2a2120" strokeWidth="1.2" fill="none" />
        </g>
      )}
      {c.hat === "jokduri" && (
        <g>
          <path d="M40 26 L44 16 L56 16 L60 26 Z" fill="#3a2b55" stroke="#6b4430" strokeWidth="1.5" />
          <circle cx="50" cy="14" r="3" fill="#f2c66d" />
          <circle cx="44" cy="20" r="1.6" fill="#ff8fab" />
          <circle cx="56" cy="20" r="1.6" fill="#8fd3c3" />
        </g>
      )}
      {c.hat === "daenggi" && (
        <g>
          <path d="M70 52 Q84 60 80 80" stroke={c.hair} strokeWidth="7" fill="none" strokeLinecap="round" />
          <path d="M76 78 L88 84 L80 90 Z" fill="#e5484d" />
        </g>
      )}
      {c.hat === "beret" && (
        <g>
          <ellipse cx="46" cy="27" rx="22" ry="9" fill="#e5484d" stroke="#6b4430" strokeWidth="1.5" />
          <circle cx="46" cy="18" r="2.5" fill="#e5484d" />
        </g>
      )}
      {c.hat === "none" && (
        <g>
          <circle cx="50" cy="20" r="9" fill={c.hair} />
          <path d="M40 20 H60" stroke="#f2c66d" strokeWidth="2.5" />
        </g>
      )}
    </svg>
  );
}
