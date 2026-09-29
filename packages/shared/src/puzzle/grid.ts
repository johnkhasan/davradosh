export interface GridSize {
  cols: number;
  rows: number;
}

/**
 * Picks a grid close to `targetPieces` whose cells are as square as possible
 * for an image of the given aspect ratio (width / height).
 */
export function gridForPieceCount(targetPieces: number, aspect: number): GridSize {
  let best: GridSize = { cols: 1, rows: 1 };
  let bestScore = Number.POSITIVE_INFINITY;

  const approxCols = Math.sqrt(targetPieces * aspect);
  const minCols = Math.max(2, Math.floor(approxCols) - 3);
  const maxCols = Math.ceil(approxCols) + 3;

  for (let cols = minCols; cols <= maxCols; cols++) {
    const rows = Math.max(2, Math.round(targetPieces / cols));
    const cellAspect = aspect / cols / (1 / rows); // cell width / cell height
    const countError = Math.abs(cols * rows - targetPieces) / targetPieces;
    const shapeError = Math.abs(Math.log(cellAspect));
    const score = countError * 2 + shapeError;
    if (score < bestScore) {
      bestScore = score;
      best = { cols, rows };
    }
  }
  return best;
}
