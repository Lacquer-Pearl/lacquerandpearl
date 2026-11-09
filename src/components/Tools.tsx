export type ToolId = "brush" | "spatula" | "iron" | "stone" | "saw";

/** 도구 끝(작업 지점)의 위치. 64x64 기준 */
export const TOOL_TIP: Record<ToolId, [number, number]> = {
  brush: [8, 56],
  spatula: [8, 56],
  iron: [10, 54],
  stone: [22, 42],
  saw: [14, 58],
};

export function ToolGraphic({ tool, color = "#1c1416" }: { tool: ToolId; color?: string }) {
  switch (tool) {
    case "brush":
      return (
        <g>
          <path d="M28 36 L58 6 L62 10 L32 40 Z" fill="#8a5a36" />
          <path d="M30 38 L60 8" stroke="#b07a4a" strokeWidth="1.2" />
          <path d="M22 42 L28 36 L32 40 L26 46 Z" fill="#b8a47a" stroke="#6e5a3a" strokeWidth="0.8" />
          <path d="M26 46 L22 42 Q12 48 7 57 Q16 54 26 46 Z" fill={color} />
          <path d="M23 44 Q14 50 9 56" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.8" fill="none" />
        </g>
      );
    case "spatula":
      return (
        <g>
          <path d="M36 30 L58 8 L62 12 L40 34 Z" fill="#9a6a3e" />
          <path d="M40 34 L36 30 L10 50 Q6 56 12 58 Z" fill="#c9a074" stroke="#8a5f38" strokeWidth="1" />
          <path d="M34 34 L14 52" stroke="#e8cfa8" strokeWidth="1" opacity="0.7" />
        </g>
      );
    case "iron":
      return (
        <g>
          <path d="M34 30 L56 8 L61 13 L39 35 Z" fill="#7a4e2c" />
          <path d="M36 32 L58 10" stroke="#a87346" strokeWidth="1" />
          <rect x="30" y="30" width="7" height="5" transform="rotate(-45 33 32)" fill="#9aa0a6" />
          <path d="M33 34 L10 54 L6 48 L28 28 Z" fill="#3b3e42" />
          <path d="M28 28 L6 48" stroke="#8b9096" strokeWidth="1.4" />
          <ellipse cx="9" cy="52" rx="5" ry="3" fill="#ff8a3d" opacity="0.35" />
        </g>
      );
    case "stone":
      return (
        <g>
          <rect x="8" y="26" width="34" height="18" rx="3" transform="rotate(-18 25 35)" fill="#8f9490" />
          <rect x="8" y="26" width="34" height="6" rx="2" transform="rotate(-18 25 35)" fill="#b3b8b3" />
          <circle cx="20" cy="38" r="0.8" fill="#6c716d" />
          <circle cx="30" cy="34" r="0.7" fill="#6c716d" />
          <circle cx="25" cy="31" r="0.6" fill="#d1d5d0" />
        </g>
      );
    case "saw":
      return (
        <g>
          <path d="M14 58 L14 14 L46 14 L46 22" stroke="#9aa0a6" strokeWidth="3" fill="none" strokeLinejoin="round" />
          <path d="M14 58 L14 14" stroke="#d9dde0" strokeWidth="1" />
          <path d="M46 22 L46 40" stroke="#444" strokeWidth="0.8" />
          <rect x="41" y="40" width="10" height="20" rx="3" fill="#7a4e2c" />
          <path d="M14 18 L46 18" stroke="#5a5f64" strokeWidth="0.6" strokeDasharray="1 1" />
        </g>
      );
  }
}

export function ToolCursor({ tool, x, y, color, size = 64 }: { tool: ToolId; x: string; y: string; color?: string; size?: number }) {
  const [tx, ty] = TOOL_TIP[tool];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className="pointer-events-none absolute drop-shadow-[2px_4px_3px_rgba(0,0,0,0.35)]"
      style={{ left: x, top: y, transform: `translate(${(-tx / 64) * size}px, ${(-ty / 64) * size}px)` }}
    >
      <ToolGraphic tool={tool} color={color} />
    </svg>
  );
}
