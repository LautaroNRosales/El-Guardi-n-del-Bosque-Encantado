// Red de puntos de ruta (waypoints): se construye sobre el mapa generado.

import { Grid } from './grid';
import { astar, carve } from './pathfinding';
import { createRng } from './rng';
import type { CellCoord, GameMap, WaypointGraph } from './types';

const keyOf = (x: number, y: number, w: number) => y * w + x;
const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

function nearestWalkable(grid: Grid, target: CellCoord): CellCoord {
  if (grid.isWalkable(target.x, target.y)) return { ...target };
  const seen = new Set<number>([keyOf(target.x, target.y, grid.w)]);
  const queue: CellCoord[] = [{ ...target }];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const k = keyOf(nx, ny, grid.w);
      if (seen.has(k)) continue;
      seen.add(k);
      if (grid.isWalkable(nx, ny)) return { x: nx, y: ny };
      queue.push({ x: nx, y: ny });
    }
  }
  return { ...target };
}

/**
 * Construye el grafo de waypoints:
 * - Nodos: altares (celda adyacente transitable), portal, centro y 4 centros de cuadrante.
 * - Enlaces: A* entre cada nodo y sus 2 vecinos más próximos; union-find une componentes.
 * - Ciclo de patrulla: vecino más cercano desde un nodo inicial según la semilla.
 * Si A* no encuentra camino, se talla uno (carve) — el bosque cede camino.
 */
export function buildWaypointGraph(map: GameMap): WaypointGraph {
  const grid = new Grid(map.w, map.h, 'grass');
  grid.cells = map.cells.map((row) => row.slice());

  const anchors: CellCoord[] = [
    ...map.altars.map((a) => ({ x: a.x, y: a.y })),
    { ...map.portal },
    { x: Math.floor(map.w / 2), y: Math.floor(map.h / 2) },
    { x: 3, y: 3 },
    { x: map.w - 4, y: 3 },
    { x: 3, y: map.h - 4 },
    { x: map.w - 4, y: map.h - 4 },
  ];
  const nodes = anchors.map((a) => nearestWalkable(grid, a));

  const edges = new Map<string, CellCoord[]>();
  const connected = new Map<string, boolean>();

  const connect = (a: number, b: number): boolean => {
    const k = edgeKey(a, b);
    if (connected.get(k)) return true;
    let res = astar(grid, nodes[a], nodes[b]);
    if (!res) {
      carve(grid, nodes[a], nodes[b]); // abre paso y muta el mapa local
      res = astar(grid, nodes[a], nodes[b]);
      // Propagar las celdas abiertas al mapa real: el bosque cede camino.
      for (const c of res?.path ?? []) {
        if (!map.cells[c.y][c.x] || map.cells[c.y][c.x] === 'tree' || map.cells[c.y][c.x] === 'rock') {
          map.cells[c.y][c.x] = 'grass';
        }
      }
    }
    if (!res) return false;
    edges.set(k, res.path);
    connected.set(k, true);
    return true;
  };

  // Conexión 2-vecinos más cercanos.
  const n = nodes.length;
  const dist = (i: number, j: number) =>
    Math.abs(nodes[i].x - nodes[j].x) + Math.abs(nodes[i].y - nodes[j].y);
  for (let i = 0; i < n; i++) {
    const order = Array.from({ length: n }, (_, j) => j)
      .filter((j) => j !== i)
      .sort((a, b) => dist(i, a) - dist(i, b));
    connect(i, order[0]);
    connect(i, order[1]);
  }

  // Conectar componentes con union-find hasta que el grafo sea conexo.
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  // Inicializar con enlaces ya creados.
  for (const k of edges.keys()) {
    const [a, b] = k.split('-').map(Number);
    union(a, b);
  }
  for (;;) {
    const compOf = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!compOf.has(r)) compOf.set(r, []);
      compOf.get(r)!.push(i);
    }
    if (compOf.size <= 1) break;
    const comps = [...compOf.values()];
    const aComp = comps[0];
    const bComp = comps[1];
    let best: { a: number; b: number; d: number } | null = null;
    for (const a of aComp) {
      for (const b of bComp) {
        const d = dist(a, b);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    if (!best) break;
    connect(best.a, best.b);
    union(best.a, best.b);
  }

  // Ciclo de patrulla: vecino más cercano desde un nodo inicial por semilla.
  const rng = createRng(map.seed);
  const remaining = new Set<number>(Array.from({ length: n }, (_, i) => i));
  const patrol: number[] = [];
  let cur = Math.floor(rng() * n);
  patrol.push(cur);
  remaining.delete(cur);
  while (remaining.size > 0) {
    let next = -1;
    let bestD = Infinity;
    for (const j of remaining) {
      const d = dist(cur, j);
      if (d < bestD) {
        bestD = d;
        next = j;
      }
    }
    patrol.push(next);
    remaining.delete(next);
    cur = next;
  }

  return { nodes, edges, patrol };
}

/**
 * Devuelve la polilínea entre dos nodos en el sentido de viaje.
 * La arista se guarda una única vez; se orienta comparando extremos con el origen pedido.
 */
export function edgePath(graph: WaypointGraph, from: number, to: number): CellCoord[] {
  const path = graph.edges.get(edgeKey(from, to));
  if (!path || path.length === 0) return [];
  const a = graph.nodes[from];
  const b = graph.nodes[to];
  const start = path[0];
  const end = path[path.length - 1];
  if (start.x === a.x && start.y === a.y && end.x === b.x && end.y === b.y) return path;
  if (start.x === b.x && start.y === b.y && end.x === a.x && end.y === a.y) return [...path].reverse();
  // Fallback: orientar por proximidad del extremo al nodo pedido.
  const dStart = Math.abs(start.x - a.x) + Math.abs(start.y - a.y);
  const dEnd = Math.abs(end.x - a.x) + Math.abs(end.y - a.y);
  return dStart <= dEnd ? path : [...path].reverse();
}
