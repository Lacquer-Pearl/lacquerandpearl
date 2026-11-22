"use client";

import { useId, useSyncExternalStore } from "react";
import { LACQUERS, MOTIFS, PEARLS, SHAPES, motifOutline, motifParts, type MotifId } from "@/lib/data";
import { hasBrokenShape, pointsToPath } from "@/lib/cutFragments";
import { piecePearl, type Design, type PlacedPiece } from "@/lib/game";
import { NACRE_TILE, useNacreTexture } from "@/lib/nacre";

const FINISH_MARK_OPACITY = 0.8;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function subscribeMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

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
  showcase?: boolean;
  shadow?: boolean;
  children?: React.ReactNode;
  onPiecePointerDown?: (e: React.PointerEvent, piece: PlacedPiece) => void;
  svgRef?: React.Ref<SVGSVGElement>;
}

function hexToHsl(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const sector = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (sector * 60 + 360) % 360, s, l };
}

function hslToHex(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  const ch = (v: number) =>
    Math.round(Math.min(255, Math.max(0, (v + m) * 255)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r)}${ch(g)}${ch(b)}`;
}

/** 색상은 유지한 채 명도만 크게 낮춘 테두리. 검정은 이미 어두우므로 더 죽이지 않는다. */
function darkenedRim(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  if (s < 0.2) return { body: hex, shadow: hslToHex(h, s, Math.max(0.02, l * 0.4)) };
  const bodyL = Math.max(0.09, l - 0.22);
  return { body: hslToHex(h, s, bodyL), shadow: hslToHex(h, s, Math.max(0.045, bodyL * 0.5)) };
}

function liftedLight(hex: string) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, Math.min(1, s * 0.92), Math.min(0.84, l + 0.1));
}

export function pieceTransform(p: Pick<PlacedPiece, "x" | "y" | "r" | "s"> & { flipX?: boolean }) {
  const sx = p.flipX ? -p.s : p.s;
  return `translate(${p.x} ${p.y}) rotate(${p.r}) scale(${sx} ${p.s})`;
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

/** 완성품을 비추는 하나의 창빛을 옻면과 자개가 함께 반사합니다. */
function ShowcaseReflection() {
  return (
    <animateTransform
      attributeName="gradientTransform"
      type="translate"
      values="-95 -70; 95 70; -95 -70"
      keyTimes="0; 0.5; 1"
      calcMode="spline"
      keySplines="0.42 0 0.58 1; 0.42 0 0.58 1"
      dur="8s"
      repeatCount="indefinite"
    />
  );
}

/** 빛이 자개 위를 비스듬히 훑고 지나가는 반사광 */
export function SheenGradient({
  id, animate = true, size = 300, showcase = false,
}: {
  id: string;
  animate?: boolean;
  size?: number;
  showcase?: boolean;
}) {
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
      {/* 살짝 따뜻한 진주 광택 — 누렇지 않고 고급스럽게 */}
      <stop offset="0" stopColor="#f2f0ec" stopOpacity="0" />
      <stop offset="0.4" stopColor="#9ecfc8" stopOpacity="0" />
      <stop offset="0.46" stopColor="#c5e4de" stopOpacity="0.28" />
      <stop offset="0.5" stopColor="#faf7f2" stopOpacity="0.62" />
      <stop offset="0.54" stopColor="#d4c4e0" stopOpacity="0.26" />
      <stop offset="0.6" stopColor="#c8b8c4" stopOpacity="0" />
      <stop offset="1" stopColor="#f2f0ec" stopOpacity="0" />
      {animate && showcase && <ShowcaseReflection />}
      {animate && !showcase && (
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
          <mask id={mid} maskUnits="userSpaceOnUse" mask-type="alpha" x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h}>
            <image href={stamp.src} x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} preserveAspectRatio="xMidYMid meet" />
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
          <mask id={stampMask} maskUnits="userSpaceOnUse" mask-type="alpha" x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h}>
            <image href={stamp.src} x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} preserveAspectRatio="xMidYMid meet" />
          </mask>
        </defs>
      )}
      {onPointerDown && (
        <path
          d={motifOutline(motif)}
          fill="transparent"
          stroke="transparent"
          strokeWidth={stamp ? 2.4 / s : 0}
          onPointerDown={onPointerDown}
          style={style}
        />
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
        <g mask={`url(#${stampMask})`} pointerEvents="none">
          <rect x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} fill={fill} />
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

function ClipMask({ id, points }: { id: string; points: { x: number; y: number }[] }) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-180" y="-180" width="360" height="360">
      <path d={pointsToPath(points)} fill="#fff" fillRule="evenodd" />
    </mask>
  );
}

