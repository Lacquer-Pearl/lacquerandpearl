"use client";

import { useState } from "react";
import { MotifMasks, NacreDefs, NacrePiece, motifMask } from "@/components/Artwork";
import CutStep from "@/components/craft/CutStep";
import { MOTIFS, MOTIF_LIST, PEARL_LIST, motifCutFit, motifCutRoutes, type MotifId, type PearlId } from "@/lib/data";
import { motifName, pearlName, t } from "@/lib/i18n";
import { useSave } from "@/lib/store";

const EXTRA: MotifId[] = ["cloudLine", "leaf"];

function Preview({ motif, pearl }: { motif: MotifId; pearl: PearlId }) {
  const lang = useSave((s) => s.lang);
  const fit = motifCutFit(motif);
  const routes = motifCutRoutes(motif);
  const pref = MOTIFS[motif].cutting.preferredMethod;
  const xf = `translate(150 150) scale(${fit.scale}) translate(${-fit.ox} ${-fit.oy})`;
  return (
    <figure data-cut-preview={motif} data-cut-method={pref ?? "none"} className="panel flex flex-col gap-2 p-2">
      <figcaption className="text-sm text-[var(--brown)]">
        {motifName(lang, motif)} · {routes.length} · {pref ? t(lang, pref === "jul" ? "cut.jul" : "cut.kkeun") : t(lang, "cut.noPref")}
        {MOTIFS[motif].cutting.guideMode === "outer-silhouette" ? " · 바깥선" : ""}
      </figcaption>
      <svg viewBox="0 0 300 300" className="aspect-square w-full">
        <rect width="300" height="300" fill="#1c1416" />
        <defs>
          <NacreDefs id={`gal-${motif}-${pearl}`} pearl={pearl} scale={1.4} />
          <MotifMasks id={`gal-${motif}`} motifs={[motif]} />
        </defs>
        <g transform={xf}>
          <NacrePiece motif={motif} fill={`url(#gal-${motif}-${pearl})`} mask={motifMask(`gal-${motif}`, motif)} light={0.15} />
          {routes.map((route, i) => {
            const start = route.d.match(/M\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/);
            return (
              <g key={route.id}>
                <path
                  d={route.d}
                  data-cut-guide={route.id}
                  fill="none"
                  stroke="#ff4fd8"
                  strokeWidth={1.2 / fit.scale}
                  strokeDasharray={`${4 / fit.scale} ${2.6 / fit.scale}`}
                />
                {start && (
                  <>
                    <circle cx={Number(start[1])} cy={Number(start[2])} r={4.5 / fit.scale} fill="#3ddc7a" />
                    <text x={Number(start[1])} y={Number(start[2]) - 6 / fit.scale} fontSize={9 / fit.scale} fill="#ffe27a">
                      {i + 1} {route.id}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}

export default function CutGuideGallery() {
  const lang = useSave((s) => s.lang);
  const [pearl, setPearl] = useState<PearlId>("white");
  const [play, setPlay] = useState<MotifId | null>(null);
  const ids = [...MOTIF_LIST.map((motif) => motif.id), ...EXTRA];
  return (
    <div className="screen">
      <div className="screen-body flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {PEARL_LIST.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rounded-full border border-[var(--gold)] px-3 py-1 text-sm"
              onClick={() => setPearl(item.id)}
            >
              {pearlName(lang, item.id)}
            </button>
          ))}
        </div>
        {play ? (
          <CutStep
            design={{
              shape: "round",
              lacquer: "black",
              pearl,
              pieces: [{ id: "cut-preview", motif: play, x: 150, y: 150, s: 1, r: 0, pearl }],
            }}
            onDone={() => setPlay(null)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {ids.map((id) => (
              <div key={id}>
                <Preview motif={id} pearl={pearl} />
                <button type="button" className="mt-1 text-xs underline" onClick={() => setPlay(id)}>
                  {motifName(lang, id)}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
