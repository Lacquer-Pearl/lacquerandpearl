"use client";

import { Btn } from "@/components/ui";
import { newPiece } from "@/lib/game";
import { clientLabel, t } from "@/lib/i18n";
import { useSave, useUI } from "@/lib/store";
import { sfx } from "@/lib/sound";
import { storyDialogue } from "@/lib/storyDialogue";
import { storyOrder, type Chapter } from "@/lib/workshopStory";

export default function StoryCommission({ chapter }: { chapter: Exclude<Chapter, "ending"> }) {
  const story = useSave(s => s.story);
  const lang = useSave(s => s.lang);
  const setLine = useSave(s => s.setStoryLine);
  const finishDelivery = useSave(s => s.finishDelivery);
  const progress = useSave(s => s.craftProgress);
  const go = useUI(s => s.go);
  if (!story.apprentice) return null;
  const ko = lang === "ko";
  const gift = chapter === "gift";
  const order = storyOrder(story.apprentice, chapter);
  const client = clientLabel(lang, order);
  const resume = !story.delivery && progress?.commission?.id === order.id;
  const title = gift ? (ko ? "첫 선물" : "The first gift") : (ko ? "달밤의 손님" : "The moonlit visitor");
  const dialogue = storyDialogue(chapter, !!story.delivery, lang, client.line, order.reward);
  const index = resume ? dialogue.length - 1 : Math.min(story.line ?? 0, dialogue.length - 1);
  const line = dialogue[index];
  const names = {
    friend: client.name, visitor: client.name,
    player: ko ? "나" : "You", thought: ko ? "나 · 속마음" : "Your thoughts",
    narrator: ko ? "공방" : "The workshop",
  };
  const portrait = client.portrait?.replace("/portraits/", "/story/").replace(".png", ".webp");
  const hesitantPortrait = gift && story.delivery ? portrait?.replace(".webp", "-hesitant.webp") : undefined;
  const hesitant = line.shot === "hesitation";
  const alone = line.shot === "bench" || line.shot === "late" || line.shot === "knock";
  const last = index === dialogue.length - 1;
  const action = line.next ?? (!last ? (ko ? "다음" : "Next") : resume ? t(lang, "craft.resume") : story.delivery
    ? (ko ? "의뢰 게시판 열기" : "Open commissions")
    : (gift ? (ko ? "나비문 선물 만들기" : "Make the butterfly gift") : (ko ? "손님의 의뢰 받기" : "Accept the commission")));
  function advance() {
    if (!last) {
      if (dialogue[index + 1].shot === "knock") sfx.knock();
      setLine(index + 1);
      return;
    }
    if (story.delivery) { finishDelivery(); return; }
    const ui = useUI.getState();
    if (resume) { ui.resumeCraft(); return; }
    ui.startCraft(order);
    const pearl = order.pearl!;
    ui.setDraft({
      shape: order.shape, lacquer: order.lacquer, pearl, lacquerChosen: true,
      pieces: gift
        ? []
        : [{ ...newPiece("cloudLine", pearl), x: 116, y: 142, s: 0.85 }, { ...newPiece("plum", pearl), x: 182, y: 145, s: 1 }],
    });
  }
  return (
    <section className="screen story-scene" data-chapter={chapter} data-shot={line.shot} data-speaker={line.speaker} aria-label={title}>
      <header className="story-heading">
        <button type="button" data-nav-back onClick={() => go("title")} aria-label={ko ? "공방으로" : "Back to workshop"}>
          ◀
        </button>
        <h1>{title}</h1>
      </header>
      <div className="story-figure" role="img" aria-label={client.name} aria-hidden={alone}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={portrait} alt="" data-visible={!alone && !hesitant} />
        {hesitantPortrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hesitantPortrait} alt="" data-visible={!alone && hesitant} />
        )}
      </div>
      <div className="story-dialogue">
        <div aria-live="polite" aria-atomic="true">
          <h2>{names[line.speaker]}</h2>
          <p key={index}>{line.text}</p>
        </div>
        <div className="story-controls">
          {index > 0 && !resume && <button type="button" className="story-prev" onClick={() => setLine(index - 1)}>{ko ? "이전 대사" : "Previous line"}</button>}
          <Btn variant="gold" sound={!gift || !story.delivery} onClick={advance}>{action}<span aria-hidden="true"> ›</span></Btn>
        </div>
      </div>
    </section>
  );
}
