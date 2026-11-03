// Algoritmos de búsqueda: A*, BFS, barrido BFS por radio, alcanzabilidad y «carve».

import { Grid } from './grid';
import { CARVE_GRASS_COST, CARVE_OBSTACLE_COST } from './config';
import type { CellCoord } from './types';

export interface PathResult {
  /** Camino desde start (incluido) hasta goal (incluido). */
  path: CellCoord[];
  /** Nodos expandidos (para F2 y para explicar A* vs BFS). */
  visited: number;
}

function keyOf(g: Grid, x: number, y: number): number {
  return y * g.w + x;
}

function coordOf(g: Grid, key: number): CellCoord {
  return { x: key % g.w, y: Math.floor(key / g.w) };
}

function reconstruct(cameFrom: Map<number, number>, current: number, g: Grid): CellCoord[] {
  const path: CellCoord[] = [];
  let cur = current;
  for (;;) {
    path.push(coordOf(g, cur));
    const prev = cameFrom.get(cur);
    if (prev === undefined) break;
    cur = prev;
  }
  path.reverse();
  return path;
}

/** A* con heurística Manhattan (admisible con costos uniformes). */
export function astar(
  grid: Grid,
  start: CellCoord,
  goal: CellCoord,
): PathResult | null {
  if (!grid.inBounds(goal.x, goal.y)) return null;
  if (!grid.isWalkable(start.x, start.y) || !grid.isWalkable(goal.x, goal.y)) {
    return null;
  }
  const startKey = keyOf(grid, start.x, start.y);
  const goalKey = keyOf(grid, goal.x, goal.y);
  if (startKey === goalKey) return { path: [ { ...start } ], visited: 0 };

  const gScore = new Map<number, number>([[startKey, 0]]);
  const cameFrom = new Map<number, number>();
  const open: { key: number; f: number }[] = [
    { key: startKey, f: Grid.manhattan(start.x, start.y, goal.x, goal.y) },
  ];
  const closed = new Set<number>();
  let visited = 0;

  while (open.length > 0) {
    // Extraer el nodo de menor f (cola simple; la grilla es pequeña).
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const { key: current } = open.splice(best, 1)[0];
    if (closed.has(current)) continue;
    closed.add(current);
    visited++;
    if (current === goalKey) {
      return { path: reconstruct(cameFrom, current, grid), visited };
    }
    const cur = coordOf(grid, current);
    const gCur = gScore.get(current)!;
    for (const nb of grid.walkableNeighbors(cur.x, cur.y)) {
      const nk = keyOf(grid, nb.x, nb.y);
      if (closed.has(nk)) continue;
      const tentative = gCur + 1;
      const known = gScore.get(nk) ?? Infinity;
      if (tentative < known) {
        gScore.set(nk, tentative);
        cameFrom.set(nk, current);
        const f = tentative + Grid.manhattan(nb.x, nb.y, goal.x, goal.y);
        open.push({ key: nk, f });
      }
    }
  }
  return null;
}

/** BFS sin pesos (costos uniformes). Mismo óptimo que A*; expande por anillos. */
export function bfs(
  grid: Grid,
  start: CellCoord,
  goal: CellCoord,
): PathResult | null {
  if (!grid.inBounds(start.x, start.y) || !grid.inBounds(goal.x, goal.y)) return null;
  if (!grid.isWalkable(start.x, start.y) || !grid.isWalkable(goal.x, goal.y)) return null;
  const startKey = keyOf(grid, start.x, start.y);
  const goalKey = keyOf(grid, goal.x, goal.y);
  if (startKey === goalKey) return { path: [ { ...start } ], visited: 0 };

  const cameFrom = new Map<number, number>();
  const visitedSet = new Set<number>([startKey]);
  const queue: number[] = [startKey];
  let head = 0;
  let visited = 0;

  while (head < queue.length) {
    const current = queue[head++];
    visited++;
    const cur = coordOf(grid, current);
    if (current === goalKey) {
      return { path: reconstruct(cameFrom, current, grid), visited };
    }
    for (const nb of grid.walkableNeighbors(cur.x, cur.y)) {
      const nk = keyOf(grid, nb.x, nb.y);
      if (visitedSet.has(nk)) continue;
      visitedSet.add(nk);
      cameFrom.set(nk, current);
      queue.push(nk);
    }
  }
  return null;
}

