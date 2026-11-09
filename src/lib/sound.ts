"use client";

// Web Audio로 합성하는 효과음/배경음. 외부 음원 파일 없이 동작합니다.

type LoopKind = "brush" | "sand" | "saw" | "iron" | "peel";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
let musicWanted = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
  if (musicWanted) startMusic();
}

/** 앱이 백그라운드로 가면 소리를 멈추고, 돌아오면 다시 재생합니다. */
export function setAudioActive(active: boolean) {
  if (!ctx) return;
  if (active) void ctx.resume();
  else void ctx.suspend();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}

function tone(
  freq: number,
  { type = "sine", dur = 0.15, vol = 0.25, delay = 0, slide = 0, dest }: {
    type?: OscillatorType;
    dur?: number;
    vol?: number;
    delay?: number;
    slide?: number;
    dest?: AudioNode | null;
  } = {},
) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** 가야금처럼 뜯는 소리 */
function pluck(freq: number, delay = 0, vol = 0.22, dest?: AudioNode | null) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const o2 = c.createOscillator();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  o.type = "triangle";
  o2.type = "sine";
  o.frequency.setValueAtTime(freq * 1.012, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
  o2.frequency.setValueAtTime(freq * 2, t);
  f.type = "lowpass";
  f.frequency.setValueAtTime(freq * 6, t);
  f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  const g2 = c.createGain();
  g2.gain.value = 0.25;
  o.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g).connect(dest ?? master);
  o.start(t);
  o2.start(t);
  o.stop(t + 1.5);
  o2.stop(t + 1.5);
}

function noiseBurst(dur: number, freq: number, vol = 0.3, q = 1) {
  const c = ac();
  if (!c || !master || !noiseBuf) return;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}

const PENTA = [293.66, 329.63, 392, 440, 493.88, 587.33, 659.25, 783.99, 880];

export const sfx = {
  click: () => tone(720, { type: "sine", dur: 0.08, vol: 0.18, slide: 300 }),
  pop: () => tone(520, { type: "triangle", dur: 0.12, vol: 0.22, slide: 500 }),
  place: () => {
    tone(880, { type: "sine", dur: 0.12, vol: 0.18 });
    tone(1320, { type: "sine", dur: 0.18, vol: 0.1, delay: 0.04 });
  },
  coin: () => {
    tone(988, { type: "square", dur: 0.08, vol: 0.08 });
    tone(1319, { type: "square", dur: 0.25, vol: 0.08, delay: 0.08 });
  },
  success: () => [0, 2, 4, 5, 7].forEach((n, i) => pluck(PENTA[n], i * 0.09, 0.2)),
  fanfare: () => {
    [0, 2, 4, 7, 8].forEach((n, i) => pluck(PENTA[n], i * 0.11, 0.22));
    tone(1760, { dur: 0.6, vol: 0.06, delay: 0.6 });
  },
  fail: () => {
    tone(330, { type: "triangle", dur: 0.25, vol: 0.2, slide: -120 });
    tone(247, { type: "triangle", dur: 0.35, vol: 0.18, delay: 0.18, slide: -80 });
  },
  crack: () => {
    noiseBurst(0.18, 2500, 0.5, 2);
    tone(180, { type: "square", dur: 0.08, vol: 0.12, slide: -100 });
  },
  tick: () => tone(1500, { type: "sine", dur: 0.03, vol: 0.08 }),
  cut: () => noiseBurst(0.07, 3800, 0.35, 4),
  shimmer: () => [7, 8, 6, 8].forEach((n, i) => tone(PENTA[n] * 2, { dur: 0.3, vol: 0.05, delay: i * 0.07 })),
  bubble: () => tone(300 + Math.random() * 200, { type: "sine", dur: 0.1, vol: 0.12, slide: 400 }),
};

