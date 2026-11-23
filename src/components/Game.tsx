"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentType } from "react";
import Image from "next/image";
import WorkshopScene from "@/components/WorkshopScene";
import TitleScreen from "@/components/screens/TitleScreen";
import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { setAudioActive, unlockAudio } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

const BoardScreen = dynamic(() => import("@/components/screens/BoardScreen"), { ssr: false });
const CraftFlow = dynamic(() => import("@/components/craft/CraftFlow"), { ssr: false });
const ResultScreen = dynamic(() => import("@/components/screens/ResultScreen"), { ssr: false });
const GalleryScreen = dynamic(() => import("@/components/screens/GalleryScreen"), { ssr: false });
const ShopScreen = dynamic(() => import("@/components/screens/ShopScreen"), { ssr: false });

const PaintLab =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/components/craft/PaintCanvas").then((m) => m.PaintLab), { ssr: false })
    : null;
const RecutLab =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/components/craft/RecutPanel").then((m) => m.RecutLab), { ssr: false })
    : null;
const NestLab =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/components/craft/NestStep").then((m) => m.NestLab), { ssr: false })
    : null;
const BreakLab =
  process.env.NODE_ENV === "development"
    ? (dynamic(() => import("@/components/craft/BreakLab"), { ssr: false }) as ComponentType)
    : null;
const CutGuideGallery =
  process.env.NODE_ENV === "development"
    ? (dynamic(() => import("@/components/craft/CutGuideGallery"), { ssr: false }) as ComponentType)
    : null;

export default function Game() {
  const [ready, setReady] = useState(false);
  const [cutDebug, setCutDebug] = useState(false);
  const [breakDebug, setBreakDebug] = useState(false);
  const [nestDebug, setNestDebug] = useState(false);
  const [recutDebug, setRecutDebug] = useState(false);
  const [paintDebug, setPaintDebug] = useState(false);
  const screen = useUI((s) => s.screen);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("cutdebug") === "1") setCutDebug(true);
    if (query.get("breakdebug") === "1") setBreakDebug(true);
    if (query.get("nestdebug") === "1") setNestDebug(true);
    if (query.get("recutdebug") === "1") setRecutDebug(true);
    if (query.get("paintdebug") === "1") setPaintDebug(true);
  }, []);

  useEffect(() => {
    const lab = new URLSearchParams(window.location.search);
    const debugLab =
      process.env.NODE_ENV === "development" &&
      ["cutdebug", "breakdebug", "nestdebug", "recutdebug", "paintdebug"].some((key) => lab.get(key) === "1");
    void Promise.resolve(useSave.persist.rehydrate()).then(() => {
      if (!debugLab) useSave.getState().ensureCommissions();
      setReady(true);
    });
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    const onVisibility = () => setAudioActive(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);

    const handles: Promise<PluginListenerHandle>[] = [];
    if (Capacitor.isNativePlatform()) {
      handles.push(
        App.addListener("backButton", () => {
          const drawer = document.querySelector<HTMLButtonElement>("dialog.tool-drawer[open] header button");
          if (drawer) return drawer.click();
          const lesson = document.querySelector<HTMLButtonElement>("[data-close-guide]");
          if (lesson) return lesson.click();
          const backdrop = document.querySelector<HTMLElement>(".modal-backdrop");
          if (backdrop) return backdrop.click();
          const backBtn = document.querySelector<HTMLElement>("[data-nav-back]");
          if (backBtn) return backBtn.click();
          if (useUI.getState().screen === "title") void App.exitApp();
          else useUI.getState().go("title");
        }),
        App.addListener("appStateChange", ({ isActive }) => setAudioActive(isActive)),
      );
    }
    return () => {
      window.removeEventListener("pointerdown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
      handles.forEach((h) => void h.then((x) => x.remove()));
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  const lang = useSave((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "ko";
  }, [lang]);

  // 자주 쓰는 화면 청크를 유휴 시간에 미리 받아 전환을 빠르게 한다
  useEffect(() => {
    if (!ready) return;
    const warm = () => {
      void import("@/components/screens/BoardScreen");
      void import("@/components/craft/CraftFlow");
      void import("@/components/screens/ShopScreen");
    };
    const w = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(warm, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(warm, 900);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (!ready)
    return (
      <div className="app-frame flex items-center justify-center">
        <div className="float logo-plaque w-3/4 max-w-[360px]">
          <Image src="/logo.webp" alt="Lacquer & Pearl" width={720} height={393} priority className="h-auto w-full" />
        </div>
      </div>
    );

  if (process.env.NODE_ENV === "development" && paintDebug && PaintLab) {
    return (
      <div className="app-frame">
        <PaintLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && recutDebug && RecutLab) {
    return (
      <div className="app-frame">
        <RecutLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && nestDebug && NestLab) {
    return (
      <div className="app-frame">
        <NestLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && breakDebug && BreakLab) {
    return (
      <div className="app-frame">
        <BreakLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && cutDebug && CutGuideGallery) {
    return (
      <div className="app-frame">
        <CutGuideGallery />
      </div>
    );
  }

  return (
    <div className="game-room" data-screen={screen}>
      <WorkshopScene screen={screen} />
      <div className="app-frame">
        {screen === "title" && <TitleScreen />}
        {screen === "board" && <BoardScreen />}
        {screen === "craft" && <CraftFlow />}
        {screen === "result" && <ResultScreen />}
        {screen === "gallery" && <GalleryScreen />}
        {screen === "shop" && <ShopScreen />}
      </div>
    </div>
  );
}
