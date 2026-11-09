"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
  const screen = useUI((s) => s.screen);

  useEffect(() => {
    void Promise.resolve(useSave.persist.rehydrate()).then(() => {
      useSave.getState().ensureCommissions();
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
          const backBtn = document.querySelector<HTMLElement>('[aria-label="뒤로"]');
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

  if (!ready)
    return (
      <div className="app-frame flex items-center justify-center">
        <Image src="/logo.png" alt="Lacquer & Pearl" width={1024} height={558} priority className="float w-3/4 max-w-[360px] mix-blend-multiply" />
      </div>
    );

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
