export const SCENE_BASE_WIDTH = 1536;
export const SCENE_BASE_HEIGHT = 1024;

export const FIELD_GUIDE_CORNERS = {
  top: [721.0, 474.4],
  right: [1244.9, 663.4],
  bottom: [804.7, 923.4],
  left: [263.1, 667.2],
};

export function lerpPoint(from, to, t) {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
  ];
}

export function buildGuideLines(count, fromStart, fromEnd, toStart, toEnd) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return {
      from: lerpPoint(fromStart, fromEnd, t),
      to: lerpPoint(toStart, toEnd, t),
      boundary: index === 0 || index === count - 1,
    };
  });
}

export const FIELD_GUIDE_ROWS = buildGuideLines(
  5,
  FIELD_GUIDE_CORNERS.top,
  FIELD_GUIDE_CORNERS.left,
  FIELD_GUIDE_CORNERS.right,
  FIELD_GUIDE_CORNERS.bottom,
);

export const FIELD_GUIDE_COLS = buildGuideLines(
  5,
  FIELD_GUIDE_CORNERS.top,
  FIELD_GUIDE_CORNERS.right,
  FIELD_GUIDE_CORNERS.left,
  FIELD_GUIDE_CORNERS.bottom,
);

export function buildCellCenter(row, col) {
  const rowT = (row + 0.5) / 4;
  const colT = (col + 0.5) / 4;
  const rowStart = lerpPoint(FIELD_GUIDE_CORNERS.top, FIELD_GUIDE_CORNERS.left, rowT);
  const rowEnd = lerpPoint(FIELD_GUIDE_CORNERS.right, FIELD_GUIDE_CORNERS.bottom, rowT);
  return lerpPoint(rowStart, rowEnd, colT);
}

export function buildCellPolygon(row, col) {
  const rowStart = lerpPoint(FIELD_GUIDE_CORNERS.top, FIELD_GUIDE_CORNERS.left, row / 4);
  const rowEnd = lerpPoint(FIELD_GUIDE_CORNERS.right, FIELD_GUIDE_CORNERS.bottom, row / 4);
  const nextRowStart = lerpPoint(FIELD_GUIDE_CORNERS.top, FIELD_GUIDE_CORNERS.left, (row + 1) / 4);
  const nextRowEnd = lerpPoint(FIELD_GUIDE_CORNERS.right, FIELD_GUIDE_CORNERS.bottom, (row + 1) / 4);

  const topLeft = lerpPoint(rowStart, rowEnd, col / 4);
  const topRight = lerpPoint(rowStart, rowEnd, (col + 1) / 4);
  const bottomRight = lerpPoint(nextRowStart, nextRowEnd, (col + 1) / 4);
  const bottomLeft = lerpPoint(nextRowStart, nextRowEnd, col / 4);

  return [topLeft, topRight, bottomRight, bottomLeft];
}

export function pointList(points) {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}
