"use client";

import { useLayoutEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// Keep this query in sync with the desktop workbench in globals.css.
const desktop = "(min-width: 1024px) and (min-height: 560px) and (hover: hover) and (pointer: fine)";
function subscribe(notify: () => void) {
  const query = window.matchMedia(desktop);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export function useDesktopBench() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(desktop).matches, () => false);
}

export default function ToolDrawer({ label, closeLabel, children, onPickClose = false, initiallyOpen = false,
  open: controlledOpen, onOpenChange, lesson }: {
  label: string; closeLabel: string; children: ReactNode; onPickClose?: boolean; initiallyOpen?: boolean;
  open?: boolean; onOpenChange?: (open: boolean) => void; lesson?: string;
}) {
  const wide = useDesktopBench();
  const [localOpen, setLocalOpen] = useState(initiallyOpen);
  const open = !wide && (controlledOpen ?? localOpen);
  const setOpen = onOpenChange ?? setLocalOpen;
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);
  if (wide) return <>{children}</>;
  return <>
    <button type="button" className="tool-tab" data-lesson={lesson} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={id} onClick={() => setOpen(true)}>{label}<span aria-hidden="true">⌃</span></button>
    {open && <dialog ref={ref} id={id} className="tool-drawer" aria-label={label}
      onCancel={e => { e.preventDefault(); setOpen(false); }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section>
        <header><h2>{label}</h2><button type="button" onClick={() => setOpen(false)} aria-label={closeLabel}>×</button></header>
        <div className="tool-drawer-body" onClick={e => {
          if (onPickClose && e.target instanceof Element && e.target.closest("button:not(:disabled)")) setOpen(false);
        }}>{children}</div>
      </section>
    </dialog>}
  </>;
}
