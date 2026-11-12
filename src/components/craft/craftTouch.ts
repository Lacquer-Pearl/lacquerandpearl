import { useEffect, useRef, type RefObject } from "react";

type CraftPointer = {
  pointerId: number;
  currentTarget: EventTarget | null;
};

/** 지금 작업 중인 손가락이 아니면 참. 다른 손가락은 현재 동작을 끊지 않는다. */
export function isForeignCraftPointer(event: CraftPointer, active: { current: number | null }) {
  return active.current != null && event.pointerId !== active.current;
}

/** 첫 손가락만 잡고 그 요소에 포인터를 고정한다. 이미 잡힌 손가락이 있으면 무시한다. */
export function claimCraftPointer(event: CraftPointer, active: { current: number | null }, target?: Element | null) {
  if (active.current != null) return false;
  active.current = event.pointerId;
  const el = target ?? (event.currentTarget instanceof Element ? event.currentTarget : null);
  if (el) {
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* 포인터가 이미 사라진 뒤의 호출은 작업을 막지 않는다. */
    }
  }
  return true;
}

/** 같은 손가락이 끝났을 때만 참. 다른 손가락의 up·cancel 은 현재 작업을 끝내지 않는다. */
export function releaseCraftPointer(event: CraftPointer, active: { current: number | null }) {
  if (event.pointerId !== active.current) return false;
  active.current = null;
  return true;
}

/**
 * 작업 영역 안의 터치 이동만 스크롤로 넘기지 않는다.
 * 붓질은 Pointer Events 가 맡고, 이 리스너는 브라우저 제스처만 취소한다.
 */
export function useBlockCraftScroll(ref: RefObject<Element | null>, onUncancelable?: () => void) {
  const notify = useRef(onUncancelable);
  notify.current = onUncancelable;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (event: Event) => {
      if (!event.cancelable) {
        notify.current?.();
        return;
      }
      event.preventDefault();
    };
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, [ref]);
}
