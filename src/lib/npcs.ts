import manifest from "./npcManifest.json";

/**
 * 일반 의뢰인 초상화와 이름.
 *
 * 새 NPC를 넣을 때
 * 1. `public/npc/portraits/`에 PNG를 두고 `src/lib/npcManifest.json`에 한 줄 추가한다.
 * 2. 아래 `COPY`에 같은 id로 영어 이름·직업명을 넣는다. 외국인만 `nameKo`로 한글 이름을 덮어쓴다.
 * 3. 초상화가 없는 이름만 늘리려면 `EXTRA_NAMES`에 그 유형으로 추가한다.
 *    초상화의 이름은 추천 이름을 그대로 쓴다. 얼굴과 다른 이름을 섞지 않는다.
 * 4. `group`이 `fixed`이거나 `is_story_npc`인 인물은 의뢰 추첨에서 빠진다.
 *
 * `presentation`은 그림의 외형 분류다. 인물의 성별 설정이 아니다.
 */

export type NpcGroup =
  | "artisan"
  | "official"
  | "scholar"
  | "lady"
  | "merchant"
  | "commoner"
  | "foreigner"
  | "fixed";

export type NpcPresentation = "feminine" | "masculine";

export interface Patron {
  id: string;
  portrait: string;
  group: NpcGroup;
  presentation: NpcPresentation;
  nameKo: string;
  nameEn: string;
  roleKo: string;
  roleEn: string;
  /** i18n 키. 의뢰가 생긴 순간 고정된다. */
  lineKey: string;
  /** 이미지가 없을 때 쓸 기존 손님 그림 */
  fallbackCustomer: number;
}

export interface PatronRequest {
  avoidIds?: string[];
  avoidNames?: string[];
  recentIds?: string[];
  avoidLineKeys?: string[];
}

interface NpcRecord {
  id: string;
  portrait: string;
  group: NpcGroup;
  presentation: NpcPresentation;
  roleKo: string;
  roleEn: string;
  nameKo: string;
  nameEn: string;
  story: boolean;
}

const GROUPS: NpcGroup[] = [
  "artisan",
  "official",
  "scholar",
  "lady",
  "merchant",
  "commoner",
  "foreigner",
  "fixed",
];

const COPY: Record<string, { nameEn: string; roleEn: string; nameKo?: string }> = {
  npc_r01c01: { nameEn: "Jang Sundeok", roleEn: "Master artisan" },
  npc_r01c02: { nameEn: "Lee Yungyeom", roleEn: "Official" },
  npc_r01c03: { nameEn: "Yun Seohwa", roleEn: "Young lady of a yangban house" },
  npc_r01c04: { nameEn: "Han Dogyeom", roleEn: "Yangban gentleman" },
  npc_r01c05: { nameEn: "Edward", roleEn: "British visitor", nameKo: "에드워드" },
  npc_r01c06: { nameEn: "Kim Manbok", roleEn: "Merchant" },
  npc_r01c07: { nameEn: "Park Yeonsil", roleEn: "Workshop artisan" },
  npc_r01c08: { nameEn: "Seo Jeonghun", roleEn: "Scholar" },
  npc_r02c01: { nameEn: "Choi Deoksu", roleEn: "Woodworker" },
  npc_r02c02: { nameEn: "Song Buni", roleEn: "Workshop apprentice" },
  npc_r02c03: { nameEn: "Jeong Yeonhwa", roleEn: "Lady of a yangban house" },
  npc_r02c04: { nameEn: "Im Jaegyeom", roleEn: "Scholar" },
  npc_r02c05: { nameEn: "Lee Chaeryeon", roleEn: "Young lady of a yangban house" },
  npc_r02c06: { nameEn: "Yun Seokdol", roleEn: "Nacre appraiser" },
  npc_r02c07: { nameEn: "Oh Gildong", roleEn: "Porter and peddler" },
  npc_r02c08: { nameEn: "Clara", roleEn: "European visitor", nameKo: "클라라" },
  npc_r03c01: { nameEn: "Han Bokrye", roleEn: "Nacre merchant" },
  npc_r03c02: { nameEn: "Jo Chunsik", roleEn: "Merchant" },
  npc_r03c03: { nameEn: "Jang Oki", roleEn: "Material seller" },
  npc_r03c04: { nameEn: "Hong Mansu", roleEn: "Caravan master" },
  npc_r03c05: { nameEn: "Baek Dohyeon", roleEn: "Scholar" },
  npc_r03c06: { nameEn: "Kim Sodam", roleEn: "Craft patron" },
  npc_r03c07: { nameEn: "Park Haksu", roleEn: "Senior artisan" },
  npc_r03c08: { nameEn: "Lee Seongbok", roleEn: "Lacquer artisan" },
  npc_r04c01: { nameEn: "Min Jaeha", roleEn: "Yangban gentleman" },
  npc_r04c02: { nameEn: "Choi Kkotbun", roleEn: "Flower seller" },
  npc_r04c03: { nameEn: "Jo Deokgu", roleEn: "Farmer" },
  npc_r04c04: { nameEn: "Kim Jeongheon", roleEn: "Scholar" },
  npc_r04c05: { nameEn: "Seo Yeonhui", roleEn: "Young lady of a yangban house" },
  npc_r04c06: { nameEn: "Nam Seongwon", roleEn: "Official" },
  npc_r04c07: { nameEn: "Oh Geumsun", roleEn: "Market vendor" },
  npc_r04c08: { nameEn: "Bae Manbok", roleEn: "Peddler" },
  npc_r05c01: { nameEn: "Hwang Yeonsil", roleEn: "Market vendor" },
  npc_r05c02: { nameEn: "Im Boknam", roleEn: "Food vendor" },
  npc_r05c03: { nameEn: "Kang Dochi", roleEn: "Workshop errand boy" },
  npc_r05c04: { nameEn: "Yun Maehwa", roleEn: "Craft patron" },
  npc_r05c05: { nameEn: "Lee Manseok", roleEn: "Senior artisan" },
  npc_r05c06: { nameEn: "Shin Chohui", roleEn: "Herb and flower seller" },
  npc_r05c07: { nameEn: "Choi Jaemun", roleEn: "Traveler" },
  npc_r05c08: { nameEn: "Song Arin", roleEn: "Young patron" },
};

