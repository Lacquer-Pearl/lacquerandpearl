// 로고(public/logo.png)에서 엠블럼을 잘라 웹 아이콘과 안드로이드 런처 아이콘/스플래시를 생성합니다.
// 사용법: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const logo = path.join(root, "public/logo.png");
const res = path.join(root, "android/app/src/main/res");

const SCENE = { left: 406, top: 62, width: 224, height: 224 };
const CREAM = "#fdf6ec";
const BROWN = "#8a5a3c";

async function emblem(size, { padding = 0, round = true, bg = CREAM } = {}) {
  const inner = Math.round(size - padding * 2);
  const ring = Math.max(2, Math.round(inner * 0.045));
  const scene = await sharp(logo)
    .extract(SCENE)
    .resize(inner - ring * 2, inner - ring * 2)
    .png()
    .toBuffer();
  const r = (inner - ring * 2) / 2;
  const mask = Buffer.from(
    round
      ? `<svg width="${r * 2}" height="${r * 2}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
      : `<svg width="${r * 2}" height="${r * 2}"><rect width="100%" height="100%" rx="${r * 0.35}" fill="#fff"/></svg>`,
  );
  const masked = await sharp(scene).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  const frame = Buffer.from(
    round
      ? `<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2 - ring / 2}" fill="${CREAM}" stroke="${BROWN}" stroke-width="${ring}"/></svg>`
      : `<svg width="${inner}" height="${inner}"><rect x="${ring / 2}" y="${ring / 2}" width="${inner - ring}" height="${inner - ring}" rx="${inner * 0.2}" fill="${CREAM}" stroke="${BROWN}" stroke-width="${ring}"/></svg>`,
  );
  const body = await sharp(frame)
    .composite([{ input: masked, left: ring, top: ring }])
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: body, left: Math.round(padding), top: Math.round(padding) }])
    .png();
}

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

await (await emblem(512, { bg: transparent })).toFile(path.join(root, "src/app/icon.png"));
await (await emblem(180, { padding: 10 })).toFile(path.join(root, "src/app/apple-icon.png"));
await (await emblem(512, { padding: 40 })).toFile(path.join(root, "public/icon-512.png"));
await (await emblem(192, { padding: 14 })).toFile(path.join(root, "public/icon-192.png"));

for (const [name, d] of Object.entries(densities)) {
  const dir = path.join(res, `mipmap-${name}`);
  mkdirSync(dir, { recursive: true });
  const legacy = Math.round(48 * d);
  const fg = Math.round(108 * d);
  await (await emblem(legacy, { bg: transparent })).toFile(path.join(dir, "ic_launcher_round.png"));
  await (await emblem(legacy, { bg: transparent })).toFile(path.join(dir, "ic_launcher.png"));
  // 적응형 아이콘: 108dp 중 가운데 72dp 영역만 안전하게 보이므로 여백을 둡니다.
  await (await emblem(fg, { padding: fg * 0.2, bg: transparent })).toFile(
    path.join(dir, "ic_launcher_foreground.png"),
  );
}

// 스플래시: 크림색 배경 중앙에 전체 로고
const splashSizes = {
  "drawable": [480, 800],
  "drawable-port-mdpi": [320, 480],
  "drawable-port-hdpi": [480, 800],
  "drawable-port-xhdpi": [720, 1280],
  "drawable-port-xxhdpi": [960, 1600],
  "drawable-port-xxxhdpi": [1280, 1920],
  "drawable-land-mdpi": [480, 320],
  "drawable-land-hdpi": [800, 480],
  "drawable-land-xhdpi": [1280, 720],
  "drawable-land-xxhdpi": [1600, 960],
  "drawable-land-xxxhdpi": [1920, 1280],
};
for (const [dir, [w, h]] of Object.entries(splashSizes)) {
  const logoW = Math.round(Math.min(w * 0.85, h * 0.85 * (1024 / 558)));
  const logoBuf = await sharp(logo).resize(logoW).png().toBuffer();
  const meta = await sharp(logoBuf).metadata();
  mkdirSync(path.join(res, dir), { recursive: true });
  await sharp({ create: { width: w, height: h, channels: 4, background: CREAM } })
    .composite([
      {
        input: logoBuf,
        left: Math.round((w - logoW) / 2),
        top: Math.round((h - meta.height) / 2),
      },
    ])
    .png()
    .toFile(path.join(res, dir, "splash.png"));
}

console.log("icons generated");
