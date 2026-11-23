"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

// Keep this query in sync with the desktop workbench in globals.css.
const desktop = "(min-width: 1024px) and (min-height: 560px) and (hover: hover) and (pointer: fine)";
function subscribe(notify: () => void) {
  const query = window.matchMedia(desktop);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}

export default function ToolDrawer({ label, closeLabel, children, onPickClose = false, initiallyOpen = false }: {
  label: string; closeLabel: string; children: ReactNode; onPickClose?: boolean; initiallyOpen?: boolean;
}) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(desktop).matches, () => false);
  return wide ? <>{children}</> : <Drawer label={label} closeLabel={closeLabel} onPickClose={onPickClose} initiallyOpen={initiallyOpen}>{children}</Drawer>;
}

function Drawer({ label, closeLabel, children, onPickClose, initiallyOpen }: {
  label: string; closeLabel: string; children: ReactNode; onPickClose: boolean; initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);
  return <>
    <button type="button" className="tool-tab" aria-haspopup="dialog" aria-expanded={open}
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
