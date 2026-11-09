"use client";

/** 작품 SVG를 PNG로 변환해 공유(지원 시) 또는 다운로드합니다. */
export async function saveArtworkImage(svg: SVGSVGElement, title: string, subtitle: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "720");
  clone.setAttribute("height", "720");
  clone.querySelectorAll("animateTransform").forEach((n) => n.remove());
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  const img = await loadImage(url);
  URL.revokeObjectURL(url);

  const W = 900;
  const H = 1100;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f6efe3");
  bg.addColorStop(1, "#eae3d6");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#5a4030";
  ctx.lineWidth = 10;
  roundRect(ctx, 30, 30, W - 60, H - 60, 48);
  ctx.stroke();
  ctx.drawImage(img, 90, 110, 720, 720);

  const font = getComputedStyle(document.body).fontFamily;
  ctx.fillStyle = "#3f2e24";
  ctx.textAlign = "center";
  ctx.font = `56px ${font}`;
  ctx.fillText(title, W / 2, 920);
  ctx.font = `34px ${font}`;
  ctx.fillStyle = "#8b6f5a";
  ctx.fillText(subtitle, W / 2, 975);
  ctx.font = `30px ${font}`;
  ctx.fillText("Lacquer & Pearl · 나전칠기 장인", W / 2, 1035);

  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
  const file = new File([blob], `lacquer-pearl-${Date.now()}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Lacquer & Pearl", text: `${title} — 내가 만든 나전칠기 ✨` });
      return "shared";
    } catch {
      /* 사용자가 공유를 취소하면 다운로드로 넘어갑니다 */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