/** 초상화가 아직 없는 이름. 의뢰에는 배정하지 않고, 같은 유형의 초상화를 추가할 때 쓴다. */
export const EXTRA_NAMES: Record<NpcGroup, { ko: string; en: string }[]> = {
  fixed: [],
  official: [
    { ko: "조시묵", en: "Jo Simuk" },
    { ko: "한치서", en: "Han Chiseo" },
  ],
  scholar: [
    { ko: "유학준", en: "Yu Hakjun" },
    { ko: "남시원", en: "Nam Siwon" },
  ],
  lady: [
    { ko: "박단아", en: "Park Dana" },
    { ko: "이설화", en: "Lee Seolhwa" },
  ],
  merchant: [
    { ko: "최복만", en: "Choi Bokman" },
    { ko: "강달이", en: "Kang Dali" },
  ],
  artisan: [
    { ko: "문쇠돌", en: "Mun Soedol" },
    { ko: "정가람", en: "Jeong Garam" },
  ],
  commoner: [
    { ko: "박돌쇠", en: "Park Dolsoe" },
    { ko: "윤막례", en: "Yun Makrye" },
  ],
  foreigner: [
    { ko: "윌리엄", en: "William" },
    { ko: "엘리자베스", en: "Elizabeth" },
    { ko: "피에르", en: "Pierre" },
    { ko: "마리", en: "Marie" },
  ],
};

const FALLBACK_CUSTOMER: Record<NpcGroup, number> = {
  scholar: 0,
  lady: 1,
  commoner: 2,
  foreigner: 3,
  official: 4,
  artisan: 0,
  merchant: 5,
  fixed: 0,
};

const LINE_VARIANTS = 4;

function presentationOf(label: string): NpcPresentation {
  return label === "여성형" ? "feminine" : "masculine";
}

function buildNpcs(): NpcRecord[] {
  return manifest.npcs.map((raw) => {
    const copy = COPY[raw.id];
    if (!copy) throw new Error(`NPC 번역이 없습니다: ${raw.id}`);
    if (!GROUPS.includes(raw.group as NpcGroup)) throw new Error(`NPC 유형이 잘못되었습니다: ${raw.id}`);
    const group = raw.group as NpcGroup;
    return {
      id: raw.id,
      portrait: raw.portrait,
      group,
      presentation: presentationOf(raw.gender_presentation),
      roleKo: raw.role_ko,
      roleEn: copy.roleEn,
      nameKo: copy.nameKo ?? raw.suggested_name_ko,
      nameEn: copy.nameEn,
      story: raw.is_story_npc || group === "fixed",
    };
  });
}

