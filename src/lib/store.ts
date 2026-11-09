"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CRAFT_COST, MATERIALS, PEARLS, type MaterialId } from "./data";
import { generateCommission, type Artwork, type Commission, type Design } from "./game";

export type Inventory = Record<MaterialId, number>;

const START_INVENTORY: Inventory = {
  wood: 2,
  hemp: 2,
  lacquer: 6,
  glue: 2,
  pearlWhite: 12,
  pearlAbalone: 3,
  pearlBlack: 2,
  pearlPaua: 2,
};

interface SaveState {
  money: number;
  reputation: number;
  inventory: Inventory;
  commissions: Commission[];
  gallery: Artwork[];
  muted: boolean;
  musicOn: boolean;
  tutorialSeen: boolean;
  realCraftInterest: string[];

  buy: (id: MaterialId) => boolean;
  missingFor: (design: Pick<Design, "pearl" | "pieces">) => MaterialId[];
  consumeFor: (design: Pick<Design, "pearl" | "pieces">) => boolean;
  ensureCommissions: () => void;
  finishArtwork: (art: Artwork, repGain: number) => void;
  sellArtwork: (id: string) => void;
  setMuted: (m: boolean) => void;
  setMusic: (m: boolean) => void;
  setTutorialSeen: () => void;
  toggleInterest: (id: string) => void;
  resetSave: () => void;
}

function costFor(design: Pick<Design, "pearl" | "pieces">) {
  const cost: Partial<Record<MaterialId, number>> = { ...CRAFT_COST };
  const pm = PEARLS[design.pearl].material;
  cost[pm] = (cost[pm] ?? 0) + design.pieces.length;
  return cost;
}

const initial = {
  money: 150,
  reputation: 0,
  inventory: START_INVENTORY,
  commissions: [] as Commission[],
  gallery: [] as Artwork[],
  muted: false,
  musicOn: true,
  tutorialSeen: false,
  realCraftInterest: [] as string[],
};

export const useSave = create<SaveState>()(
  persist(
    (set, get) => ({
      ...initial,

      buy: (id) => {
        const m = MATERIALS[id];
        const { money, inventory } = get();
        if (money < m.price) return false;
        set({ money: money - m.price, inventory: { ...inventory, [id]: inventory[id] + m.pack } });
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

      ensureCommissions: () => {
        const { commissions, reputation } = get();
        if (commissions.length >= 3) return;
        const next = [...commissions];
        while (next.length < 3) next.push(generateCommission(reputation));
        set({ commissions: next });
      },

      finishArtwork: (art, repGain) => {
        const s = get();
        set({
          gallery: [art, ...s.gallery].slice(0, 60),
          money: s.money + art.earned,
          reputation: s.reputation + repGain,
          commissions: art.commissionId
            ? s.commissions.filter((c) => c.id !== art.commissionId)
            : s.commissions,
        });
        get().ensureCommissions();
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
      setTutorialSeen: () => set({ tutorialSeen: true }),
      toggleInterest: (id) => {
        const list = get().realCraftInterest;
        set({ realCraftInterest: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
      },
      resetSave: () => {
        set({ ...initial, commissions: [] });
        get().ensureCommissions();
      },
    }),
    {
      name: "lacquer-pearl-save",
      version: 1,
      skipHydration: true,
      merge: (persisted, current) => {
        const p = persisted as Partial<SaveState> | undefined;
        return { ...current, ...p, inventory: { ...START_INVENTORY, ...p?.inventory } };
      },
      partialize: (s) => ({
        money: s.money,
        reputation: s.reputation,
        inventory: s.inventory,
        commissions: s.commissions,
        gallery: s.gallery,
        muted: s.muted,
        musicOn: s.musicOn,
        tutorialSeen: s.tutorialSeen,
        realCraftInterest: s.realCraftInterest,
      }),
    },
  ),
);

export type Screen = "title" | "board" | "craft" | "result" | "gallery" | "shop";

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
  startCraft: (commission) => set({ screen: "craft", prev: get().screen, commission, draft: undefined }),
  showResult: (lastArtwork) => set({ screen: "result", lastArtwork, draft: undefined }),
}));
