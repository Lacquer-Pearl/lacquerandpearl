"use client";

import { useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import UiIcon from "@/components/UiIcon";
import { Btn, Coin, Modal, TopBar } from "@/components/ui";
import { GRADE_INFO, topMotif, type Artwork as ArtworkT } from "@/lib/game";
import {
  artworkTitle,
  clientLabel,
  gradeLabel,
  rankTitle,
  t,
} from "@/lib/i18n";
import { saveArtworkImage } from "@/lib/exportImage";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

function localizedTitle(lang: Parameters<typeof artworkTitle>[0], art: ArtworkT) {
  return artworkTitle(lang, art.design.shape, art.design.lacquer, topMotif(art.design));
}

export default function GalleryScreen() {
  const back = useUI((s) => s.back);
  const gallery = useSave((s) => s.gallery);
  const rep = useSave((s) => s.reputation);
  const lang = useSave((s) => s.lang);
  const [open, setOpen] = useState<ArtworkT | null>(null);
  const current = open ? gallery.find((a) => a.id === open.id) ?? open : null;

  return (
    <div className="screen">
      <TopBar title={t(lang, "gallery.title")} onBack={back} />
      <div className="screen-body">
        <div className="workshop-sign">
          <div className="text-sm opacity-80">{t(lang, "gallery.of", { rank: rankTitle(lang, rep) })}</div>
          <div className="text-2xl">{t(lang, "gallery.name")}</div>
        </div>
        {gallery.length === 0 ? (
          <div className="panel py-10 text-center text-[var(--brown)] whitespace-pre-line">
            <div className="flex justify-center py-2">
              <UiIcon id="wood" className="ui-icon-2xl" />
            </div>
            {t(lang, "gallery.empty")}
          </div>
        ) : (
          <div className="shelf grid grid-cols-2 gap-3">
            {gallery.map((a) => (
              <button
                key={a.id}
                className="art-card"
                onClick={() => {
                  sfx.click();
                  setOpen(a);
                }}
              >
                <div className="display-silk small">
                  <Artwork design={a.design} gloss={a.gloss} dull={a.dull} className="aspect-square w-full" shimmer={false} />
                </div>
                <span className="art-grade" style={{ background: GRADE_INFO[a.grade].color }}>
                  {a.grade}
                </span>
                <span className="truncate text-sm">{localizedTitle(lang, a)}</span>
                {a.commissionId ? (
                  <span className="text-xs opacity-70">
                    {t(lang, "gallery.delivered", { name: clientLabel(lang, a).name })}
                  </span>
                ) : a.sold ? (
                  <span className="text-xs opacity-70">{t(lang, "gallery.sold")}</span>
                ) : (
                  <span className="text-xs opacity-70">
                    {t(lang, "gallery.onDisplay", { value: a.value })}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {current && <ArtDetail art={current} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ArtDetail({ art, onClose }: { art: ArtworkT; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const sell = useSave((s) => s.sellArtwork);
  const interest = useSave((s) => s.realCraftInterest.includes(art.id));
  const toggleInterest = useSave((s) => s.toggleInterest);
  const lang = useSave((s) => s.lang);
  const [msg, setMsg] = useState<string | null>(null);
  const g = GRADE_INFO[art.grade];
  const title = localizedTitle(lang, art);
  const label = gradeLabel(lang, art.grade);
  const localeTag = lang === "en" ? "en-US" : "ko-KR";

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="display-silk">
          <Artwork svgRef={svgRef} design={art.design} gloss={art.gloss} dull={art.dull} className="aspect-square w-full" />
        </div>
        <div className="text-center">
          <h3 className="step-title">{title}</h3>
          <div className="text-sm text-[var(--brown)]">
            <b style={{ color: g.color }}>
              {art.grade} {label}
            </b>{" "}
            · {art.total}
            {lang === "ko" ? "점" : " pts"} · {new Date(art.createdAt).toLocaleDateString(localeTag)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="lavender"
            onClick={async () => {
              if (!svgRef.current) return;
              const r = await saveArtworkImage(
                svgRef.current,
                title,
                `${art.grade} ${label} · ${art.total}${lang === "ko" ? "점" : " pts"}`,
              );
              setMsg(t(lang, r === "shared" ? "gallery.shared" : "gallery.saved"));
            }}
          >
            <UiIcon id="frame" className="ui-icon-sm" /> {t(lang, "gallery.share")}
          </Btn>
          {!art.sold ? (
            <Btn
              variant="gold"
              sound={false}
              onClick={() => {
                sell(art.id);
                sfx.coin();
                setMsg(t(lang, "gallery.soldToast", { n: art.value }));
              }}
            >
              <Coin /> {art.value} {t(lang, "gallery.sell")}
            </Btn>
          ) : (
            <Btn variant="cream" disabled>
              {art.commissionId ? t(lang, "gallery.deliveredDone") : t(lang, "gallery.sold")}
            </Btn>
          )}
        </div>
        {!art.sold && <p className="text-center text-sm text-[var(--brown)]">{t(lang, "gallery.sellNoRep")}</p>}
        <div className="rounded-2xl bg-[#f6ece6] p-3 text-sm text-[var(--brown)]">
          <b>{t(lang, "gallery.interestTitle")}</b>
          <p className="mt-1 opacity-80">{t(lang, "gallery.interestBody")}</p>
          <Btn
            className="mt-2 w-full"
            variant={interest ? "mint" : "pink"}
            size="sm"
            onClick={() => toggleInterest(art.id)}
          >
            {t(lang, interest ? "gallery.interestOn" : "gallery.interestOff")}
          </Btn>
        </div>
        {msg && <div className="text-center text-[var(--mint-deep)]">{msg}</div>}
        <Btn variant="cream" onClick={onClose}>
          {t(lang, "common.close")}
        </Btn>
      </div>
    </Modal>
  );
}
