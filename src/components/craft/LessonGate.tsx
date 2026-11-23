"use client";

import { createContext, useContext, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { useSave } from "@/lib/store";

const lines = {
  motifs: ["친구에게 줄 함에 흰 나비를 놓아 보자. ‘문양’을 눌러 서랍을 열어 보렴.", "Let’s put a white butterfly on your friend’s box. Open the Motifs drawer."],
  butterfly: ["여기 날개를 편 나비가 보이니? 이 문양을 골라 보렴.", "See the butterfly with its wings spread? Choose that motif."],
  placeButterfly: ["친구가 뚜껑을 열 때 나비를 어디서 만나면 좋을까? 검은 뚜껑 위, 마음에 드는 자리를 짚어 보렴.", "Where should your friend see the butterfly when they open the lid? Touch the spot you like on the black lid."],
  art: ["나비 자리를 정했구나. 이제 ‘자개패에 올리기’를 눌러, 실제로 잘라 낼 자리를 잡자.", "Your butterfly has its place. Choose the shell layout button to prepare the cut."],
  openSheet: ["이번엔 나비를 오려 낼 자개패가 필요하단다. 표시한 버튼으로 한 장을 펼쳐 보렴.", "We need a sheet to cut the butterfly from. Open a sheet with the highlighted button."],
  buySheet: ["쓸 수 있는 패가 모자라는구나. 표시한 묶음을 사서 한 장 펼쳐 보자.", "We need more shell. Buy the highlighted pack so we can open a sheet."],
  trayMotif: ["패를 펼쳤으니 아래 대기 중인 문양에서 나비를 짚어 보렴.", "The sheet is open. Select the butterfly waiting in the tray."],
  putOnSheet: ["‘올리기’를 눌러 보렴. 나비 윤곽이 패에 나타나면 그 자리를 따라 자를 수 있단다.", "Place the selected butterfly on the sheet. Its outline will show where to cut."],
  confirmSheet: ["나비가 패에 잘 들어갔구나. 배치를 확인하고 도안을 살펴보자.", "The butterfly fits on the sheet. Confirm its placement to review the design."],
  buyMaterial: ["부족한 재료가 있구나. 표시한 재료를 채운 뒤 제작을 시작하렴.", "One of the materials is running low. Buy the highlighted material before you start."],
  replaceWork: ["이 선물 제작을 시작하면 전에 작업하던 작품을 대신하게 된단다. 계속하려면 새 작품 시작을 누르렴.", "Starting this gift will replace your unfinished piece. Choose Start new piece to continue."],
  redip: ["붓끝의 옻이 다했구나. 그릇에 다시 적시고 남은 곳을 칠해 보렴.", "The brush has run dry. Dip it in the bowl again, then cover the remaining surface."],
  review: ["무늬도 재료도 갖췄구나. 함과 쓸 자개를 한 번 살펴보고 제작을 시작하렴.", "The pattern and materials are ready. Look over the box and the shell you’ll use, then begin."],
  cloth: ["나무 한쪽 끝을 짚고 반대편까지 곧게 끌어 보렴. 손을 떼면 삼베 한 장이 붙는다. 옆으로 자리를 옮겨 빈 곳도 덮어 주거라.", "Press one edge of the wood and drag straight across. Lift to lay one strip of hemp, then cover the bare wood beside it."],
  lacquer: ["삼베가 잘 붙었구나. 이제 옻 그릇을 눌러 붓부터 적셔 보렴.", "The hemp is in place. Dip your brush in the lacquer bowl first."],
  brush: ["이제 붓을 작업면에 대고 길게 한 획을 그어 보렴. 옆으로 조금씩 옮겨 고루 칠하고, 붓이 마르면 다시 적시면 된다.", "Draw a long stroke across the surface. Move over a little for each pass, and dip the brush again when it runs dry."],
  dry: ["방금 올린 칠은 따뜻하고 습한 곳에서 굳는단다. 작품을 넣어 두었으니 옻장 문을 닫아 보렴.", "Fresh lacquer cures in warmth and humidity. Your piece is inside the cabinet. Close its doors."],
  humidify: ["먼저 가습을 눌러 보렴. 바늘이 얼마나 올라가는지 눈여겨봐 두거라.", "Press Humidify first. Watch how far the humidity reading rises."],
  vent: ["습도가 올라갔지? 환기를 눌러 알맞은 범위로 되돌려 보렴.", "See the humidity rise? Vent the cabinet to bring it back into range."],
  heat: ["이번엔 온도다. 불을 지펴 온도계를 움직여 보렴.", "Now try the temperature. Stoke the fire and watch the thermometer."],
  cool: ["마지막으로 식히기를 눌러 건조를 시작하자. 두 바늘이 표시된 범위에 머물도록 돌봐 주렴.", "Cool the cabinet to start drying. Keep both readings in their marked ranges."],
  cut: ["칠이 말랐으니 나비를 오려 내자. 굽은 날갯짓을 따라 자르려면 줄음질이 어울린단다. 쓸 도구를 골라 보렴.", "The lacquer has cured. Time to cut the butterfly. A fretsaw will follow the curves of its wings. Choose your tool."],
  jul: ["초록 고리를 짚고 금빛 선을 천천히 따라가렴. 한 구간이 끝나면 손을 떼고 다음 초록 고리에서 다시 시작하는 거다.", "Press the green ring and follow the gold line slowly. After each section, lift and press the next green ring."],
  kkeun: ["버튼을 누르면 자개 띠가 움직인다. 그다음에는 표시가 칼날에 닿을 때마다 눌러 한 토막씩 잘라 보렴.", "Press to start the shell strip moving. Then press each time a mark reaches the blade to cut one length."],
  auto: ["기계에 맡기려면 먼저 가공비를 확인하렴. 맡기고 나면 잘린 조각을 받아 붙일 수 있단다.", "Check the fee before sending the piece to the machine. Your cut shell will be ready to place afterwards."],
  newGlue: ["아교가 말랐구나. 아교를 다시 묻힌 뒤 조각을 집어 보렴.", "The glue has dried. Apply fresh glue before picking up the shell again."],
  join: ["두 조각의 절단면이 아직 맞물리는구나. 이대로 이어 붙여 나비 날개를 살려 보자.", "The two broken edges still fit. Keep the pieces and join the wing on the lid."],
  recut: ["이 조각은 새로 잘라야겠구나. 남은 자개에서 다시 자를 자리를 찾아보자.", "This piece needs another cut. Find room on the remaining shell to try again."],
  restock: ["다시 자를 패가 모자라는구나. 상점에서 필요한 자개를 채우고 돌아오렴.", "There isn’t enough shell to recut. Visit the shop for a fresh sheet."],
  julNext: ["방금 자른 선은 끝났단다. 손을 뗀 뒤 새로 빛나는 초록 고리에서 다음 구간을 시작하렴.", "That section is finished. Lift your hand and press the new green ring to start the next one."],
  attach: ["잘라 낸 자개를 집어서 함 위 점선에 포개 보렴. 아교가 마르면 다시 묻히면 된단다.", "Pick up the cut shell and lay it inside the dashed outline. Apply fresh glue if it dries."],
  iron: ["무늬가 제자리를 찾았구나. 종이 아래 자개가 비치는 곳을 인두로 눌러라. 잘 붙으면 손을 떼고 옆자리로 옮기렴.", "The motif is in place. Hold the iron over the shell beneath the paper. Lift when it bonds and move to the next spot."],
  peel: ["이제 종이를 벗겨 보자. 물을 먹이면 부드러워져 자개가 들뜨는 걸 줄일 수 있단다.", "Now lift the paper away. Wetting it first softens the paper and helps the shell stay in place."],
  wet: ["종이가 부드러워졌지? 위쪽 가장자리를 잡고 아래로 천천히 내려 보렴.", "The paper is softer now. Take its top edge and draw it slowly down."],
  fill: ["종이를 걷었으니 조각 사이를 메울 차례다. 붓을 옻에 적시고 빈틈 위로 얇게 펴 바르렴.", "With the paper gone, we can fill the gaps. Dip your brush and spread a thin coat over the inlay."],
  sand: ["칠 아래에 나비가 숨어 있단다. 숫돌로 살살 문질러 빛이 돌아오는 걸 보렴. 빛이 난 곳은 두고 옆으로 옮겨 가거라.", "Your butterfly is beneath the lacquer. Rub gently until the shell catches the light, then move to the next patch."],
  finish: ["손을 멈추고 빛에 비춰 보렴. 처음 작업대에 놓았던 그 나비로구나. 이제 네 손으로 친구에게 건네거라.", "Put down the stone and turn the lid to the light. There’s the butterfly you placed at the start. It’s yours to give to your friend."],
} as const;

export const GiftLessons = createContext(false);

export type Lesson = keyof typeof lines;

export const LessonPaused = createContext(false);

// Controls keep their original handlers. Only a completed click dismisses a button cue;
// a canvas gesture must continue to receive the same pointer after its first press.
const targets: Record<Lesson, string> = {
  motifs: "[data-lesson=motifs]", butterfly: "[data-lesson=butterfly]", placeButterfly: "[data-lesson=placeButterfly]",
  art: "[data-lesson=art]", openSheet: "[data-lesson=openSheet]", buySheet: "[data-lesson=buySheet]",
  trayMotif: "[data-lesson=trayMotif]", putOnSheet: "[data-lesson=putOnSheet]", confirmSheet: "[data-lesson=confirmSheet]",
  review: "[data-lesson=review]", replaceWork: "[data-lesson=replaceWork]", buyMaterial: "[data-lesson=buyMaterial]",
  redip: ".lacquer-bowl",
  cloth: ".bench-surface svg.craft-touch-area", lacquer: ".lacquer-bowl", brush: "[data-paint-canvas]",
  dry: "[data-lesson=dry]", humidify: "[data-lesson=humidify]", vent: "[data-lesson=vent]",
  heat: "[data-lesson=heat]", cool: "[data-lesson=cool]", cut: "[data-lesson=cut]", jul: ".saw-board", julNext: ".saw-board",
  join: "[data-lesson=join]", recut: "[data-lesson=recut]", restock: "[data-lesson=restock]", newGlue: "[data-lesson=newGlue]",
  kkeun: "[data-lesson=kkeun]", auto: "[data-lesson=auto]", attach: "[data-lesson=attach]", iron: "[data-paint-canvas]",
  peel: "[data-lesson=peel]", wet: ".bench-surface .craft-touch-area", fill: ".lacquer-bowl", sand: "[data-paint-canvas]",
  finish: "[data-lesson=finish]",
};

export default function LessonGate({ lesson, untilComplete = false, children }: { lesson?: Lesson; untilComplete?: boolean; children: ReactNode }) {
  const [read, setRead] = useState<readonly Lesson[]>([]);
  const enabled = useContext(GiftLessons);
  const parentPaused = useContext(LessonPaused);
  const active = enabled && !parentPaused && lesson && (untilComplete || !read.includes(lesson)) ? lesson : undefined;
  const dismiss = useCallback(() => {
    if (lesson) setRead(previous => previous.includes(lesson) ? previous : [...previous, lesson]);
  }, [lesson]);
  return <LessonPaused.Provider value={parentPaused || !!active}>
    {children}
    {active && <WorkHint key={active} lesson={active} untilComplete={untilComplete} dismiss={dismiss} />}
  </LessonPaused.Provider>;
}

type HintProps = { lesson: Lesson; untilComplete: boolean; dismiss: () => void };

function WorkHint({ lesson, untilComplete, dismiss }: HintProps) {
  const [target, setTarget] = useState<Element | null>(null);
  useLayoutEffect(() => {
    const find = () => {
      const candidate = Array.from(document.querySelectorAll(targets[lesson]))
        .find(el => !el.matches(":disabled") && el.getClientRects().length);
      setTarget(candidate ?? null);
      if (!candidate && !untilComplete) dismiss();
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "open", "data-lesson"] });
    return () => observer.disconnect();
  }, [lesson, untilComplete, dismiss]);
  if (!target) return null;
  // A native modal sits above body portals. Keep the spotlight in the same top layer as its button.
  return createPortal(<PositionedHint target={target} lesson={lesson} untilComplete={untilComplete} dismiss={dismiss} />,
    target.closest("dialog") ?? document.body);
}