const LOOPS: Record<LoopKind, { type: BiquadFilterType; freq: number; q: number; vol: number; lfo: number }> = {
  brush: { type: "lowpass", freq: 1400, q: 0.7, vol: 0.18, lfo: 0 },
  sand: { type: "bandpass", freq: 3200, q: 0.8, vol: 0.2, lfo: 0 },
  saw: { type: "bandpass", freq: 2200, q: 2.5, vol: 0.3, lfo: 7 },
  iron: { type: "lowpass", freq: 600, q: 0.5, vol: 0.22, lfo: 0 },
  peel: { type: "highpass", freq: 2500, q: 0.6, vol: 0.12, lfo: 18 },
};

let loop: { src: AudioBufferSourceNode; gain: GainNode; lfo?: OscillatorNode; kind: LoopKind; vol: number } | null =
  null;

export function startLoop(kind: LoopKind) {
  const c = ac();
  if (!c || !master || !noiseBuf) return;
  if (loop?.kind === kind) return;
  stopLoop();
  const cfg = LOOPS[kind];
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = cfg.type;
  f.frequency.value = cfg.freq;
  f.Q.value = cfg.q;
  const gain = c.createGain();
  gain.gain.value = 0;
  src.connect(f).connect(gain).connect(master);
  let lfo: OscillatorNode | undefined;
  if (cfg.lfo) {
    lfo = c.createOscillator();
    lfo.frequency.value = cfg.lfo;
    const lg = c.createGain();
    lg.gain.value = 600;
    lfo.connect(lg).connect(f.frequency);
    lfo.start();
  }
  src.start();
  loop = { src, gain, lfo, kind, vol: cfg.vol };
}

/** 0~1 강도. 0이면 무음 */
export function loopLevel(v: number) {
  if (!loop || !ctx) return;
  loop.gain.gain.setTargetAtTime(loop.vol * Math.min(1, v), ctx.currentTime, 0.04);
}

export function stopLoop() {
  if (!loop || !ctx) return;
  const l = loop;
  loop = null;
  l.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  setTimeout(() => {
    l.src.stop();
    l.lfo?.stop();
  }, 150);
}

// 전통 민요 «아리랑» 멜로디 (퍼블릭 도메인). 가야금풍 pluck으로 연주합니다.
const A3 = 220;
const E4 = 329.63;
const G4 = 392;
const A4 = 440;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;

/** [주파수, 박 수] — 0은 쉼표 */
const ARIRANG: [number, number][] = [
  // 아리랑 아리랑 아라리요
  [A4, 1], [A4, 1], [C5, 2], [D5, 1], [E5, 3], [D5, 1], [C5, 1], [A4, 1], [G4, 3],
  // 아리랑 고개로 넘어간다
  [A4, 1], [A4, 1], [C5, 2], [D5, 1], [E5, 1], [D5, 2], [C5, 1], [A4, 1], [G4, 1], [E4, 3],
  // 나를 버리고 가시는 님은
  [G4, 1], [A4, 1], [C5, 1], [D5, 1], [E5, 4], [D5, 1], [C5, 1], [A4, 4],
  // 십리도 못가서 발병난다
  [G4, 1], [A4, 1], [C5, 1], [D5, 3], [E5, 1], [D5, 1], [C5, 1], [A4, 1], [G4, 4],
  // 구 사이 숨
  [0, 2],
];

let beat = 0;
let noteIdx = 0;
let noteLeft = 0;

export function startMusic() {
  musicWanted = true;
  const c = ac();
  if (!c || musicTimer) return;
  beat = 0;
  noteIdx = 0;
  noteLeft = 0;
  // 한 박 ≈ 420ms — 느리게 잔잔한 아리랑
  musicTimer = setInterval(() => {
    if (muted || !ctx || ctx.state !== "running") return;
    beat++;
    if (beat % 8 === 1) pluck(A3, 0, 0.18, musicGain);
    if (beat % 16 === 9) pluck(E4 / 2, 0, 0.12, musicGain);

    if (noteLeft <= 0) {
      const [freq, dur] = ARIRANG[noteIdx];
      noteLeft = dur;
      noteIdx = (noteIdx + 1) % ARIRANG.length;
      if (freq > 0) pluck(freq, 0, 0.22, musicGain);
    }
    noteLeft -= 1;
  }, 420);
}

export function stopMusic() {
  musicWanted = false;
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