/** Barrido BFS por radio: celdas alcanzables dentro de `radius`, en orden de visita. */
export function bfsArea(
  grid: Grid,
  center: CellCoord,
  radius: number,
): CellCoord[] {
  const startKey = keyOf(grid, center.x, center.y);
  const depth = new Map<number, number>([[startKey, 0]]);
  const queue: number[] = [startKey];
  let head = 0;
  const out: CellCoord[] = [];
  while (head < queue.length) {
    const current = queue[head++];
    const d = depth.get(current)!;
    const cur = coordOf(grid, current);
    out.push(cur);
    if (d >= radius) continue;
    for (const nb of grid.walkableNeighbors(cur.x, cur.y)) {
      const nk = keyOf(grid, nb.x, nb.y);
      if (depth.has(nk)) continue;
      depth.set(nk, d + 1);
      queue.push(nk);
    }
  }
  return out;
}

/** Conjunto de claves alcanzables desde `start` (para validar el mapa). */
export function bfsReachable(grid: Grid, start: CellCoord): Set<number> {
  const startKey = keyOf(grid, start.x, start.y);
  const seen = new Set<number>([startKey]);
  const queue: number[] = [startKey];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const cur = coordOf(grid, current);
    for (const nb of grid.walkableNeighbors(cur.x, cur.y)) {
      const nk = keyOf(grid, nb.x, nb.y);
      if (seen.has(nk)) continue;
      seen.add(nk);
      queue.push(nk);
    }
  }
  return seen;
}

/**
 * «Carve» (tallar): garantiza conexión aunque no haya camino transitable.
 * A* con costos: 1 pasto/portal / 6 árbol-roca / altar = infranqueable.
 * Al terminar, SOLO las celdas árbol/roca que atravesó el camino se abren.
 */
export function carve(grid: Grid, start: CellCoord, goal: CellCoord): boolean {
  if (!grid.inBounds(start.x, start.y) || !grid.inBounds(goal.x, goal.y)) return false;

  // Altares y portal: el portal es transitable (coste 1); el altar es infranqueable.
  const cost = (x: number, y: number): number => {
    const c = grid.at(x, y);
    if (c === 'tree' || c === 'rock') return CARVE_OBSTACLE_COST;
    if (c === 'altar') return Infinity;
    return CARVE_GRASS_COST;
  };

  const startKey = keyOf(grid, start.x, start.y);
  const goalKey = keyOf(grid, goal.x, goal.y);
  const gScore = new Map<number, number>([[startKey, 0]]);
  const cameFrom = new Map<number, number>();
  const open: { key: number; f: number }[] = [
    { key: startKey, f: Grid.manhattan(start.x, start.y, goal.x, goal.y) * CARVE_GRASS_COST },
  ];
  const closed = new Set<number>();

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const { key: current } = open.splice(best, 1)[0];
    if (closed.has(current)) continue;
    closed.add(current);
    if (current === goalKey) {
      // Abrir paso: SOLO árboles/rocas del camino pasan a pasto (los altares nunca).
      for (const c of reconstruct(cameFrom, current, grid)) {
        const cell = grid.at(c.x, c.y);
        if (cell === 'tree' || cell === 'rock') grid.set(c.x, c.y, 'grass');
      }
      return true;
    }
    const cur = coordOf(grid, current);
    const gCur = gScore.get(current)!;
    // Vecinos cardinales SIN filtro de transitabilidad (el objetivo es atravesar obstáculos).
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const nk = keyOf(grid, nx, ny);
      if (closed.has(nk)) continue;
      const tentative = gCur + cost(nx, ny);
      const known = gScore.get(nk) ?? Infinity;
      if (tentative < known) {
        gScore.set(nk, tentative);
        cameFrom.set(nk, current);
        const f = tentative + Grid.manhattan(nx, ny, goal.x, goal.y) * CARVE_GRASS_COST;
        open.push({ key: nk, f });
      }
    }
  }
  return false;
}

/** ¿Alcanzable desde start? (atajo legible sobre bfsReachable) */
export function isReachable(grid: Grid, start: CellCoord, goal: CellCoord): boolean {
  if (!grid.isWalkable(goal.x, goal.y)) return false;
  return bfsReachable(grid, start).has(keyOf(grid, goal.x, goal.y));
}
