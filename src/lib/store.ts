"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CRAFT_COST, MATERIALS, MOTIF_LIST, PEARLS, type MaterialId, type MotifId, type PearlId } from "./data";
import type { PieceCutResult, RecutSession } from "./cutFragments";
import {
  addCommissions,
  type Artwork,
  type Commission,
  type Design,
  type PlacedPiece,
  type StepScores,
} from "./game";
import {
  commitNest,
  emptyLedger,
  largeKey,
  markCut,
  reconcileProgress,
  releaseReservation,
  sealCut,
  sanitizeLedger,
  type ShellLedger,
  type ShellPlacement,
  type ShellPlan,
  type ShellStock,
} from "./shellNest";
import type { Locale } from "./i18n";
import { rememberNpcs, sanitizePatron } from "./npcs";
import { ACHIEVEMENTS, earnedAchievements, GIFT_ID, VISITOR_ID, type Achievement, type Apprentice, type WorkshopStory } from "./workshopStory";

export type Inventory = Record<MaterialId, number>;

/** 제작 중 저장 — 완료된 단계 점수까지 보관하고, 현재 단계부터 이어함 */
export interface CraftProgress {
  design: Design;
  commission?: Commission;
  stepIdx: number;
  scores: StepScores;
  placed: PlacedPiece[];
  /** 조각마다의 절단 결과. 없으면 예전 저장처럼 모두 온전하다. */
  cutResults?: PieceCutResult[];
  /** 자개패 구획. 없으면 구획 단계가 생기기 전의 저장이다. */
  shellPlan?: ShellPlan;
  legacyPearlPaid?: boolean;
  stepModel?: "design-nest";
  /** 구획 단계에 있다가 확정하지 않고 나간 제작. 줄음질 전에 구획을 마친다. */
  nestPending?: boolean;
  /** 파손 뒤 다시 자르는 중. 없으면 절단이 확정된 상태다. */
  recutSession?: RecutSession;
  sandOver?: number;
  /** 개발자 단계 시험. 본 세이브의 이어하기와 재고를 건드리지 않는다. */
  dev?: boolean;
  savedAt: number;
}

const START_INVENTORY: Inventory = {
  wood: 2,
  hemp: 2,
  lacquer: 6,
  glue: 2,
  pearlWhite: 12,
  pearlAbalone: 3,
  pearlBlack: 2,
  pearlPaua: 2,
  pearlWhiteLarge: 0,
  pearlAbaloneLarge: 0,
  pearlBlackLarge: 0,
  pearlPauaLarge: 0,
};

interface SaveState {
  startWorkshop: (progress: CraftProgress, polygonsFor: (placement: ShellPlacement) => { x: number; y: number }[][]) => { ok: true } | { ok: false; missing: PearlId; large?: boolean };
  story: WorkshopStory;
  achievements: Achievement[];
  chooseApprentice: (apprentice: Apprentice) => void;
  money: number;
  reputation: number;
  inventory: Inventory;
  commissions: Commission[];
  gallery: Artwork[];
  muted: boolean;
  musicOn: boolean;
  lang: Locale;
  tutorialSeen: boolean;
  learned: string[];
  learn: (stage: string) => void;
  realCraftInterest: string[];
  redeemedCoupons: string[];
  surveyClaimed: boolean;
  craftProgress: CraftProgress | null;
  /** 열어 둔 자개패와 이미 잘라 낸 영역. 미사용 장수는 inventory 에 있다. */
  shellLedger: ShellLedger;
  /** 최근에 등장한 의뢰인 id. 새 의뢰가 같은 사람을 바로 다시 뽑지 않게 한다. */
  npcRecent: string[];

  buy: (id: MaterialId) => boolean;
  /** 엽전을 낸다. 모자라면 false */
  payCoins: (amount: number) => boolean;
  /** "ok" | "used" | "invalid" */
  redeemCoupon: (code: string) => "ok" | "used" | "invalid";
  /** 설문 참여 보상 (1회) */
  claimSurveyReward: () => boolean;
  missingFor: (design: Pick<Design, "pearl" | "pieces">) => MaterialId[];
  /** 백골·삼베·옻칠·아교만 차감한다. 자개패는 구획을 확정할 때 연다. */
  consumeFor: (design: Pick<Design, "pearl" | "pieces">) => boolean;
  commitShellPlan: (
    plan: ShellPlan,
    polygonsFor: (placement: ShellPlacement) => { x: number; y: number }[][],
    legacyPrepaid?: boolean,
    ownedPieceIds?: string[],
  ) => { ok: true } | { ok: false; missing: PearlId; large?: boolean };
  markShellCut: (pieceId: string) => void;
  /** 파손된 문양의 잘린 자리를 남기고, 그 문양만 다시 구획할 수 있게 한다. */
  sealShellPiece: (pieceId: string) => void;
  ensureCommissions: () => void;
  refreshCommissions: () => void;
  finishArtwork: (art: Artwork, repGain: number) => Artwork;
  sellArtwork: (id: string) => void;
  setMuted: (m: boolean) => void;
  setMusic: (m: boolean) => void;
  setLang: (lang: Locale) => void;
  setTutorialSeen: () => void;
  toggleInterest: (id: string) => void;
  saveCraftProgress: (p: CraftProgress) => void;
  clearCraftProgress: () => void;
  resetSave: () => void;
}

