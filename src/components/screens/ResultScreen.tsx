"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import Avatar, { type Mood } from "@/components/Avatar";
import { Btn, Coin, Meter, Sparkles, TopBar } from "@/components/ui";
import { CUSTOMERS } from "@/lib/data";
import { GRADE_INFO, reactionFor, STEP_INFO, type StepId } from "@/lib/game";
import { saveArtworkImage } from "@/lib/exportImage";
import { sfx } from "@/lib/sound";
import { useUI } from "@/lib/store";

export default function ResultScreen() {
  const art = useUI((s) => s.lastArtwork);
  const go = useUI((s) => s.go);
  const svgRef = useRef<SVGSVGElement>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const reaction = useMemo(() => (art ? reactionFor(art.grade, !!art.commissionId) : ""), [art]);

  useEffect(() => {
    if (!art) return;
    if (art.grade === "S" || art.grade === "A") sfx.fanfare();
    else sfx.success();
    if (art.earned) setTimeout(sfx.coin, 900);
  }, [art]);

  if (!art) return null;
  const g = GRADE_INFO[art.grade];
  const cust = art.customer != null ? CUSTOMERS[art.customer] : undefined;
  const mood: Mood = art.grade === "S" ? "wow" : art.grade === "A" || art.grade === "B" ? "happy" : art.grade === "C" ? "neutral" : "sad";

  return (
    <div className="screen">
      <TopBar title="작품 완성!" />
      <div className="screen-body">
        <div className="display-silk relative overflow-hidden">
          <Sparkles count={art.grade === "S" ? 14 : 6} />
          <Artwork svgRef={svgRef} design={art.design} gloss={art.gloss} dull={art.dull} className="reveal aspect-square w-full" />
          <div className="grade-seal stamp-in" style={{ background: g.color }}>
            <div className="text-4xl leading-none">{art.grade}</div>
            <div className="text-xs">{g.label}</div>
          </div>
        </div>
        <h2 className="step-title text-center">{art.title}</h2>

        {cust ? (
          <div className="panel flex items-center gap-3">
            <Avatar c={cust} mood={mood} className="h-16 w-16 shrink-0" />
            <div className="flex-1">
              <b className="text-[var(--brown)]">{cust.name}</b>
              <div className="bubble mt-1 text-sm">“{reaction}”</div>
            </div>
          </div>
        ) : (
          <div className="panel text-center text-[var(--brown)]">{reaction}</div>
        )}

        <div className="panel flex flex-col gap-2">
          <div className="flex justify-between text-lg text-[var(--brown)]">
            <span>종합 점수</span>
            <b>{art.total}점</b>
          </div>
          <Meter value={art.designScore / 100} color="var(--lavender-deep)" label={<><span>✏️ {art.commissionId ? "주문 일치도" : "디자인 구성"}</span><span>{art.designScore}</span></>} />
          <Meter value={art.craftScore / 100} color="var(--mint-deep)" label={<><span>🔨 제작 솜씨</span><span>{art.craftScore}</span></>} />
          <div className="mt-1 grid grid-cols-3 gap-1.5 text-xs">
            {(Object.entries(art.scores) as [StepId, number][]).map(([k, v]) => (
              <div key={k} className="mat">
                {STEP_INFO[k].emoji} {STEP_INFO[k].name} <b>{v}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="panel flex items-center justify-around text-lg text-[var(--brown)]">
          {art.commissionId ? (
            <span className="coin-pop">
              +<Coin /> {art.earned}
            </span>
          ) : (
            <span>
              감정가 <Coin /> {art.value}
            </span>
          )}
          <span>+⭐ {Math.round(g.rep * (art.commissionId ? 1 : 0.5))}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="lavender"
            onClick={async () => {
              if (!svgRef.current) return;
              const r = await saveArtworkImage(svgRef.current, art.title, `${art.grade} ${g.label} · ${art.total}점`);
              setSaved(r === "shared" ? "공유했어요!" : "이미지를 저장했어요!");
              setTimeout(() => setSaved(null), 1800);
            }}
          >
            📸 {saved ?? "이미지 저장"}
          </Btn>
          <Btn variant="gold" onClick={() => go("gallery")}>
            🏯 공방에서 보기
          </Btn>
          <Btn variant="pink" onClick={() => go(art.commissionId ? "board" : "title")} className="col-span-2" size="lg">
            {art.commissionId ? "📜 다음 의뢰 받기" : "🏠 처음으로"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
