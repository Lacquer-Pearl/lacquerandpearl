import type { Artwork, Commission } from "./game";
import type { Locale } from "./i18n";

export type Apprentice = "woman" | "man";
export type Chapter = "gift" | "visitor" | "ending";
export interface WorkshopStory {
  apprentice?: Apprentice;
  chapter: Chapter;
  delivery?: boolean;
  line?: number;
}
export const GIFT_ID = "workshop-friend-gift";
export const VISITOR_ID = "workshop-moonlit-visitor";

export function canAcceptCommission(story: WorkshopStory, id: string) {
  if (!story.apprentice || story.delivery) return false;
  if (id === GIFT_ID) return story.chapter === "gift";
  if (id === VISITOR_ID) return story.chapter === "visitor";
  return story.chapter === "ending";
}

export function storyOrder(apprentice: Apprentice, chapter: Exclude<Chapter, "ending">): Commission {
  const gift = chapter === "gift";
  const feminine = apprentice === "man";
  const portrait = gift
    ? feminine ? "npc_r02c02" : "npc_r02c04"
    : feminine ? "npc_r01c03" : "npc_r01c04";
  return {
    id: gift ? GIFT_ID : VISITOR_ID,
    shape: "box",
    lacquer: "black",
    pearl: gift ? "white" : "abalone",
    motifs: gift ? { butterfly: 1 } : { cloudLine: 1, plum: 1 },
    reward: gift ? 0 : 440,
    customer: feminine ? 1 : 0,
    line: "",
    patron: {
      id: gift ? "story-friend" : "story-visitor",
      nameKo: gift ? feminine ? "분이" : "재겸" : "달밤의 손님",
      nameEn: gift ? feminine ? "Bun-i" : "Jae-gyeom" : "Moonlit visitor",
      roleKo: gift ? "소꿉친구" : "이름을 밝히지 않은 의뢰인",
      roleEn: gift ? "Childhood friend" : "A stranger at the workshop",
      presentation: feminine ? "feminine" : "masculine",
      group: "fixed",
      fallbackCustomer: feminine ? 1 : 0,
      portrait: "/npc/portraits/" + portrait + ".png",
      lineKey: gift ? "npc.line.story.gift" : "npc.line.story.visitor",
    },
  };
}

export const ACHIEVEMENTS = {
  first: { ko: "첫 낙관", en: "First maker’s seal", coins: 20, rep: 5 },
  polish: { ko: "빛을 살린 손", en: "A steady polish", coins: 25, rep: 8 },
  patron: { ko: "궁으로 가는 길", en: "The palace road", coins: 50, rep: 15 },
} as const;
export type Achievement = keyof typeof ACHIEVEMENTS;

export function earnedAchievements(art: Artwork, owned: readonly Achievement[]): Achievement[] {
  const earned: Achievement[] = ["first"];
  if ((art.scores.sand ?? 0) >= 85) earned.push("polish");
  if (art.commissionId === VISITOR_ID) earned.push("patron");
  return earned.filter(id => !owned.includes(id));
}

export function achievementHint(id: Achievement, lang: Locale) {
  const ko = lang === "ko";
  if (id === "first") return ko ? "첫 작품 완성 · 선 구름 도안 해금" : "Finish a piece to unlock the line-cloud motif";
  if (id === "polish") return ko ? "연마 85점 이상" : "Score 85 or higher in polishing";
  return ko ? "달밤의 손님에게 작품 전달" : "Deliver the moonlit visitor’s commission";
}
