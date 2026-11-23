import type { Locale } from "./i18n";
import type { Chapter } from "./workshopStory";

export interface StoryLine {
  speaker: "friend" | "visitor" | "player" | "thought" | "narrator";
  text: string;
  shot?: "close" | "hesitation" | "bench" | "late" | "knock";
  next?: string;
}

export function storyDialogue(
  chapter: Exclude<Chapter, "ending">, delivery: boolean, lang: Locale, request: string, reward: number,
): StoryLine[] {
  const ko = lang === "ko";
  if (chapter === "gift" && delivery) return [
    { speaker: "player", text: ko
      ? "자, 이제 눈 떠도 돼. 네 거야."
      : "All right. Open your eyes. It’s yours." },
    { speaker: "friend", shot: "close", text: ko
      ? "우리 뒤뜰에 오던 흰나비잖아! 이것 봐, 날개 끝에 빛이 앉았어. 얼른 이쪽에서 봐 봐."
      : "It’s the white butterfly from our yard! Look, there’s a little light on the tip of its wing. Come see it from here." },
    { speaker: "narrator", shot: "close", text: ko
      ? "친구가 내 소매를 당긴다. 어깨를 맞대고 들여다보니 검은 뚜껑에 웃는 얼굴이 둘이다."
      : "My friend tugs my sleeve. We lean in shoulder to shoulder. Two grinning faces look back at us from the black lacquer." },
    { speaker: "player", text: ko
      ? "이거 만드는 내내 네가 그렇게 웃어 주면 좋겠다고 생각했어. 나 있잖아… 너를 좋아해."
      : "Every time I polished it, I thought about that smile. There’s something I’ve been wanting to tell you. I’ve fallen for you." },
    { speaker: "narrator", shot: "hesitation", text: ko
      ? "내 소매를 쥐고 있던 손이 풀린다. 친구는 함을 꼭 안고 나비만 내려다본다. 한참 동안."
      : "The fingers at my sleeve loosen. My friend holds the box close and looks down at the butterfly. For a long moment, neither of us speaks." },
    { speaker: "friend", shot: "hesitation", text: ko
      ? "…고마워. 나한텐 네가 제일 좋은 친구야. 근데 네가 말한 그런 마음은 아니야. 미안해."
      : "…Thank you. You’re my dearest friend. I wish I could tell you I felt the same way. I’m sorry." },
    { speaker: "player", shot: "hesitation", text: ko
      ? "아… 응. 그래도 함은 가져가. 처음부터 네 거였어."
      : "Oh. Right. Take the box, though. It was always yours." },
    { speaker: "friend", shot: "hesitation", text: ko
      ? "응. 나 이거 오래오래 쓸게. …내일도 여기 와도 돼?"
      : "I will. I’m going to keep it for a long, long time. …May I still come by tomorrow?" },
    { speaker: "narrator", shot: "bench", text: ko
      ? "겨우 고개를 끄덕여 배웅한다. 문이 닫힌 뒤에도 아까 그 애가 잡았던 소맷자락만 매만진다."
      : "I manage a nod at the door. Only after it closes do I smooth the little crease where my friend held my sleeve." },
    { speaker: "thought", shot: "bench", text: ko
      ? "그냥 예뻐서 웃은 거였구나. 나는 잠깐, 너도 나랑 같은 마음인 줄 알았어."
      : "You smiled because you loved the butterfly. For a moment there, I thought you might love me too.",
      next: ko ? "잠시 앉아 있기" : "Sit for a while" },
    { speaker: "narrator", shot: "late", text: ko
      ? "한참 뒤, 작업대에 남은 자개 부스러기를 하나씩 쓸어 담는다. 어느새 창살 그림자가 빈 의자까지 길게 뻗었다."
      : "Much later, I gather the slivers of shell from the bench, one by one. The shadow of the window lattice has stretched across the empty chair.",
      next: ko ? "등잔 심지 돋우기" : "Turn up the lamp" },
    { speaker: "narrator", shot: "knock", text: ko
      ? "똑, 똑. 심지를 돋우던 손을 멈춘다. 이 늦은 시각에 누구지?"
      : "Knock, knock. My hand stops at the wick. Who could be calling at this hour?",
      next: ko ? "문 열기" : "Open the door" },
  ];
  if (chapter === "gift") return [
    { speaker: "friend", text: ko ? "나야. 문이 열려 있길래. 이젠 네가 이 작업대에 앉는구나." : "It’s me. Your door was open. So this is your workbench now." },
    { speaker: "friend", text: request },
    { speaker: "player", text: ko
      ? "기억하지. 해 질 무렵에 다시 들를래? 그때 꼭 해 주고 싶은 말이 있어."
      : "Of course I remember. Come back at dusk? There’s something I’d like to tell you." },
    { speaker: "thought", shot: "bench", text: ko
      ? "발소리가 멀어지자 흰 자개 한 장을 꺼낸다. 작은 흑칠함 위에, 그 애가 좋아하던 여름 나비를 앉혀 보자."
      : "When the footsteps fade, I take out a piece of white shell. A butterfly from that summer, resting on a little black lacquer box." },
  ];
  if (delivery) return [
    { speaker: "visitor", text: ko ? "문을 조금만 열어 주시오. ……보시오. 구름 끝에서 매화까지 달빛이 건너가는군." : "Open the door a little. Look there. The moonlight moves from the edge of the cloud to the plum blossom." },
    { speaker: "visitor", text: ko ? "다음에는 그대 이름으로 만든 작품을 보고 싶소." : "Next time, let me see a piece that bears your name." },
    { speaker: "thought", shot: "late", text: ko ? "손님이 서 있던 자리에 붉은 매듭의 패가 남았다. 뒤집어 보니 왕실의 문장이다. 다시 만날 땐 내 이름을 새긴 함을 건네고 싶다." : "A red-tasseled token lies where the visitor stood. On its back is the royal crest. When we meet again, I want to offer a box signed with my own name." },
  ];
  return [
    { speaker: "visitor", text: ko ? "늦은 시각에 실례하오. 해 질 녘 이 문간에서 흰나비 한 마리를 보았소. 누군가 소중히 안고 가던 함 위에서 말이오." : "Forgive the late hour. At dusk I saw a white butterfly in this doorway, on a box someone was holding very close." },
    { speaker: "narrator", text: ko ? "손님은 등잔 곁에 앉아, 이름을 대는 대신 검은 함 뚜껑 위에 손끝으로 둥근 선을 그린다." : "The visitor sits by the lamp. Instead of giving a name, they trace a curve on the lid of a black box." },
    { speaker: "visitor", text: request },
    { speaker: "visitor", text: ko ? `삯은 ${reward}닢으로 하겠소. 다 되거든, 오늘처럼 달이 뜬 뒤에 보여 주시오.` : `I offer ${reward} coins. When it is ready, show it to me after moonrise, just like tonight.` },
  ];
}
