"use client";

import { createContext, useContext, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { useSave } from "@/lib/store";

const lines = {
  art: ["흰 나비를 흑칠함 위에 올려 두었다. 네 친구가 뚜껑을 열 때 어느 쪽에서 나비를 만나면 좋을까? 나비를 끌어 자리를 정한 뒤, 밝게 표시한 버튼으로 자개패에 올려 보렴.", "I’ve set a white butterfly on the box. Where should it meet your friend’s eye when the lid opens? Drag it into place, then use the highlighted button to lay it on the shell sheet."],
  shell: ["좋아. 이제 진짜 자개에서 잘라 낼 자리를 고르자. 문양을 패 위로 끌거나 ‘남은 문양 자동으로 올리기’를 눌러 보렴.", "Now find a place to cut it from real shell. Drag the motif onto a sheet, or choose “Auto-place the rest.”"],
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
  art: ".design-action-bar button", shell: ".design-action-bar button, [data-lesson=shell]", review: ".design-action-bar button",
  cloth: ".bench-surface svg.craft-touch-area", lacquer: ".lacquer-bowl", brush: "[data-paint-canvas]",
  dry: "[data-lesson=dry]", humidify: "[data-lesson=humidify]", vent: "[data-lesson=vent]",
  heat: "[data-lesson=heat]", cool: "[data-lesson=cool]", cut: "[data-lesson=cut]", jul: ".saw-board",
  kkeun: "[data-lesson=kkeun]", auto: "[data-lesson=auto]", attach: "[data-lesson=attach]", iron: "[data-paint-canvas]",
  peel: "[data-lesson=peel]", wet: ".bench-surface .craft-touch-area", fill: ".lacquer-bowl", sand: "[data-paint-canvas]",
  finish: "[data-lesson=finish]",
};

export default function LessonGate({ lesson, children }: { lesson?: Lesson; children: ReactNode }) {
  const [read, setRead] = useState<readonly Lesson[]>([]);
  const enabled = useContext(GiftLessons);
  const parentPaused = useContext(LessonPaused);
  const active = enabled && !parentPaused && lesson && !read.includes(lesson) ? lesson : undefined;
  const dismiss = useCallback(() => {
    if (lesson) setRead(previous => previous.includes(lesson) ? previous : [...previous, lesson]);
  }, [lesson]);
  return <LessonPaused.Provider value={parentPaused || !!active}>
    {children}
    {active && <WorkHint key={active} lesson={active} dismiss={dismiss} />}
  </LessonPaused.Provider>;
}

function WorkHint({ lesson, dismiss }: { lesson: Lesson; dismiss: () => void }) {
  const lang = useSave(s => s.lang);
  const ring = useRef<HTMLDivElement>(null);
  const note = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(targets[lesson]);
    if (!target || target.matches(":disabled") || !target.getClientRects().length) {
      dismiss();
      return;
    }
    const box = ring.current!;
    const card = note.current!;
    const spotlightBounds = () => {
      if (lesson !== "jul") return target.getBoundingClientRect();
      const rects = [...target.querySelectorAll("circle.pulse, .touch-grip")]
        .map(el => el.getBoundingClientRect()).filter(r => r.width && r.height);
      if (!rects.length) return target.getBoundingClientRect();
      const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
      return new DOMRect(left, top, Math.max(...rects.map(r => r.right))-left, Math.max(...rects.map(r => r.bottom))-top);
    };
    const position = () => {
      if (!target.isConnected || target.matches(":disabled")) { dismiss(); return; }
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
    const event = target.matches("button, a") ? "click" : "pointerdown";
    const previousDescription = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", [previousDescription, "master-hint-line"].filter(Boolean).join(" "));
    const sawState = lesson === "jul" ? new MutationObserver(() => {
      if (target.dataset.phase === "saw") dismiss();
    }) : null;
    if (sawState) sawState.observe(target, { attributes: true, attributeFilter: ["data-phase"] });
    else target.addEventListener(event, dismiss);
    const observe = new ResizeObserver(position);
    observe.observe(target);
    observe.observe(card);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    document.addEventListener("animationend", position);
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    document.addEventListener("keydown", escape);
    return () => {
      target.removeEventListener(event, dismiss);
      if (previousDescription) target.setAttribute("aria-describedby", previousDescription);
      else target.removeAttribute("aria-describedby");
      observe.disconnect();
      sawState?.disconnect();
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      document.removeEventListener("animationend", position);
      document.removeEventListener("keydown", escape);
    };
  }, [lesson, dismiss]);
  return createPortal(<div className="work-hint" data-guide={lesson}>
    <div className="work-hint-ring" ref={ring} />
    <aside ref={note} className="work-hint-note" aria-live="polite">
      <img src="/npc/story/master.webp" alt="" />
      <div><strong>{t(lang, "master.name")}</strong>
        <p id="master-hint-line">{lines[lesson][lang === "ko" ? 0 : 1]}</p>
      </div>
      <button type="button" data-close-guide aria-label={lang === "ko" ? "안내 접기" : "Dismiss hint"} onClick={dismiss}>×</button>
    </aside>
  </div>, document.body);
}