/** 제작을 시작할 때 바로 드는 재료. 자개패는 포함하지 않는다. */
export function costFor(_design: Pick<Design, "pearl" | "pieces">) {
  return { ...CRAFT_COST };
}

/** 미개봉 자개패 재고. 보통 자개패는 진주 종류 키, 대형은 `:large` 키에 담는다. */
export function pearlStock(inventory: Inventory): ShellStock {
  const stock: ShellStock = {};
  for (const pearl of Object.values(PEARLS)) {
    stock[pearl.id] = inventory[pearl.material] ?? 0;
    stock[largeKey(pearl.id)] = inventory[pearl.largeMaterial] ?? 0;
  }
  return stock;
}

function applyPearlStock(inventory: Inventory, stock: ShellStock): Inventory {
  const next = { ...inventory };
  for (const pearl of Object.values(PEARLS)) {
    next[pearl.material] = stock[pearl.id] ?? inventory[pearl.material];
    next[pearl.largeMaterial] = stock[largeKey(pearl.id)] ?? inventory[pearl.largeMaterial];
  }
  return next;
}

const initial = {
  story: { chapter: "gift" } as WorkshopStory,
  achievements: [] as Achievement[],
  money: 150,
  reputation: 0,
  inventory: START_INVENTORY,
  commissions: [] as Commission[],
  gallery: [] as Artwork[],
  muted: false,
  musicOn: true,
  lang: "ko" as Locale,
  tutorialSeen: false,
  learned: [] as string[],
  realCraftInterest: [] as string[],
  redeemedCoupons: [] as string[],
  surveyClaimed: false,
  craftProgress: null as CraftProgress | null,
  shellLedger: emptyLedger(),
  npcRecent: [] as string[],
};

const COUPONS: Record<string, number> = {
  SAMUELKIHOON: 1911,
};

const SURVEY_REWARD = 100;
/** 기계 가공 한 조각 값 */
export const MACHINE_CUT_COST = 10;

