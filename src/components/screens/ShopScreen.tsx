"use client";

import { useState } from "react";
import { Btn, Coin, TopBar } from "@/components/ui";
import { NacreSwatch } from "@/components/MotifIcon";
import { MATERIAL_LIST, PEARL_LIST, type MaterialId } from "@/lib/data";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

const pearlOf = (m: MaterialId) => PEARL_LIST.find((p) => p.material === m)?.id;

export default function ShopScreen() {
  const back = useUI((s) => s.back);
  const inventory = useSave((s) => s.inventory);
  const money = useSave((s) => s.money);
  const buy = useSave((s) => s.buy);
  const [flash, setFlash] = useState<string | null>(null);

  return (
    <div className="screen">
      <TopBar title="🛒 재료 상점" onBack={back} />
      <div className="screen-body">
        <div className="shop-sign">
          <span className="text-3xl">🏮</span>
          <div>
            <b className="text-lg">옻골 재료상</b>
            <div className="text-sm opacity-80">“좋은 재료가 좋은 작품을 만든다네~”</div>
          </div>
        </div>
        {MATERIAL_LIST.map((m) => (
          <div key={m.id} className="panel flex items-center gap-3 py-3">
            {pearlOf(m.id) ? (
              <NacreSwatch pearl={pearlOf(m.id)!} round={false} className="mat-icon nacre" />
            ) : (
              <div className="mat-icon">{m.emoji}</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <b className="text-[var(--brown)]">{m.name}</b>
                <span className="text-xs opacity-70">보유 {inventory[m.id]}</span>
              </div>
              <div className="text-xs opacity-80">{m.desc}</div>
            </div>
            <Btn
              size="sm"
              variant="gold"
              sound={false}
              disabled={money < m.price}
              onClick={() => {
                if (buy(m.id)) {
                  sfx.coin();
                  setFlash(`${m.name} 구매!`);
                  setTimeout(() => setFlash(null), 900);
                }
              }}
            >
              <Coin /> {m.price}
            </Btn>
          </div>
        ))}

        <div className="panel flex flex-col gap-2 py-3 opacity-90">
          <b className="text-[var(--brown)]">💎 엽전 꾸러미 (준비 중)</b>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            {[
              ["한 줌", 500, "₩1,200"],
              ["한 꾸러미", 1500, "₩3,300"],
              ["한 궤짝", 5000, "₩9,900"],
            ].map(([n, c, p]) => (
              <div key={n as string} className="iap-card">
                <div className="text-2xl">🪙</div>
                <div>{n}</div>
                <div className="text-xs">
                  <Coin /> {c}
                </div>
                <div className="mt-1 rounded-full bg-[#e8dccb] px-2 text-xs">{p}</div>
              </div>
            ))}
          </div>
          <div className="text-xs opacity-70">스토어 인앱 결제는 정식 출시 때 열려요.</div>
        </div>
      </div>
      {flash && (
        <div className="score-toast-wrap pointer-events-none">
          <div className="event-toast static pop-in">{flash}</div>
        </div>
      )}
    </div>
  );
}
