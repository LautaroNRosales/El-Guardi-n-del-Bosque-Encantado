// El Guardián del Bosque Encantado: FSM de 5 estados + navegación seleccionable.
//
// Patrulla → Alerta → Persecución → Búsqueda → Vuelta a Patrulla
//   - Percepción: cono de visión 90° (8/5/2 celdas según postura) + oído (correr 6 / caminar 1).
//   - Pérdida de rastro: 3 s sin confirmación → Búsqueda.
//   - Alerta: 4 s sin confirmar → Vuelta a Patrulla.
//   - Búsqueda: barrido BFS por anillos, 10 s, radio 5 alrededor del último punto conocido.
//   - Camino inexistente: se detiene en celda válida y vuelve a patrulla. Nunca atraviesa obstáculos.

import {
  ALERT_CONFIRM_SECONDS,
  CAPTURE_DISTANCE,
  GUARDIAN_CHASE_SPEED,
  GUARDIAN_PATROL_SPEED,
  GUARDIAN_RETURN_SPEED,
  GUARDIAN_SEARCH_SPEED,
  PATH_NULL_WAIT_SECONDS,
  REPATH_SECONDS,
  SEARCH_RADIUS,
  SEARCH_SECONDS,
  TRAIL_LOST_SECONDS,
} from './config';
import { Grid } from './grid';
import { astar, bfs, bfsArea } from './pathfinding';
import { normalizeAngle, perceive, type PerceptionResult } from './perception';
import { audio } from './audio';
import { edgePath } from './waypoints';
import type {
  CellCoord,
  GuardianState,
  NavigationMode,
  Pos,
  SearchAlgorithm,
  WaypointGraph,
} from './types';
import type { Player } from './player';

export const STATE_LABEL: Record<GuardianState, string> = {
  patrol: 'Calmo',
  alert: '¡Alerta!',
  chase: '¡PERSECUCIÓN!',
  search: 'Buscando…',
  return: 'Volviendo…',
};

const cellKey = (c: CellCoord) => `${c.x},${c.y}`;

export class Guardian {
  pos: Pos;
  facing: number;
  state: GuardianState = 'patrol';
  /** TRUE cuando toca al jugador (el juego decide la derrota). */
  caughtPlayer = false;
  lastKnown: CellCoord | null = null;
  /** Estadísticas del último cálculo de ruta (para F2 / explicar A* vs BFS). */
  lastExpanded = 0;
  lastPathLength = 0;
  /** Nodo de la red al que se dirige ahora (depuración F2). */
  targetNodeIndex = 0;

  private grid: Grid;
  private graph: WaypointGraph;

  private activePath: CellCoord[] = [];
  private pathIndex = 0;
  private pathGoalKey: string | null = null;
  private repathTimer = 0;
  private trailTimer = TRAIL_LOST_SECONDS;
  private pathNullTimer = 0;

  private alertTimer = 0;
  private alertSource: Pos | null = null;
  private alertIsDisturbance = false;

  private searchTimer = 0;
  private searchCells: CellCoord[] = [];
  private searchIndex = 0;

  private patrolNodeIndex = 0;
  private disturbanceQueue: CellCoord[] = [];

  constructor(grid: Grid, graph: WaypointGraph) {
    this.grid = grid;
    this.graph = graph;
    const first = graph.nodes[graph.patrol[0]];
    this.pos = { x: first.x + 0.5, y: first.y + 0.5 };
    const next = graph.nodes[graph.patrol[1 % graph.patrol.length]];
    this.facing = Math.atan2(next.y - first.y, next.x - first.x);
    this.targetNodeIndex = graph.patrol[1 % graph.patrol.length];
  }

  /** Consulta el camino activo restante (para el overlay F2). */
  debugPath(): CellCoord[] {
    return this.activePath.slice(this.pathIndex);
  }

  /** Perturbación del entorno (p. ej., un altar recién activado). */
  notifyDisturbance(cell: CellCoord): void {
    this.disturbanceQueue.push({ ...cell });
    if (this.disturbanceQueue.length > 3) this.disturbanceQueue.shift();
  }

  // -------------------------------------------------------------- update

