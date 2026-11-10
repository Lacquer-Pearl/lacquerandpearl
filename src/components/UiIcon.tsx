"use client";

import type { MaterialId } from "@/lib/data";
import type { StepId } from "@/lib/game";

const ICONS = {
  scroll: "/images/ui/icon-scroll.png",
  frame: "/images/ui/icon-frame.png",
  cabinet: "/images/ui/icon-cabinet.png",
  market: "/images/ui/icon-market.png",
  gear: "/images/ui/icon-gear.png",
  pencil: "/images/ui/icon-pencil.png",
  hemp: "/images/ui/icon-hemp.png",
  brush: "/images/ui/icon-brush.png",
  torch: "/images/ui/icon-torch.png",
  fretsaw: "/images/ui/icon-fretsaw.png",
  knife: "/images/ui/icon-knife.png",
  paste: "/images/ui/icon-paste.png",
  hearth: "/images/ui/icon-hearth.png",
  hanji: "/images/ui/icon-hanji.png",
  lacquer: "/images/ui/icon-lacquer.png",
  whetstone: "/images/ui/icon-whetstone.png",
  cutter: "/images/ui/icon-cutter.png",
  wood: "/images/ui/icon-wood.png",
  coin: "/images/ui/icon-coin.png",
  coinsStack: "/images/ui/icon-coins-stack.png",
  coinsBundle: "/images/ui/icon-coins-bundle.png",
  chest: "/images/ui/icon-chest.png",
  ticket: "/images/ui/icon-ticket.png",
  star: "/images/ui/icon-star.png",
  medal: "/images/ui/icon-medal.png",
  musicOff: "/images/ui/icon-music-off.png",
  sfx: "/images/ui/icon-sfx.png",
  settings: "/images/ui/icon-settings.png",
  shop: "/images/ui/icon-shop.png",
  workshop: "/images/ui/icon-workshop.png",
} as const;

export type UiIconId = keyof typeof ICONS;

export const STEP_ICONS: Record<"design" | StepId, UiIconId> = {
  design: "pencil",
  cloth: "hemp",
  lacquer: "brush",
  dry: "torch",
  cut: "fretsaw",
  attach: "paste",
  iron: "hearth",
  peel: "hanji",
  fill: "lacquer",
  sand: "whetstone",
};

export const MATERIAL_ICONS: Record<MaterialId, UiIconId> = {
  wood: "wood",
  hemp: "hemp",
  lacquer: "lacquer",
  glue: "paste",
  pearlWhite: "frame",
  pearlAbalone: "frame",
  pearlBlack: "frame",
  pearlPaua: "frame",
};

export function uiIconSrc(id: UiIconId) {
  return ICONS[id];
}

export default function UiIcon({
  id,
  className = "",
  alt = "",
}: {
  id: UiIconId;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ICONS[id]} alt={alt} draggable={false} className={`ui-icon ${className}`} />
  );
}
