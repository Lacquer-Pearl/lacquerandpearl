"use client";

import { useId } from "react";
import { LACQUERS, MOTIFS, PEARLS, SHAPES, motifOutline, motifParts, type MotifId } from "@/lib/data";
import { piecePearl, type Design, type PlacedPiece } from "@/lib/game";
import { NACRE_TILE, useNacreTexture } from "@/lib/nacre";

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
  selectedIds?: string[];
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

/** 같은 판자개에서도 조각마다 다른 자리·방향으로 오려낸 것처럼 보이게 하는 변형 (x, y, 회전) */
const NACRE_VARIANTS: [number, number, number][] = [
  [0, 0, 0],
  [37, 11, 90],
  [61, 53, 180],
  [13, 71, 270],
  [45, 29, 0],
  [79, 5, 90],
  [23, 41, 180],
  [55, 83, 270],
];

function hashKey(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function nacreFill(id: string, key?: string) {
  const k = key ? hashKey(key) % NACRE_VARIANTS.length : 0;
  return `url(#${k ? `${id}-${k}` : id})`;
}

/** 조각 방향에 따라 빛을 받는 정도 (-1 ~ 1) */
export function pieceLight(p: Pick<PlacedPiece, "id" | "r">) {
  return Math.sin(((p.r + (hashKey(p.id) % 360)) * Math.PI) / 90);
}

export function NacreDefs({ id, pearl, scale = 1 }: { id: string; pearl: Design["pearl"]; scale?: number }) {
  const tex = useNacreTexture(pearl);
  const stops = PEARLS[pearl].stops;
  return (
    <>
      <linearGradient id={`${id}-fb`} x1="0" y1="0" x2="1" y2="0.6">
        {stops.map((c, i) => (
          <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
        ))}
      </linearGradient>
      {NACRE_VARIANTS.map(([x, y, rot], k) => (
        <pattern
          key={k}
          id={k ? `${id}-${k}` : id}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
          width={NACRE_TILE}
          height={NACRE_TILE}
          patternTransform={`scale(${scale}) rotate(${rot})`}
        >
          {tex ? (
            <image href={tex} width={NACRE_TILE} height={NACRE_TILE} preserveAspectRatio="none" />
          ) : (
            <rect width={NACRE_TILE} height={NACRE_TILE} fill={`url(#${id}-fb)`} />
          )}
        </pattern>
      ))}
    </>
  );
}

/** 빛이 자개 위를 비스듬히 훑고 지나가는 반사광 */
export function SheenGradient({ id, animate = true, size = 300 }: { id: string; animate?: boolean; size?: number }) {
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1="0"
      y1="0"
      x2={size}
      y2={size * 0.8}
      gradientTransform={animate ? undefined : `translate(${-size * 0.18} ${-size * 0.14})`}
    >
      <stop offset="0" stopColor="#fff" stopOpacity="0" />
      <stop offset="0.4" stopColor="#a9d8d2" stopOpacity="0" />
      <stop offset="0.46" stopColor="#c9e6e2" stopOpacity="0.22" />
      <stop offset="0.5" stopColor="#fffdf6" stopOpacity="0.55" />
      <stop offset="0.54" stopColor="#ecc9d6" stopOpacity="0.22" />
      <stop offset="0.6" stopColor="#f3c2d0" stopOpacity="0" />
      <stop offset="1" stopColor="#fff" stopOpacity="0" />
      {animate && (
        <animateTransform
          attributeName="gradientTransform"
          type="translate"
          values={`${-size} ${-size * 0.8}; ${size} ${size * 0.8}; ${size} ${size * 0.8}`}
          keyTimes="0; 0.5; 1"
          dur="7s"
          repeatCount="indefinite"
        />
      )}
    </linearGradient>
  );
}