  update(
    dt: number,
    player: Player,
    searchAlgorithm: SearchAlgorithm,
    navigationMode: NavigationMode,
  ): void {
    const perception = perceive(
      this.pos,
      this.facing,
      {
        pos: player.pos,
        crouching: player.crouching,
        hidden: player.hidden,
        noiseLevel: player.noiseLevel,
      },
      this.grid,
    );

    if (perception.seen || perception.heard) {
      this.lastKnown = {
        x: Math.floor(player.pos.x),
        y: Math.floor(player.pos.y),
      };
      this.trailTimer = 0;
    } else {
      this.trailTimer += dt;
    }

    switch (this.state) {
      case 'patrol':
        this.updatePatrol(dt, perception, searchAlgorithm, navigationMode);
        break;
      case 'alert':
        this.updateAlert(dt, perception, searchAlgorithm);
        break;
      case 'chase':
        this.updateChase(dt, perception, searchAlgorithm);
        break;
      case 'search':
        this.updateSearch(dt, perception, searchAlgorithm);
        break;
      case 'return':
        this.updateReturn(dt, perception, searchAlgorithm);
        break;
    }

    // Captura: contacto directo.
    const dx = player.pos.x - this.pos.x;
    const dy = player.pos.y - this.pos.y;
    if (Math.hypot(dx, dy) <= CAPTURE_DISTANCE) {
      this.caughtPlayer = true;
    }
  }

  // ------------------------------------------------------------ estados

  private updatePatrol(
    dt: number,
    p: PerceptionResult,
    searchAlgorithm: SearchAlgorithm,
    navigationMode: NavigationMode,
  ): void {
    if (p.seen || p.heard) {
      this.startAlert(this.lastKnown!, false);
      return;
    }
    const disturbance = this.disturbanceQueue.shift();
    if (disturbance) {
      this.startAlert(disturbance, true);
      return;
    }
    if (navigationMode === 'waypoints') {
      this.patrolWaypoints(dt);
    } else {
      this.patrolGrid(dt, searchAlgorithm);
    }
  }

  private updateAlert(
    dt: number,
    p: PerceptionResult,
    searchAlgorithm: SearchAlgorithm,
  ): void {
    this.alertTimer += dt;

    // Girar el cono hacia la fuente.
    if (this.alertSource) {
      const targetAngle = Math.atan2(
        this.alertSource.y - this.pos.y,
        this.alertSource.x - this.pos.x,
      );
      this.facing = rotateToward(this.facing, targetAngle, 4.2 * dt);
    }

    // Confirmación → persecución.
    if (p.seen || p.heard) {
      this.state = 'chase';
      this.repathTimer = 0;
      this.pathNullTimer = 0;
      this.pathGoalKey = null;
      this.activePath = [];
      audio.chaseSting();
      return;
    }

    // Si la fuente era una perturbación, el guardián AVANZA a investigar.
    if (this.alertIsDisturbance && this.alertSource) {
      const dist = Math.hypot(
        this.alertSource.x - this.pos.x,
        this.alertSource.y - this.pos.y,
      );
      if (dist > 1.0) {
        if (this.activePath.length === 0) {
          const cell = this.nearestWalkableTo(
            Math.floor(this.alertSource.x),
            Math.floor(this.alertSource.y),
          );
          const path = this.computePath(searchAlgorithm, cell);
          if (path) this.setPath(path);
        }
        this.followPath(dt, GUARDIAN_PATROL_SPEED);
      }
    }

    // Sin confirmación en 4 s → Vuelta a Patrulla.
    if (this.alertTimer >= ALERT_CONFIRM_SECONDS) {
      this.state = 'return';
      this.activePath = [];
      this.pathGoalKey = null;
    }
  }

  private updateChase(
    dt: number,
    p: PerceptionResult,
    searchAlgorithm: SearchAlgorithm,
  ): void {
    void p;
    const goal = this.lastKnown;
    if (!goal) {
      this.state = 'search';
      this.initSearch();
      return;
    }

    this.repathTimer -= dt;
    const goalKey = cellKey(goal);
    if (this.repathTimer <= 0 || this.pathGoalKey !== goalKey) {
      const path = this.computePath(searchAlgorithm, goal);
      if (path && path.length > 0) {
        this.setPath(path);
        this.pathGoalKey = goalKey;
        this.pathNullTimer = 0;
      } else {
        this.pathNullTimer += REPATH_SECONDS; // penalizar el intento fallido
      }
      this.repathTimer = REPATH_SECONDS;
    }

    if (this.activePath.length > 0) {
      this.followPath(dt, GUARDIAN_CHASE_SPEED);
    } else {
      this.pathNullTimer += dt;
    }

    if (this.pathNullTimer >= PATH_NULL_WAIT_SECONDS) {
      this.state = 'return';
      this.activePath = [];
      this.pathGoalKey = null;
      return;
    }

    const atGoal =
      Math.hypot(goal.x + 0.5 - this.pos.x, goal.y + 0.5 - this.pos.y) < 0.35;
    const lostForAWhile = this.trailTimer > 0.6;
    if ((atGoal && lostForAWhile) || this.trailTimer >= TRAIL_LOST_SECONDS) {
      this.state = 'search';
      this.initSearch();
    }
  }

