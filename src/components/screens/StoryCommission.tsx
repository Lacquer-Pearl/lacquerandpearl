"use client";

import { Btn } from "@/components/ui";
import { newPiece } from "@/lib/game";
import { clientLabel, t } from "@/lib/i18n";
import { useSave, useUI } from "@/lib/store";
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
  const me = ko ? "나" : "You";
  const title = gift ? (ko ? "첫 선물" : "The first gift") : (ko ? "달밤의 손님" : "The moonlit visitor");
  const scripts = {
    gift: { delivery: [
      [me, ko ? "눈을 감아 봐. 자, 이제 떠도 돼." : "Close your eyes. All right, you can look."],
      [client.name, ko ? "그해 여름까지 기억해 줬구나. 고마워. 나는 너와 오래 친구로 지내고 싶어." : "You remembered that summer. Thank you. I hope we can always be friends."],
      [me, ko ? "친구가 함을 두 손에 안고 돌아간다. 등잔을 끄려는데, 문밖에서 옷자락 스치는 소리가 난다." : "My friend leaves cradling the box. As I reach for the lamp, I hear a sleeve brush the door."],
    ], arrival: [
      [client.name, ko ? "나야. 문이 열려 있길래. 이젠 네가 이 작업대에 앉는구나." : "It’s me. Your door was open. So this is your workbench now."],
      [client.name, client.line],
      [me, ko ? "물론 기억하지. 해 질 무렵에 다시 들를래? 너한테 주고 싶은 게 있어." : "Of course I remember. Come back at dusk? There’s something I’d like to give you."],
      [me, ko ? "그 애가 가고 나서 흰 자개 한 장을 꺼낸다. 작은 흑칠함 위에, 그 여름의 나비를 앉혀 보자." : "When the footsteps fade, I take out a piece of white shell. A butterfly from that summer, resting on a little black lacquer box."],
    ] },
    visitor: { delivery: [
      [client.name, ko ? "문을 조금만 열어 주시오. ……보시오. 구름 끝에서 매화까지 달빛이 건너가는군." : "Open the door a little. Look there. The moonlight moves from the edge of the cloud to the plum blossom."],
      [client.name, ko ? "다음에는 그대 이름으로 만든 작품을 보고 싶소." : "Next time, let me see a piece that bears your name."],
      [me, ko ? "손님이 서 있던 자리에 붉은 매듭의 패가 남았다. 뒤집어 보니 왕실의 문장이다. 다시 만날 땐 내 이름을 새긴 함을 건네고 싶다." : "A red-tasseled token lies where the visitor stood. On its back is the royal crest. When we meet again, I want to offer a box signed with my own name."],
    ], arrival: [
      [client.name, ko ? "늦은 시각에 실례하오. 아까 그 나비가 문밖에서도 보이더군. 잠시 들어가도 되겠소?" : "Forgive the late hour. I saw that butterfly from the doorway. May I come in?"],
      [me, ko ? "등잔을 다시 밝힌다. 손님은 이름을 대는 대신 검은 함 뚜껑 위에 손끝으로 둥근 선을 그린다." : "I turn the lamp up again. Instead of giving a name, the visitor traces a curve on the lid of a black box."],
      [client.name, client.line],
      [client.name, ko ? `삯은 ${order.reward}닢으로 하겠소. 다 되거든, 오늘처럼 달이 뜬 뒤에 보여 주시오.` : `I offer ${order.reward} coins. When it is ready, show it to me after moonrise, just like tonight.`],
    ] },
  };
  const dialogue = scripts[chapter][story.delivery ? "delivery" : "arrival"];
  const index = resume ? dialogue.length - 1 : Math.min(story.line ?? 0, dialogue.length - 1);
  const last = index === dialogue.length - 1;
  const action = !last ? (ko ? "다음" : "Next") : resume ? t(lang, "craft.resume") : story.delivery
    ? (gift ? (ko ? "달밤의 손님 만나기" : "Meet the moonlit visitor") : (ko ? "의뢰 게시판 열기" : "Open commissions"))
    : (gift ? (ko ? "나비문 선물 만들기" : "Make the butterfly gift") : (ko ? "손님의 의뢰 받기" : "Accept the commission"));
  function advance() {
    if (!last) { setLine(index + 1); return; }
    if (story.delivery) { finishDelivery(); return; }
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
  }
  return (
    <section className="screen story-scene" data-chapter={chapter} aria-label={title}>
      <header className="story-heading">
        <button type="button" data-nav-back onClick={() => go("title")} aria-label={ko ? "공방으로" : "Back to workshop"}>‹</button>
        <h1>{title}</h1>
      </header>
      <div className="story-figure">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={client.portrait?.replace("/portraits/", "/story/").replace(".png", ".webp")} alt={client.name} />
      </div>
      <div className="story-dialogue">
        <div aria-live="polite" aria-atomic="true">
          <h2>{dialogue[index][0]}</h2>
          <p key={index}>{dialogue[index][1]}</p>
        </div>
        <div className="story-controls">
          {index > 0 && !resume && <button type="button" className="story-prev" onClick={() => setLine(index - 1)}>{ko ? "이전 대사" : "Previous line"}</button>}
          <Btn variant="gold" onClick={advance}>{action}<span aria-hidden="true"> ›</span></Btn>
        </div>
      </div>
    </section>
  );
}
