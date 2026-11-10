"use client";

import { useEffect } from "react";
import Artwork from "@/components/Artwork";
import Avatar from "@/components/Avatar";
import MotifIcon, { NacreSwatch } from "@/components/MotifIcon";
import { Btn, Coin, TopBar } from "@/components/ui";
import { LACQUERS, type MotifId } from "@/lib/data";
import {
  clientLabel,
  lacquerName,
  motifName,
  pearlName,
  shapeName,
  t,
} from "@/lib/i18n";
import { useSave, useUI } from "@/lib/store";

export default function BoardScreen() {
  const go = useUI((s) => s.go);
  const startCraft = useUI((s) => s.startCraft);
  const commissions = useSave((s) => s.commissions);
  const ensure = useSave((s) => s.ensureCommissions);
  const refresh = useSave((s) => s.refreshCommissions);
  const lang = useSave((s) => s.lang);

  useEffect(() => ensure(), [ensure]);

  return (
    <div className="screen">
      <TopBar title={t(lang, "board.title")} onBack={() => go("title")} />
      <div className="screen-body">
        <p className="panel text-sm leading-relaxed text-[var(--brown)]">{t(lang, "board.repHint")}</p>
        {commissions.map((c) => {
          const client = clientLabel(lang, c);
          return (
            <div key={c.id} className="panel commission-card">
              <div className="flex items-start gap-3">
                <Avatar c={client.customer} portrait={client.portrait} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <b className="text-lg text-[var(--brown)]">{client.name}</b>
                    <span className="text-xs opacity-70">{client.title}</span>
                  </div>
                  <div className="bubble mt-1 text-sm">“{client.line}”</div>
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
                  <span className="chip">{shapeName(lang, c.shape)}</span>
                  <span className="chip">
                    <span className="swatch" style={{ background: LACQUERS[c.lacquer].color }} />
                    {lacquerName(lang, c.lacquer)}
                  </span>
                  {c.pearl && (
                    <span className="chip">
                      <NacreSwatch pearl={c.pearl} className="swatch" /> {pearlName(lang, c.pearl)}
                    </span>
                  )}
                  {(Object.entries(c.motifs) as [MotifId, number][]).map(([m, n]) => (
                    <span key={m} className="chip">
                      <MotifIcon motif={m} className="h-5 w-5" /> {motifName(lang, m)} ×{n}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg text-[var(--brown)]">
                  {t(lang, "board.reward")} <Coin /> {c.reward}
                </span>
                <Btn variant="pink" onClick={() => startCraft(c)}>
                  {t(lang, "board.accept")}
                </Btn>
              </div>
            </div>
          );
        })}
        <Btn
          variant="cream"
          onClick={() => refresh()}
        >
          {t(lang, "board.refresh")}
        </Btn>
      </div>
    </div>
  );
}