function PositionedHint({ target, lesson, untilComplete, dismiss }: HintProps & { target: Element }) {
  const lang = useSave(s => s.lang);
  const [folded, setFolded] = useState(false);
  const ring = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const box = ring.current!;
    const card = note.current!;
    const spotlightBounds = () => {
      if (lesson === "placeButterfly") return target.querySelector("[data-lid-area]")?.getBoundingClientRect() ?? target.getBoundingClientRect();
      if (lesson !== "jul" && lesson !== "julNext") return target.getBoundingClientRect();
      const rects = [...target.querySelectorAll("circle.pulse, .touch-grip")]
        .map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
      if (!rects.length) return target.getBoundingClientRect();
      const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
      return new DOMRect(left, top, Math.max(...rects.map(r => r.right))-left, Math.max(...rects.map(r => r.bottom))-top);
    };
    const position = () => {
      if (!target.isConnected || target.matches(":disabled")) return;
      const r = spotlightBounds();
      const pad = 4;
      Object.assign(box.style, { left: r.left-pad+"px", top: r.top-pad+"px", width: r.width+2*pad+"px", height: r.height+2*pad+"px" });
      const gap = 12;
      const w = window.innerWidth, h = window.innerHeight;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const clamp = (v: number, max: number) => Math.max(gap, Math.min(v, max-gap));
      let x = clamp(r.left + (r.width-cw)/2, w-cw);
      let y = r.top > h-r.bottom ? r.top-ch-gap : r.bottom+gap;
      if (r.left >= cw+2*gap || w-r.right >= cw+2*gap) {
        x = r.left >= cw+2*gap ? r.left-cw-gap : r.right+gap;
        y = r.top+(r.height-ch)/2;
      }
      Object.assign(card.style, { left: x+"px", top: clamp(y,h-ch)+"px" });
    };
    const r = target.getBoundingClientRect();
    const topBar = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
    if (r.top < Math.max(0, topBar) + 8 || r.bottom > innerHeight-8 ||
        !target.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))) {
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    }
    position();
    // Viewport rectangles change throughout the drawer and workbench entrance animations.
    const moving: Animation[] = [];
    for (let el: Element | null = target; el; el = el.parentElement) {
      moving.push(...el.getAnimations().filter(a => a.effect?.getComputedTiming().endTime !== Infinity));
    }
    let frame = 0;
    const follow = () => {
      position();
      if (moving.some(a => a.playState === "running" || a.pending)) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    const event = target.matches("button, a") ? "click" : "pointerdown";
    const previousDescription = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", [previousDescription, "master-hint-line"].filter(Boolean).join(" "));
    if (!untilComplete) target.addEventListener(event, dismiss);

    const guard = (e: Event) => {
      const el = e.target;
      if (!(el instanceof Element) || target.contains(el) || el.closest(".work-hint, .modal-backdrop, .tool-drawer header")) return;
      if (lesson === "art" && el.closest(".sketch-paper")) return;
      if ((lesson === "join" || lesson === "recut" || lesson === "restock") && el.closest("[data-recut-panel] button")) return;
      if (!el.closest(".craft-screen .screen-body, .tool-drawer")) return;
      e.stopImmediatePropagation();
      if (e.type === "click") e.preventDefault();
    };
    window.addEventListener("pointerdown", guard, true);
    window.addEventListener("click", guard, true);
    const observe = new ResizeObserver(position);
    observe.observe(target);
    observe.observe(card);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    document.addEventListener("animationend", position);

    return () => {
      target.removeEventListener(event, dismiss);
      if (previousDescription) target.setAttribute("aria-describedby", previousDescription);
      else target.removeAttribute("aria-describedby");
      observe.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      document.removeEventListener("animationend", position);
      window.removeEventListener("pointerdown", guard, true);
      window.removeEventListener("click", guard, true);
    };
  }, [lesson, target, untilComplete, dismiss]);
  return <div className="work-hint" data-guide={lesson}>
    <div className="work-hint-ring" ref={ring} />
    <aside ref={note} className={`work-hint-note${folded ? " folded" : ""}`} aria-live="polite">
      <img src="/npc/story/master.webp" alt="" />
      <div><strong>{t(lang, "master.name")}</strong>
        <p id="master-hint-line">{lines[lesson][lang === "ko" ? 0 : 1]}</p>
      </div>
      <button type="button" data-close-guide aria-label={folded ? (lang === "ko" ? "안내 펼치기" : "Show hint") : (lang === "ko" ? "안내 접기" : "Fold hint")} aria-expanded={!folded} onClick={() => setFolded(!folded)}>{folded ? "?" : "×"}</button>
    </aside>
  </div>;
}
