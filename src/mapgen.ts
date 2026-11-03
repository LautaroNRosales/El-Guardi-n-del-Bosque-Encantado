// Generación procedural del bosque con validez garantizada (BFS + carve).

import { Grid } from './grid';
import { bfsReachable, carve } from './pathfinding';
import { createRng, randInt, shuffle, type Rng } from './rng';
import {
  ALTAR_MIN_SEPARATION,
  BUSH_CELLS_MAX,
  BUSH_CELLS_MIN,
  GRID_H,
  GRID_W,
  MAX_GEN_ATTEMPTS,
  OBSTACLE_CELLS_MAX,
  OBSTACLE_CELLS_MIN,
} from './config';
import type { CellCoord, GameMap } from './types';

const keyOf = (x: number, y: number, w: number) => y * w + x;

function randomInterior(rng: Rng, w: number, h: number): CellCoord {
  return { x: randInt(rng, 1, w - 2), y: randInt(rng, 1, h - 2) };
}

function manhattan(a: CellCoord, b: CellCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function generateMap(seed: number): GameMap {
  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const rng = createRng((seed + attempt * 2654435761) >>> 0);
    const grid = new Grid(GRID_W, GRID_H, 'grass');

    // 1) Borde de árboles (el bosque encierra el mapa).
    for (let x = 0; x < GRID_W; x++) {
      grid.set(x, 0, 'tree');
      grid.set(x, GRID_H - 1, 'tree');
    }
    for (let y = 0; y < GRID_H; y++) {
      grid.set(0, y, 'tree');
      grid.set(GRID_W - 1, y, 'tree');
    }

    // 2) Manchas de obstáculos (árboles y rocas), no uniforme.
    const targetObstacles = randInt(rng, OBSTACLE_CELLS_MIN, OBSTACLE_CELLS_MAX);
    let placed = 0;
    while (placed < targetObstacles) {
      const seedCell = randomInterior(rng, GRID_W, GRID_H);
      const cluster = randInt(rng, 1, 5);
      let cx = seedCell.x;
      let cy = seedCell.y;
      for (let i = 0; i < cluster && placed < targetObstacles; i++) {
        if (grid.inBounds(cx, cy) && grid.at(cx, cy) === 'grass') {
          grid.set(cx, cy, rng() < 0.72 ? 'tree' : 'rock');
          placed++;
        }
        cx += randInt(rng, -1, 1);
        cy += randInt(rng, -1, 1);
        cx = Math.max(1, Math.min(GRID_W - 2, cx));
        cy = Math.max(1, Math.min(GRID_H - 2, cy));
      }
    }

    // 3) Arbustos.
    const targetBushes = randInt(rng, BUSH_CELLS_MIN, BUSH_CELLS_MAX);
    let bushes = 0;
    let guard = 0;
    while (bushes < targetBushes && guard++ < 500) {
      const c = randomInterior(rng, GRID_W, GRID_H);
      if (grid.at(c.x, c.y) === 'grass') {
        grid.set(c.x, c.y, 'bush');
        bushes++;
      }
    }

    // 4) Inicio (SO), portal (NE) y altares (dispersos).
    const grassCells: CellCoord[] = [];
    for (let y = 1; y < GRID_H - 1; y++) {
      for (let x = 1; x < GRID_W - 1; x++) {
        if (grid.at(x, y) === 'grass' || grid.at(x, y) === 'bush') {
          grassCells.push({ x, y });
        }
      }
    }
    const inSW = (c: CellCoord) => c.x <= 6 && c.y >= 8;
    const inNE = (c: CellCoord) => c.x >= 8 && c.y <= 6;
    const sw = shuffle(rng, grassCells.filter(inSW));
    const ne = shuffle(rng, grassCells.filter(inNE));
    if (sw.length === 0 || ne.length === 0) continue;
    const start = sw[0];
    const portal = ne[0];

    const separation = (a: CellCoord, b: CellCoord, min: number) =>
      manhattan(a, b) >= min;

    const altCandidates = shuffle(
      rng,
      grassCells.filter(
        (c) =>
          manhattan(c, start) >= ALTAR_MIN_SEPARATION &&
          manhattan(c, portal) >= ALTAR_MIN_SEPARATION,
      ),
    );
    const altars: CellCoord[] = [];
    for (const c of altCandidates) {
      if (altars.length >= 3) break;
      if (altars.every((a) => separation(a, c, ALTAR_MIN_SEPARATION))) {
        altars.push(c);
      }
    }
    if (altars.length < 3) continue; // reintentar con otra semilla derivada

    // 5) Fijar tipos de altares y portal (aún sin validar: los altares bloquean).
    for (const a of altars) grid.set(a.x, a.y, 'altar');
    grid.set(portal.x, portal.y, 'portal');

    // 6) VALIDACIÓN + CARVE: inicio → portal y → adyacencia de cada altar.
    const ensurePathTo = (target: CellCoord): boolean => {
      const reachable = bfsReachable(grid, start);
      if (reachable.has(keyOf(target.x, target.y, grid.w))) return true;
      return carve(grid, start, target);
    };
    if (!ensurePathTo(portal)) continue;
    for (const altar of altars) {
      // Objetivo: alguna celda adyacente transitable al altar; se intenta en orden.
      const adj = [
        { x: altar.x + 1, y: altar.y },
        { x: altar.x - 1, y: altar.y },
        { x: altar.x, y: altar.y + 1 },
        { x: altar.x, y: altar.y - 1 },
      ].filter((c) => grid.inBounds(c.x, c.y));
      const reachable = bfsReachable(grid, start);
      const ok = adj.some((c) => reachable.has(keyOf(c.x, c.y, grid.w)));
      if (ok) continue;
      const target = adj.find((c) => grid.inBounds(c.x, c.y));
      if (!target || !ensurePathTo(target)) return generateMap(seed + 9973); // no debería pasar
    }

    return {
      w: GRID_W,
      h: GRID_H,
      cells: grid.cells,
      start,
      portal,
      altars,
      seed,
    };
  }
  // Última opción (prácticamente inalcanzable): bosque abierto.
  return generateOpenFallback(seed);
}

function generateOpenFallback(seed: number): GameMap {
  const grid = new Grid(GRID_W, GRID_H, 'grass');
  for (let x = 0; x < GRID_W; x++) {
    grid.set(x, 0, 'tree');
    grid.set(x, GRID_H - 1, 'tree');
  }
  for (let y = 0; y < GRID_H; y++) {
    grid.set(0, y, 'tree');
    grid.set(GRID_W - 1, y, 'tree');
  }
  const start = { x: 2, y: GRID_H - 3 };
  const portal = { x: GRID_W - 3, y: 2 };
  const altars = [
    { x: 4, y: 4 },
    { x: GRID_W - 5, y: GRID_H - 5 },
    { x: GRID_W - 4, y: 7 },
  ];
  for (const a of altars) grid.set(a.x, a.y, 'altar');
  grid.set(portal.x, portal.y, 'portal');
  return { w: GRID_W, h: GRID_H, cells: grid.cells, start, portal, altars, seed };
}
