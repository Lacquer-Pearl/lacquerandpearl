"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import BreakLab from "@/components/craft/BreakLab";
import { NestLab } from "@/components/craft/NestStep";
import { RecutLab } from "@/components/craft/RecutPanel";
import { PaintLab } from "@/components/craft/PaintCanvas";
import CutGuideGallery from "@/components/craft/CutGuideGallery";
import CraftFlow from "@/components/craft/CraftFlow";
import BoardScreen from "@/components/screens/BoardScreen";
import GalleryScreen from "@/components/screens/GalleryScreen";
import ResultScreen from "@/components/screens/ResultScreen";
import ShopScreen from "@/components/screens/ShopScreen";
import TitleScreen from "@/components/screens/TitleScreen";
import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { setAudioActive, unlockAudio } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

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

  if (!ready)
    return (
      <div className="app-frame flex items-center justify-center">
        <div className="float logo-plaque w-3/4 max-w-[360px]">
          <Image src="/logo.png" alt="Lacquer & Pearl" width={1024} height={558} priority className="h-auto w-full" />
        </div>
      </div>
    );

  if (process.env.NODE_ENV === "development" && paintDebug) {
    return (
      <div className="app-frame">
        <PaintLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && recutDebug) {
    return (
      <div className="app-frame">
        <RecutLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && nestDebug) {
    return (
      <div className="app-frame">
        <NestLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && breakDebug) {
    return (
      <div className="app-frame">
        <BreakLab />
      </div>
    );
  }

  if (process.env.NODE_ENV === "development" && cutDebug) {
    return (
      <div className="app-frame">
        <CutGuideGallery />
      </div>
    );
  }

  return (
    <div className="app-frame">
      {screen === "title" && <TitleScreen />}
      {screen === "board" && <BoardScreen />}
      {screen === "craft" && <CraftFlow />}
      {screen === "result" && <ResultScreen />}
      {screen === "gallery" && <GalleryScreen />}
      {screen === "shop" && <ShopScreen />}
    </div>
  );
}
