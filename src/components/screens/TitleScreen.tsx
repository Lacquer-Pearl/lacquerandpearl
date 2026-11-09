"use client";

import Image from "next/image";
import { useState } from "react";
import { Btn, Coin, Modal, Sparkles, SoundToggle } from "@/components/ui";
import { MasterTip } from "@/components/craft/common";
import { workshopTitle } from "@/lib/data";
import { useSave, useUI } from "@/lib/store";

export default function TitleScreen() {
  const go = useUI((s) => s.go);
  const startCraft = useUI((s) => s.startCraft);
  const money = useSave((s) => s.money);
  const rep = useSave((s) => s.reputation);
  const galleryCount = useSave((s) => s.gallery.length);
  const tutorialSeen = useSave((s) => s.tutorialSeen);
  const setTutorialSeen = useSave((s) => s.setTutorialSeen);
  const resetSave = useSave((s) => s.resetSave);
  const [settings, setSettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="screen title-screen">
      <Sparkles count={16} />
      <div className="flex justify-end p-3">
        <SoundToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 pb-8">
        <div className="float logo-plaque w-full max-w-[440px]">
          <Image src="/logo.png" alt="Lacquer & Pearl — 나전칠기 : 전통 공예 장인" width={1024} height={558} priority className="h-auto w-full" />
        </div>
        <div className="flex gap-2">
          <span className="chip">🏅 {workshopTitle(rep)}</span>
          <span className="chip">
            <Coin /> {money.toLocaleString()}
          </span>
          <span className="chip">⭐ {rep}</span>
        </div>
        <div className="grid w-full max-w-[360px] grid-cols-1 gap-3">
          <Btn variant="pink" size="lg" onClick={() => go("board")}>
            📜 의뢰 받기
          </Btn>
          <Btn variant="mint" size="lg" onClick={() => startCraft(undefined)}>
            🎨 자유 디자인
          </Btn>
          <div className="grid grid-cols-2 gap-3">
            <Btn variant="lavender" onClick={() => go("gallery")}>
              🏯 나의 공방 {galleryCount > 0 && <small>({galleryCount})</small>}
            </Btn>
            <Btn variant="gold" onClick={() => go("shop")}>
              🛒 재료 상점
            </Btn>
          </div>
          <button className="on-dark-link text-sm underline" onClick={() => setSettings(true)}>
            ⚙️ 설정 · 도움말
          </button>
        </div>
      </div>

      {(!tutorialSeen || settings) && (
        <Modal
          onClose={() => {
            setTutorialSeen();
            setSettings(false);
          }}
        >
          <div className="flex flex-col gap-3">
            <h2 className="step-title text-center">나전칠기 공방에 온 걸 환영한다!</h2>
            <MasterTip>
              나는 이 공방의 스승이란다. <b>나전칠기</b>는 옻칠한 나무 위에 조개껍데기(자개)를 오려 붙여 꾸미는
              우리 전통 공예란다.
            </MasterTip>
            <ol className="flex flex-col gap-1.5 rounded-2xl bg-[#f8f2e8] p-3 text-[15px] text-[var(--brown)]">
              <li>📜 <b>의뢰 받기</b> — 손님 주문대로 만들어 엽전과 명성을 얻어요</li>
              <li>✏️ 디자인 → 🧵 삼베 → 🖌️ 옻칠 → 🌡️ 건조 → 🪚 자개 자르기</li>
              <li>🍯 붙이기 → ♨️ 다림질 → 📜 종이 떼기 → 🫙 메움칠 → ✨ 갈아내기</li>
              <li>🛒 번 돈으로 재료를 사고, 🏯 공방에 작품을 전시해요</li>
            </ol>
            <Btn
              variant="pink"
              size="lg"
              onClick={() => {
                setTutorialSeen();
                setSettings(false);
              }}
            >
              시작하기!
            </Btn>
            {settings && (
              <button className="text-sm text-[var(--red)] underline" onClick={() => setConfirmReset(true)}>
                저장 데이터 초기화
              </button>
            )}
          </div>
        </Modal>
      )}
      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <div className="flex flex-col gap-3 text-center text-[var(--brown)]">
            <p className="text-lg">정말 처음부터 다시 시작할까요?<br /><small>모든 작품과 엽전이 사라져요.</small></p>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="cream" onClick={() => setConfirmReset(false)}>취소</Btn>
              <Btn
                variant="pink"
                onClick={() => {
                  resetSave();
                  setConfirmReset(false);
                  setSettings(false);
                }}
              >
                초기화
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
