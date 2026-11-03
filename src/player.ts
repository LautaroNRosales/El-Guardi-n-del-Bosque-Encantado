// Jugador: un pequeño espíritu que atraviesa el bosque.

import {
  CROUCH_SPEED,
  RUN_SPEED,
  WALK_SPEED,
  HEAR_RUN,
  HEAR_WALK,
} from './config';
import { Grid } from './grid';
import type { CellCoord, Pos } from './types';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  run: boolean;
  crouch: boolean;
}

export class Player {
  pos: Pos;
  facing = -Math.PI / 2;
  moving = false;
  running = false;
  crouching = false;
  /** Escondido dentro de un arbusto (invisible al guardián). */
  hidden = false;
  /** Progreso del canal de altar (0..1). */
  altarProgress = 0;
  /** Radio de ruido actual en celdas (para percepción auditiva). */
  noiseLevel = 0;

  constructor(start: CellCoord) {
    this.pos = { x: start.x + 0.5, y: start.y + 0.5 };
  }

  cellX(): number {
    return Math.floor(this.pos.x);
  }

  cellY(): number {
    return Math.floor(this.pos.y);
  }

  inBush(grid: Grid): boolean {
    return grid.at(this.cellX(), this.cellY()) === 'bush';
  }

  update(dt: number, input: PlayerInput, grid: Grid): void {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    if (len > 0) {
      dx /= len;
      dy /= len;
      this.facing = Math.atan2(dy, dx);
    }
    this.crouching = input.crouch;
    // Escondido implica moverse lento y en silencio; no se puede correr escondido.
    this.running = input.run && !this.crouching && !this.hidden && this.moving;

    const speed =
      this.hidden || this.crouching ? CROUCH_SPEED : this.running ? RUN_SPEED : WALK_SPEED;

    // Colisión por ejes (permite deslizarse junto a muros).
    const nx = this.pos.x + dx * speed * dt;
    if (this.canStand(grid, nx, this.pos.y)) this.pos.x = nx;
    const ny = this.pos.y + dy * speed * dt;
    if (this.canStand(grid, this.pos.x, ny)) this.pos.y = ny;

    // Ruido: correr 6 celdas, caminar 1, agachado/quieto/escondido nada.
    if (this.hidden || this.crouching || !this.moving) {
      this.noiseLevel = 0;
    } else if (this.running) {
      this.noiseLevel = HEAR_RUN;
    } else {
      this.noiseLevel = HEAR_WALK;
    }

    // Si sale del arbusto, deja de estar escondido.
    if (this.hidden && !this.inBush(grid)) this.hidden = false;
  }

  private canStand(grid: Grid, x: number, y: number): boolean {
    // El espíritu ocupa un círculo pequeño; se comprueban las 4 esquinas.
    const r = 0.28;
    const corners: Array<[number, number]> = [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ];
    return corners.every(([cx, cy]) => grid.isWalkable(Math.floor(cx), Math.floor(cy)));
  }
}