function SilhouetteMask({ id, motif }: { id: string; motif: MotifId }) {
  const stamp = MOTIFS[motif].stamp;
  if (stamp) {
    return (
      <mask id={id} maskUnits="userSpaceOnUse" mask-type="alpha" x={stamp.x - 2} y={stamp.y - 2} width={stamp.w + 4} height={stamp.h + 4}>
        <image href={stamp.src} x={stamp.x} y={stamp.y} width={stamp.w} height={stamp.h} preserveAspectRatio="xMidYMid meet" />
      </mask>
    );
  }
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x="-90" y="-90" width="180" height="180">
      <MotifSilhouette motif={motif} color="#fff" />
    </mask>
  );
}

function CrackInk({ motif, lines, prefix }: { motif: MotifId; lines: { x: number; y: number }[][]; prefix: string }) {
  const drawn = lines.filter((line) => line.length > 1);
  if (!drawn.length) return null;
  return (
    <g pointerEvents="none">
      <SilhouetteMask id={`${prefix}-ink`} motif={motif} />
      <g mask={`url(#${prefix}-ink)`}>
        {drawn.map((line, index) => (
          <polyline
            key={index}
            points={line.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="#24140f"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {drawn.map((line, index) => (
          <polyline
            key={`edge-${index}`}
            points={line.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="#f4e4c4"
            strokeOpacity="0.8"
            strokeWidth="0.28"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </g>
  );
}

/** 온전한 자개와, 균열 클립으로 나뉜 자개를 같은 텍스처로 그린다. */
export function PieceGraphics({
  piece,
  fill,
  mask,
  light = 0,
  s = 1,
  dull = 0,
  onPointerDown,
  style,
  clipPrefix,
  selected = false,
}: {
  piece: PlacedPiece;
  fill: string;
  mask?: string;
  light?: number;
  s?: number;
  dull?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  style?: React.CSSProperties;
  clipPrefix: string;
  selected?: boolean;
}) {
  const state = piece.breakState;
  const cracks = state ? [state.crack, ...(state.extraCracks ?? [])] : [];
  if (!hasBrokenShape(piece) || !state) {
    return (
      <g opacity={state?.condition === "scrapped" ? 0.5 : 1}>
        <NacrePiece
          motif={piece.motif}
          fill={fill}
          mask={mask}
          light={light}
          s={s}
          dull={dull}
          onPointerDown={onPointerDown}
          style={style}
        />
        {state?.condition === "scrapped" && <CrackInk motif={piece.motif} lines={cracks} prefix={`${clipPrefix}-ruin`} />}
        {selected && (
          <path d={motifOutline(piece.motif)} fill="none" stroke="#e2c27a" strokeWidth={2 / s} strokeLinejoin="round" className="pointer-events-none" />
        )}
      </g>
    );
  }
  return (
    <>
      {state.fragments.map((frag, index) => (
        <g key={frag.id} transform={`translate(${frag.dx} ${frag.dy}) rotate(${frag.r})`}>
          <ClipMask id={`${clipPrefix}-${frag.id}`} points={state.clips[index]} />
          <g mask={`url(#${clipPrefix}-${frag.id})`}>
            <NacrePiece
              motif={piece.motif}
              fill={fill}
              mask={mask}
              light={light}
              s={s}
              dull={dull}
              onPointerDown={onPointerDown}
              style={style}
            />
            <CrackInk motif={piece.motif} lines={cracks} prefix={`${clipPrefix}-${frag.id}`} />
            {selected && (
              <path d={motifOutline(piece.motif)} fill="none" stroke="#e2c27a" strokeWidth={2 / s} strokeLinejoin="round" className="pointer-events-none" />
            )}
          </g>
        </g>
      ))}
    </>
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
  shimmer: requestedShimmer = true,
  showcase = false,
  shadow = true,
  children,
  onPiecePointerDown,
  svgRef,
}: ArtworkProps) {
  const reduceMotion = useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true);
  const shimmer = requestedShimmer && !reduceMotion;
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
    inset: `in${uid}`,
    soft: `so${uid}`,
    rim: `r${uid}`,
    rimHi: `rh${uid}`,
  };
  const isLac = surface === "lacquer";
  const overallDull = design.finish?.sand ? 0 : dull;
  const reflectedLight = showcase && gloss > 0 ? 0.18 + 0.82 * gloss : gloss;
  const rimTone = darkenedRim(lac.color);
  const rimHighlight = liftedLight(lac.light);
  const pearls = [...new Set(showPieces ? list.map((p) => piecePearl(p, design)) : [])];

  return (
    <svg ref={svgRef} viewBox="0 0 300 300" className={className} style={{ touchAction: "none" }}>
      <defs>
        {pearls.map((pl) => (
          <NacreDefs key={pl} id={`${ids.nacre}-${pl}`} pearl={pl} />
        ))}
        <SheenGradient id={ids.sheen} animate={shimmer} showcase={showcase} />
        {showPieces && list.length > 0 && (
          <>
            <MotifMasks id={ids.cuts} motifs={list.map((p) => p.motif)} />
            <mask id={ids.pieceMask} maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
              {list.map((p) =>
                hasBrokenShape(p) ? null : (
                  <g key={p.id} transform={pieceTransform(p)} mask={motifMask(ids.cuts, p.motif)}>
                    <MotifSilhouette motif={p.motif} color="#fff" />
                  </g>
                ),
              )}
            </mask>
          </>
        )}
        {/* 본색 위주 — 원형 하이라이트 없이 가장자리만 살짝 어둡게 */}
        <radialGradient id={ids.lac} cx="0.5" cy="0.45" r="0.85">
          <stop offset="0" stopColor={lac.color} />
          <stop offset="0.7" stopColor={lac.color} />
          <stop offset="1" stopColor={lac.deep} />
        </radialGradient>
        <radialGradient id={ids.lacEdge} cx="0.5" cy="0.5" r="0.58">
          <stop offset="0.78" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.42" />
        </radialGradient>
        {/* 면 전반 옅은 명암 — 좌상 밝음 → 우하 그림자 */}
        <linearGradient id={`${ids.lac}-base`} x1="0.12" y1="0.08" x2="0.92" y2="0.96">
          <stop offset="0" stopColor="#faf8f4" stopOpacity={0.16 * gloss} />
          <stop offset="0.28" stopColor="#faf7f2" stopOpacity={0.07 * gloss} />
          <stop offset="0.55" stopColor="#faf7f2" stopOpacity={0.02 * gloss} />
          <stop offset="0.78" stopColor="#1a0f0a" stopOpacity={0.05 * gloss} />
          <stop offset="1" stopColor="#1a0f0a" stopOpacity={0.14 * gloss} />
        </linearGradient>
        {/* 테두리 유광 하이라이트 (프레넬) */}
        <radialGradient id={`${ids.lac}-rimLight`} cx="0.5" cy="0.5" r="0.74">
          <stop offset="0.62" stopColor="#faf7f2" stopOpacity="0" />
          <stop offset="0.84" stopColor="#faf7f2" stopOpacity={0.03 * gloss} />
          <stop offset="0.93" stopColor="#faf8f4" stopOpacity={0.14 * gloss} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0.22 * gloss} />
        </radialGradient>
        {/* 상단·좌상단 테두리 스펙큘러 호 */}
        <linearGradient id={`${ids.lac}-rimSpec`} x1="0.15" y1="0" x2="0.85" y2="0.55">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.28 * gloss} />
          <stop offset="0.35" stopColor="#faf8f4" stopOpacity={0.1 * gloss} />
          <stop offset="0.65" stopColor="#faf7f2" stopOpacity="0" />
          <stop offset="1" stopColor="#faf7f2" stopOpacity="0" />
        </linearGradient>
        {/* 우측 하단 옅은 면 그림자 */}
        <radialGradient id={`${ids.lac}-brShade`} cx="0.78" cy="0.82" r="0.55">
          <stop offset="0" stopColor="#1a0f0a" stopOpacity={0.16 * gloss} />
          <stop offset="0.45" stopColor="#1a0f0a" stopOpacity={0.06 * gloss} />
          <stop offset="1" stopColor="#1a0f0a" stopOpacity="0" />
        </radialGradient>
        {/* 면 위 직선 광택 띠 — 한 방향으로 훑는 애니메이션 */}
        <linearGradient
          id={`${ids.lac}-band`}
          gradientUnits="userSpaceOnUse"
          x1="-80"
          y1="-40"
          x2="380"
          y2="340"
          gradientTransform={shimmer ? undefined : "translate(-40 -30)"}
        >
          <stop offset="0" stopColor="#faf7f2" stopOpacity="0" />
          <stop offset="0.38" stopColor="#faf7f2" stopOpacity="0" />
          <stop offset="0.44" stopColor="#faf7f2" stopOpacity={0.06 * reflectedLight} />
          <stop offset="0.5" stopColor="#faf8f4" stopOpacity={0.18 * reflectedLight} />
          <stop offset="0.56" stopColor="#faf7f2" stopOpacity={0.06 * reflectedLight} />
          <stop offset="0.62" stopColor="#faf7f2" stopOpacity="0" />
          <stop offset="1" stopColor="#faf7f2" stopOpacity="0" />
          {shimmer && gloss > 0 && showcase && <ShowcaseReflection />}
          {shimmer && gloss > 0 && !showcase && (
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              values="-220 -165; 220 165; 220 165"
              keyTimes="0; 0.55; 1"
              dur="4s"
              repeatCount="indefinite"
            />
          )}
        </linearGradient>
        <linearGradient id={ids.rim} x1="0" y1="0" x2="1" y2="1">
          {isLac ? (
            <>
              <stop offset="0" stopColor={rimTone.body} />
              <stop offset="0.58" stopColor={rimTone.body} />
              <stop offset="1" stopColor={rimTone.shadow} />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#ecc68e" />
              <stop offset="0.38" stopColor="#c38440" />
              <stop offset="0.7" stopColor="#815129" />
              <stop offset="1" stopColor="#3b1f0d" />
            </>
          )}
        </linearGradient>
        {isLac && (
          <linearGradient id={ids.rimHi} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={rimHighlight} stopOpacity="1" />
            <stop offset="0.34" stopColor={rimHighlight} stopOpacity="0.85" />
            <stop offset="0.62" stopColor={rimHighlight} stopOpacity="0" />
            <stop offset="1" stopColor={rimHighlight} stopOpacity="0" />
          </linearGradient>
        )}
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
        {/* 알파만 흐리고 단색으로 다시 칠해, 넓은 블러의 청록 색수차를 막는다 */}
        <filter id={ids.inset} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur" />
          <feFlood floodColor="#120c08" floodOpacity="0.72" result="ink" />
          <feComposite in="ink" in2="blur" operator="in" />
        </filter>
        <radialGradient id={`${ids.lac}-scuff`}>
          <stop stopColor="#c4b8a9" stopOpacity={0.6 * FINISH_MARK_OPACITY} />
          <stop offset="1" stopColor="#c4b8a9" stopOpacity="0" />
        </radialGradient>
        <clipPath id={ids.clip}>
          <path d={shape.path} />
        </clipPath>
      </defs>

      {shadow && (
        <path d={shape.path} transform="translate(3 9)" fill="#1a0f0a" opacity="0.45" filter={`url(#${ids.shadow})`} />
      )}

      {isLac && design.shape !== "mirror" && (
        <path d={shape.path} transform={`translate(0 ${design.shape === "box" ? 12 : 6})`} fill={`url(#${ids.rim})`} stroke={rimTone.shadow} strokeWidth="3" />
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
            {design.shape === "box" && design.lacquer === "black" && <image href="/images/demo/lid.webp" x="30" y="55" width="240" height="190" preserveAspectRatio="none" />}
            <rect width="300" height="300" filter={`url(#${ids.micro})`} opacity="0.05" />
          </>
        )}

        {design.finish?.creases?.map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.angle})`} opacity={(0.12 + p.strength * 0.22) * FINISH_MARK_OPACITY} pointerEvents="none">
            <path d="M0 -21 Q4 -11 0 0 T1 21" fill="none" stroke="#120e0c" strokeWidth="1.5" />
            <path d="M1 -21 Q5 -11 1 0 T2 21" fill="none" stroke="#d5bda0" strokeWidth=".6" />
          </g>
        ))}
        {isLac && [...(design.finish?.lacquer ?? []), ...(design.finish?.fill ?? [])].map((p, i) => (
          <g key={i} transform={`translate(${p.x} ${p.y}) scale(${0.55 + p.strength})`} opacity={FINISH_MARK_OPACITY} pointerEvents="none">
            <path d="M0 -3 C1 0 3 5 2 8 Q0 11 -1 7 Z" fill={lac.deep} opacity=".58" />
            <path d="M1 0 Q3 5 1.4 7" fill="none" stroke="#dfc4ae" strokeWidth=".65" opacity=".5" />
          </g>
        ))}
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
              <PieceGraphics
                piece={p}
                fill={nacreFill(`${ids.nacre}-${piecePearl(p, design)}`, p.id)}
                mask={motifMask(ids.cuts, p.motif)}
                light={pieceLight(p)}
                s={p.s}
                dull={overallDull}
                clipPrefix={`${ids.clip}-${p.id}`}
                selected={selectedId === p.id || !!selectedIds?.includes(p.id)}
                onPointerDown={onPiecePointerDown ? (e) => onPiecePointerDown(e, p) : undefined}
                style={onPiecePointerDown ? { cursor: "grab" } : undefined}
              />
            </g>
          ))}

        {/* 기본 광택(항상) + 훑는 직선 띠 */}
        {gloss > 0 && (
          <g pointerEvents="none" opacity={1 - Math.min(0.55, overallDull)}>
            <path d={shape.path} fill={`url(#${ids.lac}-base)`} />
            <path d={shape.path} fill={`url(#${ids.lac}-brShade)`} />
            <path d={shape.path} fill={`url(#${ids.lac}-rimLight)`} />
            <path
              d={shape.path}
              fill="none"
              stroke={`url(#${ids.lac}-rimSpec)`}
              strokeWidth="2"
              strokeOpacity={0.28}
              transform="translate(150 150) scale(0.985) translate(-150 -150)"
            />
            <path d={shape.path} fill={`url(#${ids.lac}-band)`} />
            {showPieces && list.length > 0 && (
              <rect
                width="300"
                height="300"
                fill={`url(#${ids.sheen})`}
                mask={`url(#${ids.pieceMask})`}
                opacity={0.42 * reflectedLight * (1 - Math.min(0.7, overallDull))}
              />
            )}
          </g>
        )}
        {showPieces && list.length > 0 && gloss <= 0 && (
          <rect
            width="300"
            height="300"
            fill={`url(#${ids.sheen})`}
            mask={`url(#${ids.pieceMask})`}
            opacity={0.38 * (1 - Math.min(0.8, overallDull))}
            pointerEvents="none"
          />
        )}
        {isLac && design.finish?.unpolished && <path d={design.finish.unpolished} fill={lac.color} opacity={0.68 * FINISH_MARK_OPACITY} filter={`url(#${ids.soft})`} pointerEvents="none" />}
        {isLac && design.finish?.iron?.map((p, i) => (
          <ellipse key={i} cx={p.x} cy={p.y} rx={5 + 7 * p.strength} ry="5" fill="#704026" opacity={(0.18 + 0.24 * p.strength) * FINISH_MARK_OPACITY} pointerEvents="none" />
        ))}
        {isLac && design.finish?.sand?.map((p, i) => (
          <ellipse key={i} cx={p.x} cy={p.y} rx={8 + 12 * p.strength} ry={5 + 8 * p.strength} fill={`url(#${ids.lac}-scuff)`} pointerEvents="none" />
        ))}
        <path
          d={shape.path}
          fill="none"
          stroke="#000"
          strokeWidth="16"
          strokeOpacity="1"
          strokeLinejoin="round"
          filter={`url(#${ids.inset})`}
          pointerEvents="none"
        />
      </g>

      <path
        d={shape.path}
        fill="none"
        stroke={`url(#${ids.rim})`}
        strokeWidth="3.85"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {isLac && (
        <path
          d={shape.path}
          fill="none"
          stroke={`url(#${ids.rimHi})`}
          strokeWidth="1.7"
          strokeLinejoin="round"
          transform="translate(150 150) scale(1.006) translate(-150 -150)"
          pointerEvents="none"
        />
      )}
      {isLac && design.shape === "box" && <g pointerEvents="none">
        <path d="M138 247 Q150 245 162 247 L160 251 Q150 254 140 251 Z" fill="#8c7350" stroke="#342b20" strokeWidth=".8" />
        <path d="M140 247.5 Q150 246.2 160 247.5" fill="none" stroke="#d9c396" strokeWidth=".65" />
        <circle cx="150" cy="249.7" r="1.2" fill="#3a3028" />
      </g>}
      {isLac && design.shape === "tray" && <path d={shape.path} transform="translate(150 150) scale(.89) translate(-150 -150)" fill="none" stroke={rimHighlight} strokeOpacity=".48" strokeWidth="2" pointerEvents="none" />}
      {isLac && design.shape === "mirror" && <g fill="none" pointerEvents="none">
        <circle cx="150" cy="280" r="3" stroke="#b7a078" strokeWidth="1.4" />
        <path d="M150 282 Q143 300 153 297 Q159 295 151 282" stroke="#83443d" strokeWidth="1.6" />
      </g>}
      {children}
    </svg>
  );
}
