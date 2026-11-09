"use client";

import { useId } from "react";
import { LACQUERS, MOTIFS, PEARLS, SHAPES } from "@/lib/data";
import type { Design, PlacedPiece } from "@/lib/game";

export type Surface = "wood" | "hemp" | "lacquer";

export interface ArtworkProps {
  design: Design;
  surface?: Surface;
  showPieces?: boolean;
  /** 점선 밑그림으로 표시할 자개 위치 */
  ghosts?: PlacedPiece[];
  /** 0~1 광택 */
  gloss?: number;
  /** 0~1 자개 광택 손실 */
  dull?: number;
  pieces?: PlacedPiece[];
  selectedId?: string;
  className?: string;
  shimmer?: boolean;
  shadow?: boolean;
  children?: React.ReactNode;
  onPiecePointerDown?: (e: React.PointerEvent, piece: PlacedPiece) => void;
  svgRef?: React.Ref<SVGSVGElement>;
}

export function pieceTransform(p: Pick<PlacedPiece, "x" | "y" | "r" | "s">) {
  return `translate(${p.x} ${p.y}) rotate(${p.r}) scale(${p.s})`;
}

export function NacreDefs({ id, pearl, shimmer = true }: { id: string; pearl: Design["pearl"]; shimmer?: boolean }) {
  const stops = PEARLS[pearl].stops;
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      {stops.map((c, i) => (
        <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
      ))}
      {shimmer && (
        <animateTransform
          attributeName="gradientTransform"
          type="rotate"
          from="0 0.5 0.5"
          to="360 0.5 0.5"
          dur="9s"
          repeatCount="indefinite"
        />
      )}
    </linearGradient>
  );
}

/** 자개 특유의 물결 같은 결과 무지갯빛 번짐 */
export function NacreTexture({ id, pearl }: { id: string; pearl: Design["pearl"] }) {
  const strong = pearl === "abalone";
  return (
    <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.09 0.022" numOctaves="3" seed="11" result="n" />
      <feColorMatrix
        in="n"
        type="matrix"
        values={
          strong
            ? "2.2 -0.6 -0.6 0 -0.15  -0.6 2.2 -0.6 0 -0.15  -0.6 -0.6 2.2 0 -0.1  0 0 0 0 0.75"
            : "1.8 -0.45 -0.45 0 -0.02  -0.45 1.8 -0.45 0 -0.02  -0.45 -0.45 1.8 0 0.02  0 0 0 0 0.65"
        }
        result="rainbow"
      />
      <feComposite in="rainbow" in2="SourceAlpha" operator="in" result="tex" />
      <feBlend in="tex" in2="SourceGraphic" mode="overlay" result="mixed" />
      <feComposite in="mixed" in2="SourceAlpha" operator="in" />
    </filter>
  );
}