/** 문양별로 선각·점을 뚫어 내는 마스크. 마스크 좌표는 문양 좌표 그대로라 조각 배치와 무관합니다 */
export function MotifMasks({ id, motifs }: { id: string; motifs: MotifId[] }) {
  return (
    <>
      {[...new Set(motifs)].map((k) => {
        const m = MOTIFS[k];
        if (!m.detail && !m.holes) return null;
        return (
          <mask key={k} id={`${id}-${k}`} maskUnits="userSpaceOnUse" x="-50" y="-50" width="100" height="100">
            <rect x="-50" y="-50" width="100" height="100" fill="#fff" />
            {m.holes && <path d={m.holes} fill="#000" />}
            {m.detail && (
              <path
                d={m.detail}
                fill="none"
                stroke="#000"
                strokeWidth={m.detailWidth ?? 0.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </mask>
        );
      })}
    </>
  );
}

export function motifMask(id: string, motif: MotifId) {
  const m = MOTIFS[motif];
  return m.detail || m.holes ? `url(#${id}-${motif})` : undefined;
}

/** 문양 전체를 한 색으로 (그림자·마스크용) */
export function MotifSilhouette({ motif, color }: { motif: MotifId; color: string }) {
  const uid = useId().replace(/:/g, "");
  const stamp = MOTIFS[motif].stamp;
  if (stamp) {
    const mid = `sil${uid}`;
    return (
      <g>
        <defs>
          <mask id={mid} maskUnits="userSpaceOnUse" x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h}>
            <image href={stamp.src} x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} preserveAspectRatio="none" />
          </mask>
        </defs>
        <rect x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} fill={color} mask={`url(#${mid})`} />
      </g>
    );
  }
  return (
    <>
      {motifParts(motif).map((d, i) => (
        <path key={i} d={d} fill={color} />
      ))}
      {MOTIFS[motif].strokes?.map((st, i) => (
        <path
          key={`s${i}`}
          d={st.d}
          fill="none"
          stroke={color}
          strokeWidth={st.w}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </>
  );
}

/** 오려낸 자개: 옻칠과 같은 면에 박힌 이음새 · 판자개 결 · 선각은 뚫려 옻칠이 비칩니다 */
export function NacrePiece({
  motif,
  fill,
  mask,
  light = 0,
  s = 1,
  dull = 0,
  onPointerDown,
  style,
}: {
  motif: MotifId;
  fill: string;
  mask?: string;
  light?: number;
  s?: number;
  dull?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
  const stamp = MOTIFS[motif].stamp;
  const tint = light > 0 ? "#fffaf0" : "#120b08";
  const tintOpacity = Math.abs(light) * (light > 0 ? 0.07 : 0.1);
  const joint = 0.38 / s;
  const stampMask = stamp ? `nps${uid}` : undefined;
  return (
    <g mask={mask}>
      {stamp && (
        <defs>
          <mask id={stampMask} maskUnits="userSpaceOnUse" x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h}>
            <image href={stamp.src} x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} preserveAspectRatio="none" />
          </mask>
        </defs>
      )}
      {onPointerDown && (
        <path d={motifOutline(motif)} fill="transparent" onPointerDown={onPointerDown} style={style} />
      )}
      {MOTIFS[motif].strokes?.map((st, i) => (
        <g key={`s${i}`} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none">
          <path d={st.d} stroke="#0a0608" strokeOpacity="0.5" strokeWidth={st.w + 0.4 / s} />
          <path d={st.d} stroke={fill} strokeWidth={st.w} />
          {light !== 0 && <path d={st.d} stroke={tint} strokeOpacity={tintOpacity} strokeWidth={st.w} />}
          {dull > 0 && <path d={st.d} stroke="#a9a199" strokeOpacity={Math.min(0.75, dull)} strokeWidth={st.w} />}
        </g>
      ))}
      {stamp && (
        <g mask={`url(#${stampMask})`}>
          <rect
            x={stamp.x}
            y={stamp.y}
            width={stamp.w}
            height={stamp.h}
            fill={fill}
            onPointerDown={onPointerDown}
            style={style}
          />
          {light !== 0 && (
            <rect x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} fill={tint} opacity={tintOpacity} pointerEvents="none" />
          )}
          {dull > 0 && (
            <rect
              x={stamp.x}
              y={stamp.y}
              width={stamp.w}
              height={stamp.h}
              fill="#a9a199"
              opacity={Math.min(0.75, dull)}
              pointerEvents="none"
            />
          )}
        </g>
      )}
      {motifParts(motif).map((d, i) => (
        <g key={i}>
          <path d={d} fill={fill} onPointerDown={onPointerDown} style={style} />
          {light !== 0 && <path d={d} fill={tint} opacity={tintOpacity} pointerEvents="none" />}
          {dull > 0 && <path d={d} fill="#a9a199" opacity={Math.min(0.75, dull)} pointerEvents="none" />}
          <path d={d} fill="none" stroke="#0a0608" strokeOpacity="0.38" strokeWidth={joint} pointerEvents="none" />
        </g>
      ))}
    </g>
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
  selectedIds,
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
    sheen: `sh${uid}`,
    pieceMask: `pm${uid}`,
    cuts: `ct${uid}`,
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
  const pearls = [...new Set(showPieces ? list.map((p) => piecePearl(p, design)) : [])];

  return (
    <svg ref={svgRef} viewBox="0 0 300 300" className={className} style={{ touchAction: "none" }}>
      <defs>
        {pearls.map((pl) => (
          <NacreDefs key={pl} id={`${ids.nacre}-${pl}`} pearl={pl} />
        ))}
        <SheenGradient id={ids.sheen} animate={shimmer} />
        {showPieces && list.length > 0 && (
          <>
            <MotifMasks id={ids.cuts} motifs={list.map((p) => p.motif)} />
            <mask id={ids.pieceMask} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
              {list.map((p) => (
                <g key={p.id} transform={pieceTransform(p)} mask={motifMask(ids.cuts, p.motif)}>
                  <MotifSilhouette motif={p.motif} color="#fff" />
                </g>
              ))}
            </mask>
          </>
        )}
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
        {/* 삼베 단계 표면: 직물 격자 대신 한지·종이 질감 */}
        <pattern id={ids.hemp} width="28" height="28" patternUnits="userSpaceOnUse">
          <rect width="28" height="28" fill="#f1e6d2" />
          <rect width="28" height="28" fill="#e8d8be" opacity="0.35" />
          <path d="M0 6 Q7 4 14 7 T28 5" stroke="#d4c0a0" strokeWidth="1.2" fill="none" opacity="0.45" />
          <path d="M0 16 Q9 14 18 17 T28 15" stroke="#e9dfcc" strokeWidth="1.4" fill="none" opacity="0.55" />
          <path d="M0 24 Q8 22 16 25 T28 23" stroke="#cbb896" strokeWidth="0.9" fill="none" opacity="0.35" />
          <circle cx="5" cy="11" r="0.7" fill="#c9b48e" opacity="0.35" />
          <circle cx="19" cy="4" r="0.55" fill="#fffaf0" opacity="0.5" />
          <circle cx="22" cy="20" r="0.65" fill="#d2bc96" opacity="0.3" />
          <circle cx="11" cy="22" r="0.5" fill="#fff8ec" opacity="0.4" />
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
            <path d={motifOutline(p.motif)} fill="rgba(255,255,255,0.1)" stroke="rgba(20,10,5,0.5)" strokeWidth={3 / p.s} />
            <path
              d={motifOutline(p.motif)}
              fill="none"
              stroke="#f7efe0"
              strokeWidth={1.4 / p.s}
              strokeDasharray={`${3 / p.s} ${2.5 / p.s}`}
            />
          </g>
        ))}

        {showPieces &&
          list.map((p) => (
            <g key={p.id} transform={pieceTransform(p)}>
              <NacrePiece
                motif={p.motif}
                fill={nacreFill(`${ids.nacre}-${piecePearl(p, design)}`, p.id)}
                mask={motifMask(ids.cuts, p.motif)}
                light={pieceLight(p)}
                s={p.s}
                dull={dull}
                onPointerDown={onPiecePointerDown ? (e) => onPiecePointerDown(e, p) : undefined}
                style={onPiecePointerDown ? { cursor: "grab" } : undefined}
              />
              {(selectedId === p.id || selectedIds?.includes(p.id)) && (
                <path
                  d={motifOutline(p.motif)}
                  fill="none"
                  stroke="#e2c27a"
                  strokeWidth={2 / p.s}
                  strokeLinejoin="round"
                  className="pointer-events-none"
                />
              )}
            </g>
          ))}
        {showPieces && list.length > 0 && (
          <rect
            width="300"
            height="300"
            fill={`url(#${ids.sheen})`}
            mask={`url(#${ids.pieceMask})`}
            opacity={0.42 * (1 - Math.min(0.8, dull))}
            pointerEvents="none"
          />
        )}

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
