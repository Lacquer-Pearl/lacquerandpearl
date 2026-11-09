"use client";

import { useEffect } from "react";
import Artwork from "@/components/Artwork";
import Avatar from "@/components/Avatar";
import MotifIcon, { NacreSwatch } from "@/components/MotifIcon";
import { Btn, Coin, TopBar } from "@/components/ui";
import { CUSTOMERS, LACQUERS, MOTIFS, PEARLS, SHAPES, type MotifId } from "@/lib/data";
import { generateCommission } from "@/lib/game";
import { useSave, useUI } from "@/lib/store";

export default function BoardScreen() {
  const go = useUI((s) => s.go);
  const startCraft = useUI((s) => s.startCraft);
  const commissions = useSave((s) => s.commissions);
  const ensure = useSave((s) => s.ensureCommissions);
  const rep = useSave((s) => s.reputation);

  useEffect(() => ensure(), [ensure]);

  return (
    <div className="screen">
      <TopBar title="📜 의뢰 게시판" onBack={() => go("title")} />
      <div className="screen-body">
        {commissions.map((c) => {
          const cust = CUSTOMERS[c.customer];
          return (
            <div key={c.id} className="panel commission-card">
              <div className="flex items-start gap-3">
                <Avatar c={cust} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <b className="text-lg text-[var(--brown)]">{cust.name}</b>
                    <span className="text-xs opacity-70">{cust.title}</span>
                  </div>
                  <div className="bubble mt-1 text-sm">“{c.line}”</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-20 w-20 shrink-0 rounded-2xl bg-[#f8f2e8] p-1">
                  <Artwork
                    design={{ shape: c.shape, lacquer: c.lacquer, pearl: c.pearl ?? "white", pieces: [] }}
                    className="h-full w-full"
                    gloss={0.5}
                  />
                </div>
                <div className="flex flex-1 flex-wrap gap-1.5 text-sm">
                  <span className="chip">{SHAPES[c.shape].name}</span>
                  <span className="chip">
                    <span className="swatch" style={{ background: LACQUERS[c.lacquer].color }} />
                    {LACQUERS[c.lacquer].name}
                  </span>
                  {c.pearl && (
                    <span className="chip">
                      <NacreSwatch pearl={c.pearl} className="swatch" /> {PEARLS[c.pearl].name}
                    </span>
                  )}
                  {(Object.entries(c.motifs) as [MotifId, number][]).map(([m, n]) => (
                    <span key={m} className="chip">
                      <MotifIcon motif={m} className="h-5 w-5" /> {MOTIFS[m].name} ×{n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg text-[var(--brown)]">
                  사례금 <Coin /> {c.reward}
                </span>
                <Btn variant="pink" onClick={() => startCraft(c)}>
                  수락하기 ✨
                </Btn>
              </div>
            </div>
          );
        })}
        <Btn
          variant="cream"
          onClick={() => useSave.setState({ commissions: [0, 1, 2].map(() => generateCommission(rep)) })}
        >
          🔄 다른 의뢰 보기
        </Btn>
      </div>
    </div>
  );
}
