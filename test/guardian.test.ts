// Simulación de la IA del guardián: percepción, FSM y captura.

import { describe, expect, it } from 'vitest';
import { Grid } from '../src/grid';
import { Guardian } from '../src/guardian';
import { Player } from '../src/player';
import type { WaypointGraph } from '../src/types';

function makeWorld(withWall: boolean) {
  const grid = new Grid(9, 9, 'grass');
  if (withWall) {
    for (let y = 0; y < 9; y++) grid.set(4, y, 'tree');
  }
  const graph: WaypointGraph = {
    nodes: [
      { x: 0, y: 4 },
      { x: 8, y: 4 },
    ],
    edges: new Map(),
    patrol: [0, 1],
  };
  const guardian = new Guardian(grid, graph);
  // Mirando hacia el jugador (este), desde el constructor (patrol 0→1).
  const player = new Player({ x: 6, y: 4 });
  return { grid, graph, guardian, player };
}

function simulate(guardian: Guardian, player: Player, seconds: number): void {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    guardian.update(dt, player, 'astar', 'waypoints');
    if (guardian.caughtPlayer) return;
  }
}

describe('guardia: percepción y captura (simulación)', () => {
  it('detecta al jugador en campo abierto, alerta y termina capturándolo', () => {
    const { guardian, player } = makeWorld(false);
    guardian.update(1 / 60, player, 'astar', 'waypoints');
    expect(guardian.state).toBe('alert'); // pasa a Alerta al razonar la fuente
    simulate(guardian, player, 10);
    expect(guardian.caughtPlayer).toBe(true);
  });

  it('no atraviesa la pared de árboles: no detecta y sigue en patrulla', () => {
    const { guardian, player } = makeWorld(true);
    simulate(guardian, player, 6);
    expect(guardian.state).toBe('patrol');
    expect(guardian.caughtPlayer).toBe(false);
  });

  it('un jugador escondido en el arbusto es invisible', () => {
    const { guardian, player, grid } = makeWorld(false);
    grid.set(6, 4, 'bush');
    player.hidden = true;
    simulate(guardian, player, 6);
    expect(guardian.state).toBe('patrol');
    expect(guardian.caughtPlayer).toBe(false);
  });

  it('al activar un altar, una perturbación lo desvía a investigar (Alerta)', () => {
    const { guardian, player } = makeWorld(true); // sin línea de visión
    guardian.notifyDisturbance({ x: 2, y: 4 });
    guardian.update(1 / 60, player, 'astar', 'waypoints');
    expect(guardian.state).toBe('alert');
  });
});
