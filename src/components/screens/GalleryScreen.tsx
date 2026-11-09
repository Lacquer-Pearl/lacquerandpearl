"use client";

import { useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn, Coin, Modal, TopBar } from "@/components/ui";
import { CUSTOMERS, workshopTitle } from "@/lib/data";
import { GRADE_INFO, type Artwork as ArtworkT } from "@/lib/game";
import { saveArtworkImage } from "@/lib/exportImage";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

export default function GalleryScreen() {
  const back = useUI((s) => s.back);
  const gallery = useSave((s) => s.gallery);
  const rep = useSave((s) => s.reputation);
  const [open, setOpen] = useState<ArtworkT | null>(null);
  const current = open ? gallery.find((a) => a.id === open.id) ?? open : null;

  return (
    <div className="screen">
      <TopBar title="🏯 나의 공방" onBack={back} />
      <div className="screen-body">
        <div className="workshop-sign">
          <div className="text-sm opacity-80">{workshopTitle(rep)}의</div>
          <div className="text-2xl">나전칠기 공방</div>
        </div>
        {gallery.length === 0 ? (
          <div className="panel py-10 text-center text-[var(--brown)]">
            <div className="text-5xl">🪵</div>
            아직 전시된 작품이 없어요.
            <br />첫 작품을 만들어 보세요!
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
                <span className="truncate text-sm">{a.title}</span>
                {a.commissionId ? (
                  <span className="text-xs opacity-70">납품 완료 · {CUSTOMERS[a.customer ?? 0].name}</span>
                ) : a.sold ? (
                  <span className="text-xs opacity-70">판매 완료</span>
                ) : (
                  <span className="text-xs opacity-70">전시 중 · 감정가 {a.value}</span>
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
  const [msg, setMsg] = useState<string | null>(null);
  const g = GRADE_INFO[art.grade];

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="display-silk">
          <Artwork svgRef={svgRef} design={art.design} gloss={art.gloss} dull={art.dull} className="aspect-square w-full" />
        </div>
        <div className="text-center">
          <h3 className="step-title">{art.title}</h3>
          <div className="text-sm text-[var(--brown)]">
            <b style={{ color: g.color }}>
              {art.grade} {g.label}
            </b>{" "}
            · {art.total}점 · {new Date(art.createdAt).toLocaleDateString("ko-KR")}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="lavender"
            onClick={async () => {
              if (!svgRef.current) return;
              const r = await saveArtworkImage(svgRef.current, art.title, `${art.grade} ${g.label} · ${art.total}점`);
              setMsg(r === "shared" ? "공유했어요!" : "이미지를 저장했어요!");
            }}
          >
            📸 자랑하기
          </Btn>
          {!art.sold ? (
            <Btn
              variant="gold"
              sound={false}
              onClick={() => {
                sell(art.id);
                sfx.coin();
                setMsg(`${art.value}냥에 판매했어요!`);
              }}
            >
              <Coin /> {art.value} 판매
            </Btn>
          ) : (
            <Btn variant="cream" disabled>
              {art.commissionId ? "납품 완료" : "판매 완료"}
            </Btn>
          )}
        </div>
        <div className="rounded-2xl bg-[#f6ece6] p-3 text-sm text-[var(--brown)]">
          <b>✨ 실물로 갖고 싶나요?</b>
          <p className="mt-1 opacity-80">
            이 디자인 그대로 실제 나전칠기 장인 공방에서 제작해 드리는 서비스를 준비하고 있어요.
          </p>
          <Btn
            className="mt-2 w-full"
            variant={interest ? "mint" : "pink"}
            size="sm"
            onClick={() => toggleInterest(art.id)}
          >
            {interest ? "💌 관심 등록 완료! (다시 누르면 취소)" : "❤️ 실물 제작 관심 있어요"}
          </Btn>
        </div>
        {msg && <div className="text-center text-[var(--mint-deep)]">{msg}</div>}
        <Btn variant="cream" onClick={onClose}>
          닫기
        </Btn>
      </div>
    </Modal>
  );
}
