// Percepción del Guardián: visión (cono) y oído (radio).

import {
  VISION_FAR,
  VISION_HALF_ANGLE_DEG,
  VISION_MID,
} from './config';
import { Grid } from './grid';
import type { Pos } from './types';

export interface Perceivable {
  pos: Pos;
  crouching: boolean;
  hidden: boolean;
  noiseLevel: number;
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export interface PerceptionResult {
  seen: boolean;
  heard: boolean;
  distance: number;
}

/**
 * ¿Puede el guardián VER al jugador?
 * - Dentro del cono de 90° (semángulo 45°) orientado a `facing`.
 * - Distancia: ≤2 celdas incluso agachado; ≤5 seguro; ≤8 solo de pie y sin obstáculos.
 * - Escondido en arbusto = invisible.
 * - La línea de visión queda bloqueada por árboles, rocas y altares.
 */
export function canSee(
  guardianPos: Pos,
  facing: number,
  target: Perceivable,
  grid: Grid,
): boolean {
  const dx = target.pos.x - guardianPos.x;
  const dy = target.pos.y - guardianPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_FAR) return false;

  const angle = Math.atan2(dy, dx);
  const half = (VISION_HALF_ANGLE_DEG * Math.PI) / 180;
  if (Math.abs(normalizeAngle(angle - facing)) > half) return false;

  if (target.hidden) return false; // escondido: indetectable

  if (dist > VISION_MID) {
    // Rango lejano (5–8): solo de pie y sin obstáculos de por medio.
    if (target.crouching) return false;
  }
  return grid.losClear(guardianPos.x, guardianPos.y, target.pos.x, target.pos.y);
}

/** ¿Puede el guardián OÍR al jugador? (sin necesidad de línea de visión) */
export function canHear(
  guardianPos: Pos,
  target: Perceivable,
): boolean {
  if (target.noiseLevel <= 0) return false;
  const dx = target.pos.x - guardianPos.x;
  const dy = target.pos.y - guardianPos.y;
  return Math.hypot(dx, dy) <= target.noiseLevel;
}

export function perceive(
  guardianPos: Pos,
  facing: number,
  target: Perceivable,
  grid: Grid,
): PerceptionResult {
  const dx = target.pos.x - guardianPos.x;
  const dy = target.pos.y - guardianPos.y;
  return {
    seen: canSee(guardianPos, facing, target, grid),
    heard: canHear(guardianPos, target),
    distance: Math.hypot(dx, dy),
  };
}