  private updateSearch(
    dt: number,
    p: PerceptionResult,
    searchAlgorithm: SearchAlgorithm,
  ): void {
    if (p.seen || p.heard) {
      this.state = 'chase';
      this.repathTimer = 0;
      this.pathGoalKey = null;
      this.activePath = [];
      audio.chaseSting();
      return;
    }

    this.searchTimer -= dt;
    if (this.searchTimer <= 0 || this.searchCells.length === 0) {
      this.state = 'return';
      this.activePath = [];
      this.pathGoalKey = null;
      return;
    }

    if (this.searchIndex >= this.searchCells.length) {
      this.searchIndex = 0; // sigue quedandole tiempo: re-barre
    }
    if (this.activePath.length === 0) {
      // Saltar celdas inalcanzables.
      let attempts = 0;
      let placed = false;
      while (attempts < 12 && !placed) {
        const path = this.computePath(searchAlgorithm, this.searchCells[this.searchIndex]);
        if (path && path.length > 0) {
          this.setPath(path);
          placed = true;
        } else {
          this.searchIndex = (this.searchIndex + 1) % this.searchCells.length;
          attempts++;
        }
      }
      if (!placed) {
        this.state = 'return';
        return;
      }
    }

    const arrived = this.followPath(dt, GUARDIAN_SEARCH_SPEED);
    if (arrived) {
      this.searchIndex++;
      this.activePath = [];
    }
  }

  private updateReturn(
    dt: number,
    p: PerceptionResult,
    searchAlgorithm: SearchAlgorithm,
  ): void {
    if (p.seen || p.heard) {
      this.state = 'chase';
      this.repathTimer = 0;
      this.pathGoalKey = null;
      this.activePath = [];
      audio.chaseSting();
      return;
    }
    const target = this.nearestPatrolNode();
    if (this.activePath.length === 0) {
      const path = this.computePath(searchAlgorithm, this.graph.nodes[target]);
      if (!path) {
        this.state = 'patrol'; // no hay camino: quedarse en celda válida
        return;
      }
      this.setPath(path);
    }
    const arrived = this.followPath(dt, GUARDIAN_RETURN_SPEED);
    if (arrived) {
      this.patrolNodeIndex = this.graph.patrol.indexOf(target);
      if (this.patrolNodeIndex < 0) this.patrolNodeIndex = 0;
      this.state = 'patrol';
      this.activePath = [];
    }
  }

  // ------------------------------------------------------------ patrulla

  private patrolWaypoints(dt: number): void {
    if (this.activePath.length === 0) {
      const from = this.graph.patrol[this.patrolNodeIndex];
      const to = this.graph.patrol[(this.patrolNodeIndex + 1) % this.graph.patrol.length];
      this.targetNodeIndex = to;
      const path = edgePath(this.graph, from, to);
      if (path.length === 0) {
        this.patrolNodeIndex = (this.patrolNodeIndex + 1) % this.graph.patrol.length;
        return;
      }
      this.setPath(path);
    }
    const arrived = this.followPath(dt, GUARDIAN_PATROL_SPEED);
    if (arrived) {
      this.patrolNodeIndex = (this.patrolNodeIndex + 1) % this.graph.patrol.length;
      this.activePath = [];
    }
  }

