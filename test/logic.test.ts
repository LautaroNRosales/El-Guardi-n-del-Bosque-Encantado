// Tests de lógica: grilla, línea de visión, A*, BFS, barrido y carve.

import { describe, expect, it } from 'vitest';
import { Grid } from '../src/grid';
import { astar, bfs, bfsArea, bfsReachable, carve, isReachable } from '../src/pathfinding';

function makeOpenGrid(w = 5, h = 5): Grid {
  return new Grid(w, h, 'grass');
}

describe('pathfinding', () => {
  it('A* encuentra el camino óptimo en una grilla abierta', () => {
    const g = makeOpenGrid(5, 5);
    const res = astar(g, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(res).not.toBeNull();
    expect(res!.path.length).toBe(9); // 4+4+1
    expect(res!.path[0]).toEqual({ x: 0, y: 0 });
    expect(res!.path[res!.path.length - 1]).toEqual({ x: 4, y: 4 });
  });

  it('A* rodea obstáculos y respeta el bloqueo total', () => {
    const g = makeOpenGrid(5, 5);
    g.set(1, 0, 'tree');
    g.set(1, 1, 'tree');
    g.set(1, 2, 'tree');
    g.set(1, 3, 'tree');
    g.set(1, 4, 'tree');
    const res = astar(g, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(res).toBeNull(); // muro completo: sin camino

    const g2 = makeOpenGrid(5, 5);
    g2.set(1, 0, 'tree');
    g2.set(1, 1, 'tree');
    g2.set(1, 2, 'tree');
    g2.set(1, 4, 'tree'); // hueco en (1,3)
    const res2 = astar(g2, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(res2).not.toBeNull();
    expect(res2!.path).toContainEqual({ x: 1, y: 3 });
  });

  it('BFS y A* devuelven el mismo largo de camino (costos uniformes)', () => {
    const g = makeOpenGrid(7, 7);
    g.set(3, 0, 'rock');
    g.set(3, 1, 'rock');
    g.set(3, 2, 'rock');
    const a = astar(g, { x: 0, y: 0 }, { x: 6, y: 0 });
    const b = bfs(g, { x: 0, y: 0 }, { x: 6, y: 0 });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.path.length).toBe(b!.path.length);
  });

  it('bfsArea devuelve las celdas del radio y nada fuera de él', () => {
    const g = makeOpenGrid(9, 9);
    const area = bfsArea(g, { x: 4, y: 4 }, 2);
    // Radio 2 en cruz: 1 + 4 + 8 = 13 celdas
    expect(area.length).toBe(13);
    expect(area).toContainEqual({ x: 4, y: 2 });
    expect(area).toContainEqual({ x: 2, y: 4 });
    expect(area).not.toContainEqual({ x: 7, y: 4 });
    expect(area).not.toContainEqual({ x: 4, y: 1 });
  });

  it('bfsReachable respeta muros', () => {
    const g = makeOpenGrid(5, 5);
    for (let y = 0; y < 5; y++) g.set(2, y, 'tree');
    const left = bfsReachable(g, { x: 0, y: 0 });
    expect(left.size).toBe(10); // 2 columnas × 5 filas
    expect(isReachable(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });

  it('carve abre paso a través de obstáculos', () => {
    const g = makeOpenGrid(5, 5);
    for (let y = 0; y < 5; y++) g.set(2, y, 'tree');
    expect(isReachable(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    const ok = carve(g, { x: 0, y: 0 }, { x: 4, y: 0 });
    expect(ok).toBe(true);
    expect(isReachable(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
    // Se abrió al menos una celda del muro
    let opened = 0;
    for (let y = 0; y < 5; y++) if (g.at(2, y) === 'grass') opened++;
    expect(opened).toBeGreaterThan(0);
  });
});

describe('grid / línea de visión', () => {
  it('losClear se bloquea por árbol/roca/altar y no por pasto/arbusto', () => {
    const g = makeOpenGrid(9, 9);
    expect(g.losClear(0.5, 0.5, 8.5, 0.5)).toBe(true);
    g.set(4, 0, 'tree');
    expect(g.losClear(0.5, 0.5, 8.5, 0.5)).toBe(false);
    g.set(4, 0, 'bush');
    expect(g.losClear(0.5, 0.5, 8.5, 0.5)).toBe(true);
    g.set(4, 0, 'altar');
    expect(g.losClear(0.5, 0.5, 8.5, 0.5)).toBe(false);
    g.set(4, 0, 'rock');
    expect(g.losClear(0.5, 0.5, 8.5, 0.5)).toBe(false);
    g.set(4, 0, 'grass');
    expect(g.losClear(0.5, 0.5, 8.5, 0.5)).toBe(true);
  });

  it('portal es transitable, altar no lo es', () => {
    const g = makeOpenGrid(3, 3);
    g.set(1, 1, 'portal');
    g.set(0, 1, 'altar');
    expect(g.isWalkable(1, 1)).toBe(true);
    expect(g.isWalkable(0, 1)).toBe(false);
  });
});
