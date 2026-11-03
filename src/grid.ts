// Grilla del bosque: transitabilidad, bloqueo de visión y línea de visión.

import type { CellCoord, CellType } from './types';

export class Grid {
  readonly w: number;
  readonly h: number;
  cells: CellType[][]; // [y][x]

  constructor(w: number, h: number, fill: CellType = 'grass') {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: h }, () =>
      Array.from({ length: w }, () => fill),
    );
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  at(x: number, y: number): CellType {
    if (!this.inBounds(x, y)) return 'tree';
    return this.cells[y][x];
  }

  set(x: number, y: number, t: CellType): void {
    if (this.inBounds(x, y)) this.cells[y][x] = t;
  }

  isWalkable(x: number, y: number): boolean {
    const c = this.at(x, y);
    return c === 'grass' || c === 'bush' || c === 'portal';
  }

  /** Celdas que bloquean la visión (GDD 3.1: árboles, rocas y altares). */
  blocksSight(x: number, y: number): boolean {
    const c = this.at(x, y);
    return c === 'tree' || c === 'rock' || c === 'altar';
  }

  /** Vecinos cardinales transitables. */
  walkableNeighbors(x: number, y: number): CellCoord[] {
    const out: CellCoord[] = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.isWalkable(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }

  /**
   * Línea de visión entre dos posiciones CONTINUAS (en unidades de celda).
   * Recorre la línea muestreando subceldas; si atraviesa un árbol, roca o
   * altar (celdas interiores, sin contar extremos) la visión se bloquea.
   */
  losClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return true;
    const steps = Math.max(2, Math.ceil(dist * 4));
    let prevKey = -1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.floor(x0 + dx * t);
      const cy = Math.floor(y0 + dy * t);
      const key = cy * this.w + cx;
      if (key === prevKey) continue;
      prevKey = key;
      // No comprobar extremos: el que mira y el objetivo no se bloquean a sí mismos.
      const isStart = Math.floor(x0) === cx && Math.floor(y0) === cy;
      const isEnd = Math.floor(x1) === cx && Math.floor(y1) === cy;
      if (isStart || isEnd) continue;
      if (this.blocksSight(cx, cy)) return false;
    }
    return true;
  }

  /** Distancia Manhattan entre celdas. */
  static manhattan(ax: number, ay: number, bx: number, by: number): number {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }
}