  private patrolGrid(dt: number, searchAlgorithm: SearchAlgorithm): void {
    this.repathTimer -= dt;
    const to = this.graph.patrol[(this.patrolNodeIndex + 1) % this.graph.patrol.length];
    this.targetNodeIndex = to;
    const goal = this.graph.nodes[to];

    if (this.activePath.length === 0 || this.repathTimer <= 0) {
      const path = this.computePath(searchAlgorithm, goal);
      if (path) {
        this.setPath(path);
        this.repathTimer = 1.2;
      } else {
        // Objetivo inalcanzable: saltarlo.
        this.patrolNodeIndex = (this.patrolNodeIndex + 1) % this.graph.patrol.length;
        this.activePath = [];
        return;
      }
    }
    const arrived = this.followPath(dt, GUARDIAN_PATROL_SPEED);
    if (arrived) {
      this.patrolNodeIndex = (this.patrolNodeIndex + 1) % this.graph.patrol.length;
      this.activePath = [];
      this.repathTimer = 0;
    }
  }

  // ------------------------------------------------------------ helpers

  private startAlert(source: CellCoord, isDisturbance: boolean): void {
    this.state = 'alert';
    this.alertTimer = 0;
    this.alertSource = { x: source.x + 0.5, y: source.y + 0.5 };
    this.alertIsDisturbance = isDisturbance;
    this.activePath = [];
    this.pathGoalKey = null;
    audio.alertSting();
  }

  private initSearch(): void {
    this.searchTimer = SEARCH_SECONDS;
    const center = this.lastKnown ?? {
      x: Math.floor(this.pos.x),
      y: Math.floor(this.pos.y),
    };
    this.searchCells = bfsArea(this.grid, center, SEARCH_RADIUS).filter(
      (c) => !(c.x === center.x && c.y === center.y),
    );
    this.searchIndex = 0;
    this.activePath = [];
    this.pathGoalKey = null;
  }

  /** Celda transitable más cercana a (cx, cy) por BFS en anillo. */
  private nearestWalkableTo(cx: number, cy: number): CellCoord {
    if (this.grid.isWalkable(cx, cy)) return { x: cx, y: cy };
    const seen = new Set<number>([cy * this.grid.w + cx]);
    const queue: CellCoord[] = [{ x: cx, y: cy }];
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (!this.grid.inBounds(nx, ny)) continue;
        const k = ny * this.grid.w + nx;
        if (seen.has(k)) continue;
        seen.add(k);
        if (this.grid.isWalkable(nx, ny)) return { x: nx, y: ny };
        queue.push({ x: nx, y: ny });
      }
    }
    return { x: cx, y: cy }; // sin salida (no debería ocurrir)
  }

  private nearestPatrolNode(): number {
    let best = this.graph.patrol[0];
    let bestD = Infinity;
    for (const idx of this.graph.patrol) {
      const n = this.graph.nodes[idx];
      const d = Math.hypot(n.x + 0.5 - this.pos.x, n.y + 0.5 - this.pos.y);
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    }
    return best;
  }

  private computePath(
    searchAlgorithm: SearchAlgorithm,
    goal: CellCoord,
  ): CellCoord[] | null {
    const start = {
      x: Math.floor(this.pos.x),
      y: Math.floor(this.pos.y),
    };
    const res =
      searchAlgorithm === 'astar'
        ? astar(this.grid, start, goal)
        : bfs(this.grid, start, goal);
    this.lastExpanded = res?.visited ?? 0;
    this.lastPathLength = res?.path.length ?? 0;
    return res?.path ?? null;
  }

  private setPath(path: CellCoord[]): void {
    this.activePath = path;
    const cur = {
      x: Math.floor(this.pos.x),
      y: Math.floor(this.pos.y),
    };
    this.pathIndex =
      path.length > 0 && path[0].x === cur.x && path[0].y === cur.y ? 1 : 0;
  }

  /** Avanza por la ruta actual; true si llegó al final. */
  private followPath(dt: number, speed: number): boolean {
    const target = this.activePath[this.pathIndex];
    if (!target) return true;
    const tx = target.x + 0.5;
    const ty = target.y + 0.5;
    const dx = tx - this.pos.x;
    const dy = ty - this.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.08) {
      this.pathIndex++;
      return this.pathIndex >= this.activePath.length;
    }
    this.facing = Math.atan2(dy, dx);
    const step = Math.min(speed * dt, dist);
    this.pos.x += (dx / dist) * step;
    this.pos.y += (dy / dist) * step;
    return false;
  }
}

/** Rota `from` hacia `to` a velocidad angular `maxDelta` (rad). */
function rotateToward(from: number, to: number, maxDelta: number): number {
  const diff = normalizeAngle(to - from);
  if (Math.abs(diff) <= maxDelta) return to;
  return from + Math.sign(diff) * maxDelta;
}
