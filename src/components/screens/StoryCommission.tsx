"use client";

import Avatar from "@/components/Avatar";
import { Btn, Coin } from "@/components/ui";
import { newPiece } from "@/lib/game";
import { clientLabel, t } from "@/lib/i18n";
import { useSave, useUI } from "@/lib/store";
import { storyOrder } from "@/lib/workshopStory";

export default function StoryCommission() {
  const story = useSave(s => s.story);
  const lang = useSave(s => s.lang);
  const choose = useSave(s => s.chooseApprentice);
  const progress = useSave(s => s.craftProgress);
  const ko = lang === "ko";
  if (story.chapter === "ending") return (
    <section className="story-letter">
      <h2>{ko ? "궁으로 가는 길" : "The palace road"}</h2>
      <p>{ko ? "붉은 매듭의 패를 작업대에 걸었다. 궁에서 다시 만날 날까지, 오늘도 칠을 올린다." : "The red-tasseled token hangs above your bench. Until you meet again at court, there is work to do."}</p>
    </section>
  );
  if (!story.apprentice) return (
    <section className="story-letter">
      <h2>{ko ? "공방 이야기 · 첫 선물" : "Workshop story · The first gift"}</h2>
      <p>{ko ? "문밖에서 익숙한 발소리가 들린다. 오늘은 오래 품은 마음을 작은 나전함에 담아 소꿉친구에게 건네려 한다." : "You recognize the footsteps outside. Today you will tell your childhood friend how you feel, with a little inlaid box."}</p>
      <fieldset>
        <legend>{ko ? "어떤 견습 장인으로 시작할까요?" : "Choose your apprentice"}</legend>
        <div className="flex gap-2">
          <Btn variant="cream" onClick={() => choose("woman")}>{ko ? "여성 장인" : "Woman"}</Btn>
          <Btn variant="cream" onClick={() => choose("man")}>{ko ? "남성 장인" : "Man"}</Btn>
        </div>
      </fieldset>
    </section>
  );
  const gift = story.chapter === "gift";
  const order = storyOrder(story.apprentice, story.chapter);
  const client = clientLabel(lang, order);
  const resume = progress?.commission?.id === order.id;
  const start = () => {
    const ui = useUI.getState();
    if (resume) { ui.resumeCraft(); return; }
    ui.startCraft(order);
    const pearl = order.pearl!;
    ui.setDraft({
      shape: order.shape, lacquer: order.lacquer, pearl, lacquerChosen: true,
      pieces: gift
        ? [{ ...newPiece("butterfly", pearl), x: 153, y: 139 }]
        : [{ ...newPiece("cloudLine", pearl), x: 116, y: 142, s: 0.85 }, { ...newPiece("plum", pearl), x: 182, y: 145, s: 1 }],
    });
  };
  return (
    <section className="story-letter">
      <h2>{gift ? ko ? "첫 선물" : "The first gift" : ko ? "달밤의 의뢰" : "A moonlit commission"}</h2>
      <div className="flex items-center gap-3">
        <Avatar c={client.customer} portrait={client.portrait} />
        <div><b>{client.name}</b><p>“{client.line}”</p></div>
      </div>
      {!gift && <p>{t(lang, "board.reward")} <Coin /> {order.reward}</p>}
      <Btn variant="gold" onClick={start}>{resume ? t(lang, "craft.resume") : gift
        ? ko ? "나비문 선물 만들기" : "Make the butterfly gift"
        : ko ? "손님의 의뢰 받기" : "Accept the visitor’s commission"}</Btn>
    </section>
  );
}