export default function Artwork({
  design,
  surface = "lacquer",
  showPieces = true,
  ghosts,
  gloss = 0.6,
  dull = 0,
  pieces,
  selectedId,
  className,
  shimmer = true,
  shadow = true,
  children,
  onPiecePointerDown,
  svgRef,
}: ArtworkProps) {
  const uid = useId().replace(/:/g, "");
  const shape = SHAPES[design.shape];
  const lac = LACQUERS[design.lacquer];
  const list = pieces ?? design.pieces;
  const ids = {
    nacre: `n${uid}`,
    nacreTex: `nt${uid}`,
    lac: `l${uid}`,
    lacEdge: `le${uid}`,
    clip: `c${uid}`,
    wood: `w${uid}`,
    hemp: `h${uid}`,
    grain: `gr${uid}`,
    micro: `mi${uid}`,
    blur: `b${uid}`,
    shadow: `s${uid}`,
    soft: `so${uid}`,
    rim: `r${uid}`,
  };
  const isLac = surface === "lacquer";

  return (
    <svg ref={svgRef} viewBox="0 0 300 300" className={className} style={{ touchAction: "none" }}>
      <defs>
        <NacreDefs id={ids.nacre} pearl={design.pearl} shimmer={shimmer} />
        <NacreTexture id={ids.nacreTex} pearl={design.pearl} />
        <radialGradient id={ids.lac} cx="0.38" cy="0.32" r="0.85">
          <stop offset="0" stopColor={lac.light} />
          <stop offset="0.45" stopColor={lac.color} />
          <stop offset="1" stopColor={lac.deep} />
        </radialGradient>
        <radialGradient id={ids.lacEdge} cx="0.5" cy="0.5" r="0.55">
          <stop offset="0.78" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id={ids.rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={isLac ? 0.45 : 0.35} />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={ids.wood} x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor="#c99a66" />
          <stop offset="0.5" stopColor="#d8ad78" />
          <stop offset="1" stopColor="#bf8d58" />
        </linearGradient>
        <filter id={ids.grain} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.11" numOctaves="4" seed="7" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.36  0 0 0 0 0.21  0 0 0 0 0.1  2.4 0 0 0 -0.95" />
        </filter>
        <pattern id={ids.hemp} width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#dccaa4" />
          <rect y="0.6" width="5" height="1.5" fill="#cdb88c" />
          <rect x="0.6" width="1.4" height="5" fill="#e6d6b4" opacity="0.8" />
          <rect x="3" y="3" width="1.6" height="1.4" fill="#c4ad80" opacity="0.6" />
        </pattern>
        <filter id={ids.micro} x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 -0.35" />
        </filter>
        <filter id={ids.blur} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={ids.soft} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id={ids.shadow} x="-20%" y="-20%" width="140%" height="150%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <clipPath id={ids.clip}>
          <path d={shape.path} />
        </clipPath>
      </defs>

      {shadow && (
        <path d={shape.path} transform="translate(3 9)" fill="#1a0f0a" opacity="0.45" filter={`url(#${ids.shadow})`} />
      )}

      <g clipPath={`url(#${ids.clip})`}>
        {surface === "wood" && (
          <>
            <rect width="300" height="300" fill={`url(#${ids.wood})`} />
            <rect width="300" height="300" filter={`url(#${ids.grain})`} opacity="0.85" />
          </>
        )}
        {surface === "hemp" && (
          <>
            <rect width="300" height="300" fill={`url(#${ids.hemp})`} />
            <rect width="300" height="300" filter={`url(#${ids.grain})`} opacity="0.18" />
          </>
        )}
        {isLac && (
          <>
            <rect width="300" height="300" fill={`url(#${ids.lac})`} />
            <rect width="300" height="300" filter={`url(#${ids.micro})`} opacity="0.05" />
          </>
        )}

        {ghosts?.map((p) => (
          <g key={`g${p.id}`} transform={pieceTransform(p)} pointerEvents="none">
            <path d={MOTIFS[p.motif].path} fill="rgba(255,255,255,0.1)" stroke="rgba(20,10,5,0.5)" strokeWidth={3 / p.s} />
            <path
              d={MOTIFS[p.motif].path}
              fill="none"
              stroke="#f7efe0"
              strokeWidth={1.4 / p.s}
              strokeDasharray={`${3 / p.s} ${2.5 / p.s}`}
            />
          </g>
        ))}

        {showPieces &&
          list.map((p) => {
            const m = MOTIFS[p.motif];
            return (
              <g key={p.id} transform={pieceTransform(p)}>
                <path d={m.path} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth={1.6 / p.s} />
                <path
                  d={m.path}
                  fill={`url(#${ids.nacre})`}
                  filter={`url(#${ids.nacreTex})`}
                  onPointerDown={onPiecePointerDown ? (e) => onPiecePointerDown(e, p) : undefined}
                  style={onPiecePointerDown ? { cursor: "grab" } : undefined}
                />
                <path d={m.path} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth={0.5 / p.s} pointerEvents="none" />
                {dull > 0 && <path d={m.path} fill="#a9a199" opacity={Math.min(0.75, dull)} pointerEvents="none" />}
                {selectedId === p.id && (
                  <path d={m.path} fill="none" stroke="#e2c27a" strokeWidth={2.4 / p.s} className="pointer-events-none" />
                )}
              </g>
            );
          })}

        {isLac && (
          <g pointerEvents="none">
            <rect width="300" height="300" fill={`url(#${ids.lacEdge})`} />
            {gloss > 0 && (
              <>
                <ellipse
                  cx="95"
                  cy="70"
                  rx="95"
                  ry="34"
                  transform="rotate(-28 95 70)"
                  fill="#fff"
                  opacity={0.16 * gloss}
                  filter={`url(#${ids.blur})`}
                />
                <path
                  d="M40 120 Q120 40 230 30"
                  stroke="#fff"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.22 * gloss}
                  filter={`url(#${ids.shadow})`}
                />
                <path d="M78 80 Q118 52 160 44" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity={0.18 * gloss} filter={`url(#${ids.soft})`} />
                <ellipse cx="225" cy="235" rx="60" ry="18" transform="rotate(-28 225 235)" fill="#fff" opacity={0.05 * gloss} filter={`url(#${ids.blur})`} />
              </>
            )}
          </g>
        )}
      </g>

      <path d={shape.path} fill="none" stroke={isLac ? lac.deep : "#7a5636"} strokeWidth="5" pointerEvents="none" />
      <path d={shape.path} fill="none" stroke={`url(#${ids.rim})`} strokeWidth="3.5" pointerEvents="none" />
      <path
        d={shape.path}
        fill="none"
        stroke="#fff"
        strokeOpacity={isLac ? 0.12 : 0.2}
        strokeWidth="1"
        transform="translate(150 150) scale(0.97) translate(-150 -150)"
        pointerEvents="none"
      />
      {children}
    </svg>
  );
}
