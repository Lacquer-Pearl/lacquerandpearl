import { motifOutline } from "@/lib/data";
import type { PlacedPiece } from "@/lib/game";

function pieceMatrix(piece: PlacedPiece) {
  return new DOMMatrix()
    .translate(piece.x, piece.y)
    .rotate(piece.r)
    .scale(piece.flipX ? -piece.s : piece.s, piece.s);
}

/** 붙인 자개 조각들의 윤곽을 작품 좌표(0~300)로 모은 경로. 서버 렌더에서는 null. */
export function piecesRegion(pieces: PlacedPiece[]) {
  if (typeof Path2D === "undefined" || typeof DOMMatrix === "undefined") return null;
  const region = new Path2D();
  for (const piece of pieces) region.addPath(new Path2D(motifOutline(piece.motif)), pieceMatrix(piece));
  return region;
}

let probe: CanvasRenderingContext2D | null = null;

/** (x, y)를 덮고 있는 조각들. 위에 그려진 조각이 앞에 온다. */
export function piecesAt(pieces: PlacedPiece[], x: number, y: number) {
  if (typeof document === "undefined") return [];
  probe ??= document.createElement("canvas").getContext("2d");
  if (!probe) return [];
  const hits: PlacedPiece[] = [];
  for (let i = pieces.length - 1; i >= 0; i--) {
    const path = new Path2D();
    path.addPath(new Path2D(motifOutline(pieces[i].motif)), pieceMatrix(pieces[i]));
    if (probe.isPointInPath(path, x, y)) hits.push(pieces[i]);
  }
  return hits;
}
