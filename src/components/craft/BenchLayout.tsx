import type { ReactNode } from "react";
import { useSave } from "@/lib/store";

export default function BenchLayout({ tools, children, progress, next }: {
  tools: ReactNode;
  children: ReactNode;
  progress?: ReactNode;
  next?: ReactNode;
}) {
  const ko = useSave(s => s.lang === "ko");
  return (
    <div className="bench-layout">
      <aside className="bench-tools" aria-label={ko ? "작업 도구" : "Tools"}>{tools}</aside>
      <div className="bench-surface">{children}</div>
      <aside className="bench-status" aria-label={ko ? "진행과 다음 동작" : "Progress and next action"}>
        <div className="bench-readings">{progress}</div>
        {next && <div className="bench-next">{next}</div>}
      </aside>
    </div>
  );
}