export const useSave = create<SaveState>()(
  persist(
    (set, get) => ({
      ...initial,
      startWorkshop: (progress, polygonsFor) => {
        const s = get();
        if (!progress.shellPlan || s.missingFor(progress.design).length) return { ok: false, missing: progress.design.pearl };
        let ledger = s.shellLedger;
        for (const piece of s.craftProgress?.design.pieces ?? []) ledger = releaseReservation(ledger, piece.id, polygonsFor);
        const result = commitNest({ stock: pearlStock(s.inventory), ledger, plan: progress.shellPlan, polygonsFor });
        if (!result.ok) return result;
        const inventory = applyPearlStock(s.inventory, result.stock);
        for (const [key, cost] of Object.entries(CRAFT_COST) as [MaterialId, number][]) inventory[key] -= cost;
        set({ inventory, shellLedger: result.ledger, craftProgress: { ...progress, shellPlan: result.plan } });
        return { ok: true };
      },
      chooseApprentice: (apprentice) => {
        if (!get().story.apprentice) set({ story: { ...get().story, apprentice } });
      },

      buy: (id) => {
        const m = MATERIALS[id];
        const { money, inventory } = get();
        if (money < m.price) return false;
        set({ money: money - m.price, inventory: { ...inventory, [id]: inventory[id] + m.pack } });
        return true;
      },

      payCoins: (amount) => {
        const { money } = get();
        if (money < amount) return false;
        set({ money: money - amount });
        return true;
      },

      redeemCoupon: (raw) => {
        const code = raw.trim().toUpperCase();
        const reward = COUPONS[code];
        if (!reward) return "invalid";
        const { redeemedCoupons, money } = get();
        if (redeemedCoupons.includes(code)) return "used";
        set({ money: money + reward, redeemedCoupons: [...redeemedCoupons, code] });
        return "ok";
      },

      claimSurveyReward: () => {
        const { surveyClaimed, money } = get();
        if (surveyClaimed) return false;
        set({ surveyClaimed: true, money: money + SURVEY_REWARD });
        return true;
      },

      missingFor: (design) => {
        const inv = get().inventory;
        return (Object.entries(costFor(design)) as [MaterialId, number][])
          .filter(([k, n]) => inv[k] < n)
          .map(([k]) => k);
      },

      consumeFor: (design) => {
        if (get().missingFor(design).length) return false;
        const inv = { ...get().inventory };
        for (const [k, n] of Object.entries(costFor(design)) as [MaterialId, number][]) inv[k] -= n;
        set({ inventory: inv });
        return true;
      },

      commitShellPlan: (plan, polygonsFor, legacyPrepaid, ownedPieceIds) => {
        const result = commitNest({
          stock: pearlStock(get().inventory),
          ledger: get().shellLedger,
          plan,
          legacyPrepaid,
          ownedPieceIds,
          polygonsFor,
        });
        if (!result.ok) return result;
        set({ inventory: applyPearlStock(get().inventory, result.stock), shellLedger: result.ledger });
        return { ok: true };
      },

      markShellCut: (pieceId) => set({ shellLedger: markCut(get().shellLedger, pieceId) }),

      sealShellPiece: (pieceId) => set({ shellLedger: sealCut(get().shellLedger, pieceId) }),

      ensureCommissions: () => {
        const { commissions, reputation, npcRecent } = get();
        if (commissions.length >= 3) return;
        const { added, recentIds } = addCommissions(reputation, commissions, npcRecent, 3 - commissions.length);
        set({ commissions: [...commissions, ...added], npcRecent: recentIds });
      },

      refreshCommissions: () => {
        const { commissions, reputation, npcRecent } = get();
        const prior = commissions.flatMap((c) => (c.patron ? [c.patron.id] : []));
        const { added, recentIds } = addCommissions(reputation, [], rememberNpcs(npcRecent, prior), 3);
        set({ commissions: added, npcRecent: recentIds });
      },

      finishArtwork: (art, repGain) => {
        const s = get();
        const existing = s.gallery.find(a => a.id === art.id);
        if (existing) return existing;
        const awards = earnedAchievements(art, s.achievements);
        const recorded = { ...art, achievements: awards };
        const chapter = art.commissionId === GIFT_ID && s.story.chapter === "gift"
          ? "visitor" : art.commissionId === VISITOR_ID && s.story.chapter === "visitor" ? "ending" : s.story.chapter;
        const done = s.commissions.find((c) => c.id === art.commissionId);
        set({
          gallery: [recorded, ...s.gallery].slice(0, 60),
          craftProgress: null,
          story: { ...s.story, chapter },
          achievements: [...s.achievements, ...awards],
          money: s.money + art.earned + awards.reduce((n, id) => n + ACHIEVEMENTS[id].coins, 0),
          reputation: s.reputation + repGain + awards.reduce((n, id) => n + ACHIEVEMENTS[id].rep, 0),
          npcRecent: done?.patron ? rememberNpcs(s.npcRecent, [done.patron.id]) : s.npcRecent,
          commissions: art.commissionId
            ? s.commissions.filter((c) => c.id !== art.commissionId)
            : s.commissions,
        });
        get().ensureCommissions();
        return recorded;
      },

      sellArtwork: (id) => {
        const s = get();
        const art = s.gallery.find((a) => a.id === id);
        if (!art || art.sold) return;
        set({
          money: s.money + art.value,
          gallery: s.gallery.map((a) => (a.id === id ? { ...a, sold: true, earned: a.value } : a)),
        });
      },

      setMuted: (muted) => set({ muted }),
      setMusic: (musicOn) => set({ musicOn }),
      setLang: (lang) => set({ lang }),
      setTutorialSeen: () => set({ tutorialSeen: true }),
      learn: (stage) => {
        if (!get().learned.includes(stage)) set({ learned: [...get().learned, stage] });
      },
      toggleInterest: (id) => {
        const list = get().realCraftInterest;
        set({ realCraftInterest: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
      },
      saveCraftProgress: (craftProgress) => set({ craftProgress }),
      clearCraftProgress: () => set({ craftProgress: null }),
      resetSave: () => {
        set({ ...initial, commissions: [] });
        get().ensureCommissions();
      },
    }),
    {
      name: "lacquer-pearl-save",
      version: 2,
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<SaveState> | undefined;
        const listed = new Set(MOTIF_LIST.map((m) => m.id));
        const lang = p?.lang === "en" || p?.lang === "ko" ? p.lang : current.lang;
        return {
          ...current,
          ...p,
          lang,
          learned: Array.isArray(p?.learned) ? p.learned.filter(stage => typeof stage === "string") : [],
          story: p?.story && ["gift", "visitor", "ending"].includes(p.story.chapter) ? p.story : initial.story,
          achievements: Array.isArray(p?.achievements) ? p.achievements.filter(id => id in ACHIEVEMENTS) : [],
          craftProgress: p?.craftProgress
            ? reconcileProgress({
                ...p.craftProgress,
                cutResults: Array.isArray(p.craftProgress.cutResults) ? p.craftProgress.cutResults : undefined,
                commission: p.craftProgress.commission
                  ? {
                      ...p.craftProgress.commission,
                      patron: sanitizePatron(p.craftProgress.commission.patron),
                    }
                  : undefined,
              })
            : null,
          shellLedger: sanitizeLedger(p?.shellLedger),
          inventory: { ...START_INVENTORY, ...p?.inventory },
          commissions: (p?.commissions ?? current.commissions)
            .filter((c) => Object.keys(c.motifs).every((m) => listed.has(m as MotifId)))
            .map((c) => {
              const patron = sanitizePatron(c.patron);
              return patron ? { ...c, patron } : { ...c, patron: undefined };
            }),
          gallery: (p?.gallery ?? current.gallery).map((a) => {
            if (!a.patron) return a;
            const patron = sanitizePatron(a.patron);
            return patron ? { ...a, patron } : { ...a, patron: undefined };
          }),
          npcRecent: Array.isArray(p?.npcRecent)
            ? p.npcRecent.filter((id): id is string => typeof id === "string").slice(-24)
            : [],
        };
      },
      partialize: (s) => ({
        achievements: s.achievements,
        story: s.story,
        money: s.money,
        reputation: s.reputation,
        inventory: s.inventory,
        commissions: s.commissions,
        gallery: s.gallery,
        muted: s.muted,
        musicOn: s.musicOn,
        lang: s.lang,
        tutorialSeen: s.tutorialSeen,
        learned: s.learned,
        realCraftInterest: s.realCraftInterest,
        redeemedCoupons: s.redeemedCoupons,
        surveyClaimed: s.surveyClaimed,
        craftProgress: s.craftProgress,
        shellLedger: s.shellLedger,
        npcRecent: s.npcRecent,
      }),
    },
  ),
);

export type Screen = "title" | "board" | "craft" | "result" | "gallery" | "shop";

/** CraftFlow 마운트 시 한 번 읽어 이어하기 (Strict Mode 리마운트에도 유지) */
export type DesignStage = "art" | "shell" | "review";
type CraftBoot = CraftProgress & { designStage?: DesignStage };
let craftBoot: CraftBoot | null = null;

export function takeCraftBoot() {
  return craftBoot;
}

export function setCraftBoot(progress: CraftBoot | null) {
  craftBoot = progress;
}

export function clearCraftBoot() {
  craftBoot = null;
}

interface UIState {
  screen: Screen;
  prev: Screen;
  commission?: Commission;
  /** 디자인 단계에서 작업 중인 초안 (상점에 다녀와도 유지) */
  draft?: Design;
  lastArtwork?: Artwork;
  go: (screen: Screen) => void;
  back: () => void;
  setDraft: (d?: Design) => void;
  startCraft: (commission?: Commission) => void;
  resumeCraft: () => boolean;
  showResult: (art: Artwork) => void;
}

export const useUI = create<UIState>()((set, get) => ({
  screen: "title",
  prev: "title",
  go: (screen) => set({ screen, prev: get().screen }),
  back: () => {
    const { prev, draft } = get();
    set({ screen: prev === "craft" && draft ? "craft" : prev === "craft" ? "title" : prev, prev: "title" });
  },
  setDraft: (draft) => set({ draft }),
  startCraft: (commission) => {
    craftBoot = null;
    set({ screen: "craft", prev: get().screen, commission, draft: undefined });
  },
  resumeCraft: () => {
    const progress = useSave.getState().craftProgress;
    if (!progress || progress.stepIdx < 1) return false;
    craftBoot = progress;
    set({
      screen: "craft",
      prev: get().screen,
      commission: progress.commission,
      draft: progress.design,
    });
    return true;
  },
  showResult: (lastArtwork) => {
    craftBoot = null;
    set({ screen: "result", lastArtwork, draft: undefined });
  },
}));