export const NPCS: NpcRecord[] = buildNpcs();

export function namesForGroup(group: NpcGroup) {
  const bound = NPCS.filter((n) => n.group === group).map((n) => ({ ko: n.nameKo, en: n.nameEn }));
  return [...bound, ...EXTRA_NAMES[group]];
}

export function lineKeysFor(group: NpcGroup) {
  if (group === "fixed") return [];
  return Array.from({ length: LINE_VARIANTS }, (_, i) => `npc.line.${group}.${i}`);
}

for (const npc of NPCS) {
  const pool = namesForGroup(npc.group);
  if (!pool.some((n) => n.ko === npc.nameKo && n.en === npc.nameEn)) {
    throw new Error(`이름 풀에 없습니다: ${npc.id}`);
  }
}

const CLIENTS = NPCS.filter((n) => !n.story);

function pickOne<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** 게시판에 없는 사람, 그중에서도 최근에 안 나온 사람을 고른다. 후보가 없으면 중복을 허용한다. */
export function pickPatron(req: PatronRequest = {}): Patron {
  const avoidIds = new Set(req.avoidIds ?? []);
  const avoidNames = new Set(req.avoidNames ?? []);
  const recent = new Set(req.recentIds ?? []);
  const free = CLIENTS.filter(
    (n) => !avoidIds.has(n.id) && !avoidNames.has(n.nameKo) && !avoidNames.has(n.nameEn),
  );
  const fresh = free.filter((n) => !recent.has(n.id));
  const npc = pickOne(fresh.length ? fresh : free.length ? free : CLIENTS);
  const keys = lineKeysFor(npc.group);
  const used = new Set(req.avoidLineKeys ?? []);
  const open = keys.filter((key) => !used.has(key));
  return {
    id: npc.id,
    portrait: npc.portrait,
    group: npc.group,
    presentation: npc.presentation,
    nameKo: npc.nameKo,
    nameEn: npc.nameEn,
    roleKo: npc.roleKo,
    roleEn: npc.roleEn,
    lineKey: pickOne(open.length ? open : keys),
    fallbackCustomer: FALLBACK_CUSTOMER[npc.group],
  };
}

export const NPC_RECENT_LIMIT = 24;

export function rememberNpcs(recent: string[], ids: string[]) {
  const incoming = ids.filter(Boolean);
  const kept = recent.filter((id) => !incoming.includes(id));
  return [...kept, ...incoming].slice(-NPC_RECENT_LIMIT);
}

const PRESENTATIONS: NpcPresentation[] = ["feminine", "masculine"];

export function sanitizePatron(raw: unknown): Patron | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.portrait !== "string") return undefined;
  if (!p.portrait.startsWith("/npc/portraits/")) return undefined;
  if (typeof p.nameKo !== "string" || typeof p.nameEn !== "string") return undefined;
  if (typeof p.roleKo !== "string" || typeof p.roleEn !== "string") return undefined;
  if (typeof p.lineKey !== "string" || !p.lineKey.startsWith("npc.line.")) return undefined;
  if (typeof p.group !== "string" || !GROUPS.includes(p.group as NpcGroup)) return undefined;
  if (typeof p.presentation !== "string" || !PRESENTATIONS.includes(p.presentation as NpcPresentation)) {
    return undefined;
  }
  const fallback = p.fallbackCustomer;
  return {
    id: p.id,
    portrait: p.portrait,
    group: p.group as NpcGroup,
    presentation: p.presentation as NpcPresentation,
    nameKo: p.nameKo,
    // 예전 저장의 "Choi Jae-mun" → "Choi Jaemun"
    nameEn: p.nameEn.replace(/-/g, ""),
    roleKo: p.roleKo,
    roleEn: p.roleEn,
    lineKey: p.lineKey,
    fallbackCustomer: typeof fallback === "number" && fallback >= 0 && fallback <= 5 ? fallback : 0,
  };
}
