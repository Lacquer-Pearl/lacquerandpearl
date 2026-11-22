"use client";

import { useSave, useUI } from "@/lib/store";
import { sfx } from "@/lib/sound";

const stations = [
  { screen: "board", ko: ["문가", "의뢰 받기"], en: ["Doorway", "Commissions"] },
  { screen: "craft", ko: ["작업대", "작업하기"], en: ["Workbench", "Craft"] },
  { screen: "gallery", ko: ["진열대", "작품 보기"], en: ["Display shelf", "Collection"] },
] as const;

export type WorkshopExit = "board" | "gallery";

export default function WorkshopNav({ onLeaveCraft }: { onLeaveCraft?: (target: WorkshopExit) => void }) {
  const screen = useUI(s => s.screen);
  const lang = useSave(s => s.lang);
  return (
    <nav className="workshop-nav" aria-label={lang === "ko" ? "공방 안 이동" : "Workshop navigation"}>
      {stations.map(station => {
        const target = station.screen;
        const [place, action] = station[lang];
        const label = screen === "title" && target === "craft" ? (lang === "ko" ? "자유 디자인" : "Free design") : action;
        const active = screen === target;
        return (
          <button type="button" key={target} aria-current={active ? "location" : undefined}
            onClick={() => {
              if (active) return;
              sfx.click();
              const ui = useUI.getState();
              if (target === "craft") {
                if (ui.draft) ui.go("craft");
                else if (screen === "title" || !ui.resumeCraft()) ui.startCraft();
              } else if (onLeaveCraft) onLeaveCraft(target);
              else ui.go(target);
            }}>
            <span className="station-place">{place}</span>
            <span className="station-action">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
