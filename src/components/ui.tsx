"use client";

import { useEffect } from "react";
import { setMuted as setAudioMuted, sfx, startMusic, stopMusic } from "@/lib/sound";
import UiIcon from "@/components/UiIcon";
import { rankTitle, t } from "@/lib/i18n";
import { useSave } from "@/lib/store";

type Variant = "pink" | "mint" | "cream" | "gold" | "lavender" | "brown";

export function Btn({
  children,
  variant = "pink",
  className = "",
  sound = true,
  onClick,
  disabled,
  size = "md",
  type = "button",
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  sound?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`btn btn-${variant} btn-${size} ${className}`}
      onClick={() => {
        if (sound) sfx.click();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function Coin({ className = "" }: { className?: string }) {
  return <UiIcon id="coin" className={`ui-icon-sm align-[-0.2em] ${className}`} alt="" />;
}

export function SoundToggle() {
  const muted = useSave((s) => s.muted);
  const setMuted = useSave((s) => s.setMuted);
  const musicOn = useSave((s) => s.musicOn);
  const setMusic = useSave((s) => s.setMusic);
  const lang = useSave((s) => s.lang);

  useEffect(() => {
    setAudioMuted(muted);
  }, [muted]);
  useEffect(() => {
    if (musicOn) startMusic();
    else stopMusic();
  }, [musicOn]);

  return (
    <div className="flex gap-1.5">
      <button
        className="icon-btn"
        aria-label={t(lang, "common.music")}
        onClick={() => {
          setMusic(!musicOn);
          sfx.click();
        }}
      >
        <UiIcon id={musicOn ? "sfx" : "musicOff"} className="ui-icon-md" />
        {!musicOn && <span className="icon-slash" />}
      </button>
      <button
        className="icon-btn"
        aria-label={t(lang, "common.sfx")}
        onClick={() => {
          setMuted(!muted);
          sfx.click();
        }}
      >
        <UiIcon id="sfx" className="ui-icon-md" />
        {muted && <span className="icon-slash" />}
      </button>
    </div>
  );
}

export function TopBar({ onBack, title }: { onBack?: () => void; title?: string }) {
  const money = useSave((s) => s.money);
  const rep = useSave((s) => s.reputation);
  const lang = useSave((s) => s.lang);
  return (
    <div className="topbar">
      <div className="flex min-w-0 items-center gap-2">
        {onBack && (
          <button
            className="icon-btn"
            aria-label={t(lang, "common.back")}
            data-nav-back
            onClick={() => {
              sfx.click();
              onBack();
            }}
          >
            ◀
          </button>
        )}
        {title ? (
          <span className="topbar-title truncate text-lg">{title}</span>
        ) : (
          <span className="chip">
            <UiIcon id="medal" className="ui-icon-sm" /> {rankTitle(lang, rep)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="chip">
          <Coin /> {money.toLocaleString()}
        </span>
        <span className="chip">
          <UiIcon id="star" className="ui-icon-sm" /> {rep}
        </span>
        <SoundToggle />
      </div>
    </div>
  );
}

export function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pop-in" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Meter({
  value,
  color = "var(--pink)",
  zone,
  label,
}: {
  value: number;
  color?: string;
  zone?: [number, number];
  label?: React.ReactNode;
}) {
  return (
    <div className="w-full">
      {label && <div className="mb-1 flex justify-between text-sm text-[var(--brown)]">{label}</div>}
      <div className="meter">
        {zone && (
          <div
            className="meter-zone"
            style={{ left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%` }}
          />
        )}
        <div
          className="meter-fill"
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function Sparkles({ count = 10 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="sparkle"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 100}%`,
            animationDelay: `${(i * 0.37) % 3}s`,
            fontSize: `${10 + ((i * 7) % 12)}px`,
          }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}
