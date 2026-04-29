import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCENE_BASE_WIDTH,
  SCENE_BASE_HEIGHT,
  FIELD_GUIDE_CORNERS,
  FIELD_GUIDE_ROWS,
  FIELD_GUIDE_COLS,
  buildCellPolygon,
  pointList,
} from '../lib/farmFieldGeometry.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'public', 'farm', 'generated');

function polygonPath(points) {
  return `M ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
}

function pointAlong(from, to, distance) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const t = Math.min(distance / length, 0.45);
  return [from[0] + dx * t, from[1] + dy * t];
}

function roundedQuadPath(points, radius) {
  const total = points.length;
  const enter = points.map((curr, index) => {
    const prev = points[(index - 1 + total) % total];
    return pointAlong(curr, prev, radius);
  });
  const leave = points.map((curr, index) => {
    const next = points[(index + 1) % total];
    return pointAlong(curr, next, radius);
  });

  const segments = [`M ${leave[0][0]} ${leave[0][1]}`];
  for (let index = 1; index < total; index += 1) {
    segments.push(`L ${enter[index][0]} ${enter[index][1]}`);
    segments.push(`Q ${points[index][0]} ${points[index][1]} ${leave[index][0]} ${leave[index][1]}`);
  }
  segments.push(`L ${enter[0][0]} ${enter[0][1]}`);
  segments.push(`Q ${points[0][0]} ${points[0][1]} ${leave[0][0]} ${leave[0][1]}`);
  segments.push('Z');
  return segments.join(' ');
}

function roundedQuadControlPoints(points, radius) {
  const total = points.length;
  const enter = points.map((curr, index) => {
    const prev = points[(index - 1 + total) % total];
    return pointAlong(curr, prev, radius);
  });
  const leave = points.map((curr, index) => {
    const next = points[(index + 1) % total];
    return pointAlong(curr, next, radius);
  });
  return { enter, leave };
}

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function linePath(from, to) {
  return `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`;
}

function buildSurfaceSvg() {
  const cornerPoints = [
    FIELD_GUIDE_CORNERS.top,
    FIELD_GUIDE_CORNERS.right,
    FIELD_GUIDE_CORNERS.bottom,
    FIELD_GUIDE_CORNERS.left,
  ];
  const outer = roundedQuadPath(cornerPoints, 26);

  const cellPolygons = [];

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const cell = buildCellPolygon(row, col);
      cellPolygons.push(
        `<polygon points="${pointList(cell)}" fill="${(row + col) % 2 === 0 ? 'rgba(158,103,39,0.08)' : 'rgba(130,84,30,0.06)'}" />`,
      );

    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE_BASE_WIDTH}" height="${SCENE_BASE_HEIGHT}" viewBox="0 0 ${SCENE_BASE_WIDTH} ${SCENE_BASE_HEIGHT}" fill="none">
  <defs>
    <clipPath id="fieldClip">
      <path d="${outer}" />
    </clipPath>
    <linearGradient id="fieldFill" x1="${FIELD_GUIDE_CORNERS.top[0]}" y1="${FIELD_GUIDE_CORNERS.top[1]}" x2="${FIELD_GUIDE_CORNERS.bottom[0]}" y2="${FIELD_GUIDE_CORNERS.bottom[1]}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgba(232,177,79,0.18)" />
      <stop offset="55%" stop-color="rgba(173,116,45,0.10)" />
      <stop offset="100%" stop-color="rgba(132,84,28,0.08)" />
    </linearGradient>
    <radialGradient id="fieldGlow" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="rgba(255,236,180,0.1)" />
      <stop offset="100%" stop-color="rgba(255,236,180,0)" />
    </radialGradient>
  </defs>
  <g clip-path="url(#fieldClip)">
    <path d="${outer}" fill="url(#fieldFill)" />
    <path d="${outer}" fill="url(#fieldGlow)" />
    ${cellPolygons.join('\n    ')}
    ${FIELD_GUIDE_ROWS.slice(1, -1)
      .map((line) => `<path d="${linePath(line.from, line.to)}" stroke="rgba(111,70,22,0.10)" stroke-width="1.8" stroke-linecap="round" />`)
      .join('\n    ')}
    ${FIELD_GUIDE_COLS.slice(1, -1)
      .map((line) => `<path d="${linePath(line.from, line.to)}" stroke="rgba(111,70,22,0.10)" stroke-width="1.8" stroke-linecap="round" />`)
      .join('\n    ')}
  </g>
</svg>`;
}

function buildRimSvg() {
  const cornerPoints = [
    FIELD_GUIDE_CORNERS.top,
    FIELD_GUIDE_CORNERS.right,
    FIELD_GUIDE_CORNERS.bottom,
    FIELD_GUIDE_CORNERS.left,
  ];
  const outer = roundedQuadPath(cornerPoints, 26);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SCENE_BASE_WIDTH}" height="${SCENE_BASE_HEIGHT}" viewBox="0 0 ${SCENE_BASE_WIDTH} ${SCENE_BASE_HEIGHT}" fill="none">
  <path d="${outer}" fill="none" stroke="rgba(122,78,25,0.14)" stroke-width="4.5" stroke-linejoin="round" />
</svg>`;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUTPUT_DIR, 'field-surface.svg'), buildSurfaceSvg(), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIR, 'field-rim.svg'), buildRimSvg(), 'utf8');
  process.stdout.write(`Generated field overlays in ${OUTPUT_DIR}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
